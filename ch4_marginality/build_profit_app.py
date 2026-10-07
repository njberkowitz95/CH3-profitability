"""Compile the CH4 workspace only from reconciled and freshly checked evidence."""
from pathlib import Path
import json
from .pipeline import sha,dump
from .profit_workspace import RUN_ID,BASE_ID,lock_inputs

def compile_source(data):
    """Compile a copied, reconciled payload; callers verify source freshness."""
    import copy
    data=copy.deepcopy(data)
    # Earth Engine script storage is limited to 512 KiB. Embed only columns
    # read by the UI, with a lossless columnar transport; full evidence stays
    # in the versioned CSVs. No rounding or aggregation changes are applied.
    identity=['year','scenario','source','price_factor','cost_factor']
    columns_by_table={
        'counties':identity+['NAME','crop_ha','valid_ha','return_usd_ac_mean','return_usd_ac_sum_usd','economic_loss_ha'],
        'sensitivity':identity+['valid_ha','loss_ha','quartile_ha','both_ha','disagree_ha','mean_return_usd_ac','total_return_usd','mean_revenue_usd_ac','mean_cash_margin_usd_ac','breakeven_bu_ac','breakeven_Mg_ha','return_p05','return_median','return_p95'],
        'distributions':identity+['metric','basis','counts'],
        'associations':['year','scenario','source','metric','n','r','ci_low','ci_high','block_m']}
    if data.get('budget_policy')=='closest_rotation':
        data['evidence_asset']=data['patch_index_asset'].removesuffix('_index')+'_evidence'
    for key,columns in columns_by_table.items():
        rows=data[key]
        if rows and not isinstance(rows[0],dict):
            old=data.get(key+'_columns',data.get('county_columns'))
            rows=[dict(zip(old,row)) for row in rows]
        if key=='associations':
            enabled={r['year'] for r in data['eligibility'] if r['eligible']}
            rows=[r for r in rows if r['block_m']==10000 and r['year'] in enabled]
        if data.get('budget_policy')=='closest_rotation' and key in ('counties','distributions','associations'):
            rows=[]
        data[key+'_columns']=columns
        data[key]=[[r.get(k) for k in columns] for r in rows]
    data.pop('county_columns',None)
    if data.get('budget_policy')=='closest_rotation':
        data['annual']=[{k:r[k] for k in ['year','scenario','cutoff_Mg_ha','crop_ha','valid_ha','missing_ha']} for r in data['annual']]
        used=['year','source','cash_cost_usd_ac','total_cost_usd_ac','operator_share','nass_price_usd_bu','to_2021_dollars','geography','account','sample_n','full_economic_account']
        data['costs']=[{k:r.get(k) for k in used} for r in data['costs']]
        for cost in data['costs']:
            if cost['source']=='UNL' and cost['cash_cost_usd_ac'] is None:
                cost['account']='UNL published total economic cost; cash and ownership/opportunity categories are not separable in this publication'
    original=(Path(__file__).parent/'rollback/gee_app_Yield_PEM_pre_CH4.js').read_text(encoding='utf8')
    # Keep individual evidence records on separate lines. A single 800 kB
    # editor line stalls Ace's highlighting and the Code Editor on paste/run.
    encode=lambda value:json.dumps(value,allow_nan=False,separators=(',',':'))
    payload='{\n'+',\n'.join(encode(key)+':'+('[\n'+',\n'.join(encode(row) for row in value)+'\n]' if isinstance(value,list) else encode(value)) for key,value in data.items())+'\n}'
    script=original+'\nvar CH4_DATA = '+payload+';\n'+(Path(__file__).parent/'gee_profit_controls.js').read_text(encoding='utf8')
    encoded=script.encode('utf8')
    if len(encoded)>=512*1024:
        raise ValueError('Candidate exceeds Earth Engine script storage limit')
    return encoded

def build(root,require_assets=True):
    root=Path(root);out=root/'CH4_marginality'/RUN_ID;package=Path(__file__).parent
    assert json.loads((out/'validation.json').read_text())['verified']
    lock_inputs(root,root/'CH4_marginality'/BASE_ID,out,json.loads((out/'input_manifest.json').read_text()))
    if require_assets:
        assert json.loads((out/'asset_verification.json').read_text())['verified']
        assert json.loads((out/'profit_pixel_verification.json').read_text())['verified']
    data=json.loads((out/'app_data_profit.json').read_text())
    encoded=compile_source(data)
    dest=package.parent/'csp3_maize_gpp/gee_app_Yield_PEM.js'
    dest.parent.mkdir(parents=True,exist_ok=True)
    # Byte-identical builds across Windows and the Linux Colab runtime.
    dest.write_bytes(encoded);(out/'gee_app_Yield_PEM_profit.js').write_bytes(encoded)
    dump(out/'app_build_verification.json',dict(input_manifest_sha256=sha(out/'input_manifest.json'),script_sha256=sha(dest),assets_verified=require_assets))
    print(dest,flush=True)
    return dest

if __name__=='__main__':
    import sys
    args=[x for x in sys.argv[1:] if not x.startswith('--')]
    build(args[0] if args else 'G:/My Drive/PHD/CSP3_GPP_outputs', '--preview' not in sys.argv)
