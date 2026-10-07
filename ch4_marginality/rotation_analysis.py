"""Incremental Colab analysis under the reviewed rotation-priority source policy.

Reuse is allowed only after all numerical input checksums pass. Unchanged
yield-only and 2019/2021 results are copied; newly enabled economic years are
calculated from the same native rasters. No budget yields replace modeled yields.
"""
from pathlib import Path
from datetime import datetime, timezone
import gc, json, shutil, sqlite3
import numpy as np
import pandas as pd
from .pipeline import (HERE, paths, read, sha, dump, boundaries, audit, grouped,
                       cog, SOIL_RUN, TRANSFORM, SHAPE, SCENARIOS, summary)
from .core import economic, quartile, spatial_association, SENSITIVITIES, ACRES_PER_HA, SEED
from .prepare_budgets import build
from .release_context import ROTATION_RELEASE

PRIOR_BASE='20260928_corefilter_exact_year_v2'

def run(root):
    root=Path(root);prior=root/'CH4_marginality'/PRIOR_BASE
    release=root/'CH4_marginality'/ROTATION_RELEASE;out=release/'analysis'
    out.mkdir(parents=True,exist_ok=True)
    for name in ['tables','rasters','sources','logs','figures','app_assets']:(out/name).mkdir(exist_ok=True)
    if not json.loads((prior/'validation.json').read_text())['verified']:raise ValueError('Prior base not verified')
    # Audit current native products BEFORE copying any numerical result.
    inventory=pd.DataFrame(audit(root,out))
    old_inv=pd.read_csv(prior/'tables/input_inventory.csv')
    for key in ['sha256','mask_sha256','index_sha256']:
        if not inventory[key].equals(old_inv[key]):raise ValueError('Numerical input changed; incremental reuse prohibited')
    prior_lock=json.loads((root/'CH4_marginality/20260929_profit_app_v1/input_manifest.json').read_text())
    for item in prior_lock['files']:
        if item['role'] in ['patch_geometry','NCCPI','AOI','county','supersession_manifest','supersession_record']:
            if sha(root.parent/item['logical_path'])!=item['sha256']:raise ValueError('Changed spatial source prohibits incremental reuse: '+item['logical_path'])
    original_cost=pd.read_csv(prior/'tables/economic_scenarios.csv',float_precision='round_trip')
    cost,elig=build(out/'tables',policy='closest_rotation')
    keys=['year','source'];numeric=['cash_cost_usd_ac','total_cost_usd_ac','operator_share','nass_price_usd_bu','cpi_u','to_2021_dollars']
    np.testing.assert_allclose(cost[cost.year.isin([2019,2021])].set_index(keys).sort_index()[numeric],
                               original_cost.set_index(keys).sort_index()[numeric],rtol=0,atol=0,equal_nan=True)
    shutil.copytree(HERE/'sources',out/'sources',dirs_exist_ok=True)
    for p in (prior/'rasters').glob('*.tif'):
        dest=out/'rasters'/p.name
        if not dest.exists():shutil.copy2(p,dest)
        if sha(dest)!=sha(p):raise ValueError('Reused raster altered')
    for name in ['annual_yield.csv','common_valid_yield.csv','quartile_transitions.csv',
                 'persistence_M1_fixed.csv','persistence_M2_HI_sensitivity.csv']:
        shutil.copy2(prior/'tables'/name,out/'tables'/name)
    for name in ['CH4_spatial.gpkg','ee_ingestion_verification.json']:
        if not (out/name).exists():shutil.copy2(prior/name,out/name)
    shutil.copy2(prior/'app_assets/ch4_verified_yields_corefilter_20260928.tif',out/'app_assets/ch4_verified_yields_corefilter_20260928.tif')
    shutil.copy2(prior/'app_assets/ch4_finbin_county_scope_corefilter_20260928.tif',out/'app_assets/ch4_finbin_county_scope_corefilter_20260928.tif')
    county,zones=boundaries(root,out);soil=read(root/SOIL_RUN/'rasters/nccpi_corn_v3.tif')
    old={k:pd.read_csv(prior/'tables'/f'{k}.csv',float_precision='round_trip') for k in
         ['sensitivity','nccpi_associations','patch_statistics','county_statistics']}
    checkpoints=out/'logs/checkpoints';checkpoints.mkdir(exist_ok=True)
    economic_years=sorted(set(cost.year)-{2019,2021})
    for year in economic_years:
      for scenario in SCENARIOS:
        stem=f'{year}_{scenario}';marker=checkpoints/f'{stem}.json'
        if marker.exists():
            print('Verified checkpoint',stem,flush=True)
            for item in json.loads(marker.read_text())['files']:
                if sha(checkpoints/item['file'])!=item['sha256']:raise ValueError('Checkpoint altered')
            continue
        print('Rotation-priority economics',year,scenario,flush=True)
        yp,mp,ip=paths(root,year,scenario);y=read(yp);crop=read(mp)==1
        ix=np.nan_to_num(read(ip)).astype('int32');valid=crop&np.isfinite(y)&(y>=0);y[~valid]=np.nan
        cutoff,q=quartile(y)
        old_cut=pd.read_csv(prior/'tables/annual_yield.csv',float_precision='round_trip').query('year==@year and scenario==@scenario').cutoff_Mg_ha.item()
        if cutoff!=old_cut:raise ValueError('Quartile ties/cutoff changed')
        meta=dict(year=year,scenario=scenario,experimental=False)
        sensitivity=[];patches=[];counties=[];associations=[]
        for c in cost[cost.year==year].to_dict('records'):
            source=c['source'];domain=np.isin(zones,county[county.NAME.isin(['Gage','Johnson','Lancaster','Pawnee'])].zone) if source=='FINBIN_county' else np.ones(SHAPE,bool)
            scope=valid&domain;scrop=crop&domain;sy=np.where(scope,y,np.nan)
            for pf,cf in SENSITIVITIES:
                e=economic(sy,c['nass_price_usd_bu'],c['cash_cost_usd_ac'],c['total_cost_usd_ac'],eligible=True,
                           price_factor=pf,cost_factor=cf,operator_share=c['operator_share'])
                ret=e['total_return'];loss=e['loss'];v=ret[scope];factor=c['to_2021_dollars']
                sensitivity.append(dict(**meta,source=source,full_economic_account=c['full_economic_account'],price_factor=pf,cost_factor=cf,
                    valid_ha=scope.sum()*.09,loss_ha=np.nansum(loss)*.09,quartile_ha=np.nansum(q[scope])*.09,
                    both_ha=((loss==1)&(q==1)).sum()*.09,disagree_ha=(scope&((loss==1)!=(q==1))).sum()*.09,
                    mean_return_usd_ac=np.nanmean(v),mean_return_2021usd_ac=np.nanmean(v)*factor,
                    total_return_usd=np.nansum(v)*.09*ACRES_PER_HA,total_return_2021usd=np.nansum(v)*.09*ACRES_PER_HA*factor,
                    mean_revenue_usd_ac=np.nanmean(e['revenue'][scope]),
                    mean_cash_margin_usd_ac=float(np.nanmean(e['cash_margin'][scope])) if np.isfinite(e['cash_margin'][scope]).any() else np.nan,
                    breakeven_bu_ac=e['breakeven_bu_ac'],breakeven_Mg_ha=e['breakeven_Mg_ha'],
                    return_p05=np.quantile(v,.05),return_median=np.median(v),return_p95=np.quantile(v,.95)))
                cog(out/f'rasters/loss_{stem}_{source}_p{pf:.2f}_c{cf:.2f}.tif',loss,
                    '1 = negative selected-source account return; rotation-priority approximation, never observed profit')
                if pf==cf==1:
                    for metric in ['revenue','cash_margin','total_return']:
                        cog(out/f'rasters/{metric}_{stem}_{source}.tif',e[metric],f'{metric}; nominal USD/acre; {source}; {c["match_designation"]} UNL anchor')
                    cog(out/f'rasters/overlap_{stem}_{source}.tif',np.where(scope,q+2*loss,np.nan),'0 neither; 1 quartile only; 2 loss only; 3 both')
                    ep=grouped(ix,scrop,scope,y,q,ret,e['cash_margin'],e['revenue']).assign(**meta,source=source)
                    ec=grouped(zones,scrop,scope,y,q,ret,e['cash_margin'],e['revenue']).assign(**meta,source=source)
                    for frame in [ep,ec]:
                        for col in ['return_usd_ac_mean','return_usd_ac_sum_usd','cash_margin_usd_ac_mean','revenue_usd_ac_mean']:
                            frame[col+'_2021dollars']=frame[col]*factor
                        np.testing.assert_allclose(frame.return_usd_ac_sum_usd.sum(),sensitivity[-1]['total_return_usd'],atol=.01,rtol=0)
                    patches.append(ep.rename(columns={'zone':'patch_id'}));counties.append(ec.merge(county[['zone','GEOID','NAME']],on='zone',how='left'))
                    cp=scope&np.isfinite(soil);rr,cc=np.where(cp);east=TRANSFORM.c+(cc+.5)*30;north=TRANSFORM.f-(rr+.5)*30
                    for metric,a in [('source_return',ret),('economic_loss',loss)]:
                        for block in [5000,10000,20000]:
                            associations.append(dict(**meta,source=source,metric=metric,**spatial_association(soil[cp],a[cp],east,north,block)))
                del e,ret,loss
        for k,values in [('sensitivity',pd.DataFrame(sensitivity)),('patch_statistics',pd.concat(patches)),
                         ('county_statistics',pd.concat(counties)),('nccpi_associations',pd.DataFrame(associations))]:
            values.to_csv(checkpoints/f'{stem}_{k}.csv',index=False)
        files=[dict(file=p.name,sha256=sha(p)) for p in sorted(checkpoints.glob(f'{stem}_*.csv'))]
        dump(marker,dict(year=year,scenario=scenario,files=files));del y,ix,crop,q;gc.collect()
    for k,frame in old.items():
        parts=[pd.read_csv(p,float_precision='round_trip') for p in sorted(checkpoints.glob(f'*_{k}.csv'))]
        result=pd.concat([frame]+parts,ignore_index=True)
        result.to_csv(out/'tables'/f'{k}.csv',index=False)
    # Bit-identical numeric records for the retained experimental/2019 results.
    retained=[]
    for k,frame in old.items():
        new=pd.read_csv(out/'tables'/f'{k}.csv',float_precision='round_trip')
        head=new.iloc[:len(frame)]
        pd.testing.assert_frame_equal(frame,head,check_dtype=False,check_exact=True)
        retained.append(dict(table=k,rows=len(frame),numeric_records_unchanged=True))
    dump(out/'reuse_verification.json',dict(verified=True,prior_run=PRIOR_BASE,retained_tables=retained,
         native_inputs_unchanged=True,seed=SEED,bootstrap_replicates=1999))
    with sqlite3.connect(out/'CH4_spatial.gpkg') as con:
        pd.read_csv(out/'tables/patch_statistics.csv').to_sql('patch_statistics',con,index=False,if_exists='replace')
        pd.read_csv(out/'tables/county_statistics.csv').to_sql('county_statistics',con,index=False,if_exists='replace')
    from .rotation_temporal import run as temporal
    temporal(out)
    from .final_checks import verify
    verify(out)
    dump(out/'status.json',dict(status='analysis_complete',policy='closest_rotation',economic_years=sorted(set(cost.year)),
         blocked_years=[2003,2005,2007],partial_unl_years=[2009],experimental_year=2021,completed_utc=datetime.now(timezone.utc).isoformat()))
    return out
