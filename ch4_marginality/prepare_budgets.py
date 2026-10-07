"""Reviewed source transcriptions and traceable, non-interchangeable accounts."""
from pathlib import Path
import csv, json, hashlib
import numpy as np
import pandas as pd
from .core import YEARS
from .budget_registry import load_registry, eligible_years

HERE=Path(__file__).resolve().parent

def finbin(path):
    with path.open(encoding='utf-8-sig') as stream:
        rows=list(csv.reader(stream))
    header=next(r for r in rows if any(v.strip()=='2001' for v in r))
    columns={i:int(v.strip()) for i,v in enumerate(header) if v.strip().isdigit() and 2001<=int(v.strip())<=2021}
    out=[]; section='Summary'
    for row in rows:
        if not row: continue
        label=row[0].strip()
        if label in ('Direct Expenses','Overhead Expenses'): section=label
        for i,y in columns.items():
            if len(row)<=i:continue
            raw=row[i].strip()
            try:value=float(raw)
            except ValueError:value=np.nan
            if label and (np.isfinite(value) or raw=='-'):
                out.append(dict(year=y,section=section,item=label,value=value,raw=raw,file=path.name))
    return pd.DataFrame(out)

def build(out, policy='exact'):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    if policy == 'exact':
        reviewed=load_registry(HERE/'sources')
    else:
        from .budget_policy import load_policy
        reviewed=load_policy(HERE/'sources', policy)
    enabled=eligible_years(reviewed)
    ledger=[{k:v for k,v in r.items() if k!='candidates'} for r in reviewed]
    eligibility=pd.DataFrame(ledger);eligibility.to_csv(out/'year_eligibility.csv',index=False)
    costs=[];items=[]
    # Dollars per acre, visually checked against original page images.
    transcriptions=json.loads((HERE/('sources/unl_verified_transcriptions.json' if policy=='exact' else 'sources/rotation_budget_transcriptions.json')).read_text(encoding='utf-8'))
    prices=json.loads((HERE/('sources/verified_annual_prices.json' if policy=='exact' else 'sources/rotation_annual_prices.json')).read_text(encoding='utf-8'))
    price_by_year={r['year']:r for r in prices}
    if not enabled <= {int(y) for y in transcriptions} or not enabled <= set(price_by_year):
        raise ValueError('Eligible original requires reviewed costs, NASS price and inflation evidence')
    data={int(y):d for y,d in transcriptions.items() if int(y) in enabled}
    yield_by_year={r['year']:r['assumed_yield_bu_ac'] for r in reviewed if r['eligible']}
    materials=['Nitrogen','Corn seed','Starter fertilizer','Primary herbicide','Armezon Pro','NIS','UAN','Custom spray','Brigade','Mustang Maxx','Haul grain','Dry grain','Scouting','Crop insurance']
    incomplete=[];reconciliation=[]
    for year,d in sorted(data.items()):
        for cat,names,values in [('field_operations',['Labor','Fuel and lube','Power repairs','Implement repairs','Power ownership','Implement ownership'],d['field']),('materials_services',d.get('material_names',materials),d['materials'])]:
            if len(names)!=len(values):raise ValueError('Transcription label/value lengths differ')
            for name,v in zip(names,values):items.append(dict(year=year,category=cat,item=name,usd_ac=v))
        other=d.get('other',{k:d.get(k) for k in ['interest','overhead','land','taxes']})
        for key,v in other.items():items.append(dict(year=year,category='other',item=key,usd_ac=v))
        assert abs(sum(d['field'])-d['field_total'])<.021
        assert abs(sum(d['materials'])-d['materials_total'])<d.get('materials_reconciliation_tolerance',.031)
        if d['total'] is None:
            assert abs(d['field_total']+d['materials_total']-d['listed_cost_total'])<.011
            incomplete.append(dict(year=year,source='UNL',listed_cost_usd_ac=d['listed_cost_total'],total_cost_usd_ac=np.nan,cash_cost_usd_ac=np.nan,full_economic_account=False,note=d['reconciliation_note']))
            continue
        total=d['field_total']+d['materials_total']+sum(other.values())
        assert abs(total-d['total'])<.011
        cash=d['total']-other['land']-sum(d['field'][-2:]) if d.get('cash_defined',True) else np.nan
        review=next(r for r in reviewed if r['year']==year)
        discrepancy=np.isfinite(cash) and abs(cash/yield_by_year[year]-d['cash_per_bu'])>.005
        note=d.get('reconciliation_note','Line-item-derived cash cost; printed 2019 cash-per-bushel does not reconcile' if year==2019 else 'Cash-per-bushel agrees within rounding')
        reconciliation.append(dict(year=year,component_total_usd_ac=total,published_total_usd_ac=d['total'],difference_usd_ac=total-d['total'],field_rounding_usd_ac=sum(d['field'])-d['field_total'],materials_rounding_usd_ac=sum(d['materials'])-d['materials_total'],note=note))
        costs.append(dict(year=year,source='UNL',cash_cost_usd_ac=round(cash,2),total_cost_usd_ac=d['total'],
            operator_share=1.,reported_price_usd_bu=np.nan,sample_n=np.nan,geography=review.get('geography','Eastern Nebraska'),
            account='UNL total economic cost; cash excludes machinery ownership and real-estate opportunity',
            full_economic_account=True,source_file=f'unl_{year}.pdf',
            published_cash_usd_bu=d['cash_per_bu'],cash_rounding_discrepancy=bool(discrepancy),cash_note=note))
    pd.DataFrame(items).to_csv(out/'unl_line_items.csv',index=False)
    if policy!='exact':
        pd.DataFrame(incomplete).to_csv(out/'unl_incomplete_accounts.csv',index=False)
        pd.DataFrame(reconciliation).to_csv(out/'unl_cost_reconciliation.csv',index=False)
    ers=pd.read_csv(HERE/'sources/ers_corn.csv');ers['Item']=ers.Item.str.strip()
    ers=ers[ers.Year.isin(YEARS)&ers.Region.isin(['Heartland','Prairie Gateway','United States'])]
    ers.to_csv(out/'ers_annual_source_values.csv',index=False)
    for year in YEARS:
        q=ers[(ers.Year==year)&(ers.Region=='Heartland')].set_index('Item').Value
        if q.empty:continue
        assert abs(q['Total, operating costs']+q['Total, allocated overhead']-q['Total, costs listed'])<.031
        if year in enabled:
            costs.append(dict(year=year,source='ERS_Heartland',cash_cost_usd_ac=np.nan,total_cost_usd_ac=q['Total, costs listed'],
                operator_share=1.,reported_price_usd_bu=q['Price'],sample_n=np.nan,geography='ERS Heartland region; all production practices',
                account='Sector economic costs per planted acre; operating costs are not cash costs',full_economic_account=True,
                source_file='ers_corn.csv',operating_cost_usd_ac=q['Total, operating costs'],land_cost_usd_ac=q['Opportunity cost of land'],
                overhead_usd_ac=q['Total, allocated overhead'],cash_note='Unavailable: operating category excludes several cash overhead expenses'))
    fin=[];fin_reviews=[]
    for scope,report in [('county',1008338),('state',1008210)]:
        f=finbin(HERE/f'sources/finbin_{scope}_{report}.csv');f['scope']=scope;fin.append(f)
        for year in sorted(enabled):
            q=f[f.year==year].drop_duplicates('item').set_index('item').value
            required=['Total direct expenses per acre','Total overhead expenses per acre','Total dir & ovhd expenses per acre','Mach & bldg depreciation','Labor & management charge','Operators share of yield %','Value per bu.','Number of farms']
            usable=all(k in q and np.isfinite(q[k]) for k in required) and q.get('Number of farms',0)>0 and 0<q.get('Operators share of yield %',0)<=100
            fin_reviews.append(dict(year=year,scope=scope,report=report,calculation_enabled=bool(usable),sample_n=q.get('Number of farms',np.nan),status='complete reported account' if usable else 'unavailable or suppressed required values',practice='Corn enterprise; rainfed and tillage practice not verified',tenure='All tenures; operator share retained',geography='Gage, Johnson, Lancaster, Pawnee' if scope=='county' else 'Nebraska statewide'))
            if not usable:continue
            direct=q['Total direct expenses per acre'];overhead=q['Total overhead expenses per acre'];total=q['Total dir & ovhd expenses per acre']
            assert abs(direct+overhead-total)<.031
            costs.append(dict(year=year,source=f'FINBIN_{scope}',cash_cost_usd_ac=total-q['Mach & bldg depreciation'],
                total_cost_usd_ac=total+q['Labor & management charge'],operator_share=q['Operators share of yield %']/100,
                reported_price_usd_bu=q['Value per bu.'],sample_n=q['Number of farms'],
                geography='Gage, Johnson, Lancaster, Pawnee participating farms' if scope=='county' else 'Nebraska statewide participating farms',
                account='Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established',
                full_economic_account=False,source_file=f'finbin_{scope}_{report}.csv',
                cash_note='Direct plus overhead minus depreciation; conditional accounting cash margin; not whole-farm cash income'))
    pd.concat(fin).to_csv(out/'finbin_annual_source_values.csv',index=False)
    pd.DataFrame(fin_reviews).to_csv(out/'finbin_eligibility.csv',index=False)
    c=pd.DataFrame(costs)
    c['nass_price_usd_bu']=c.year.map({y:r['price_usd_bu'] for y,r in price_by_year.items()})
    c['cpi_u']=c.year.map({y:r['cpi_u'] for y,r in price_by_year.items()});c['to_2021_dollars']=270.970/c.cpi_u
    if policy!='exact':
        annotation=eligibility[['year','strict_eligible','match_designation','budget_number','title','mismatch_fields','selection_rationale']].rename(columns={'title':'selected_unl_system'})
        c=c.merge(annotation,on='year',validate='many_to_one')
        if c[['nass_price_usd_bu','cpi_u']].isna().any().any():raise ValueError('Annual price/inflation missing')
    c.to_csv(out/'economic_scenarios.csv',index=False)
    pd.DataFrame([{k:r[k] for k in ['year','price_usd_bu','file','page']} for r in prices if r['year'] in enabled]).assign(definition='Nebraska corn grain marketing-year average; finalized').to_csv(out/'nass_prices.csv',index=False)
    pd.DataFrame([dict(year=r['year'],cpi_u=r['cpi_u']) for r in prices if r['year'] in enabled]).assign(source_url='https://www.bls.gov/regions/mid-atlantic/data/consumerpriceindexannualandsemiannual_table.htm',definition='CPI-U U.S. city average, all items, annual, NSA; purchasing-power adjustment').to_csv(out/'deflator.csv',index=False)
    return c,eligibility

if __name__=='__main__':build(HERE/'tables')
