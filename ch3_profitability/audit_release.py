"""Independent table and provenance gates before Chapter 3 publication."""
from pathlib import Path
import hashlib
import json
import numpy as np
import pandas as pd
from ch4_marginality.pipeline import sha,dump


def run(out: Path) -> dict:
    out=Path(out)
    validation=json.loads((out/'validation.json').read_text())
    if not validation['verified'] or not validation['colab_execution']:
        raise ValueError('Completed Colab calculation is required')
    a=pd.read_csv(out/'tables/aoi_sensitivity.csv',float_precision='round_trip')
    keys=['year','scenario','source','price_factor','cost_factor']
    if a.duplicated(keys).any():raise ValueError('Duplicate annual combination')
    costs=pd.read_csv(out/'tables/economic_scenarios.csv')
    if len(a)!=len(costs)*2*9:raise ValueError('Missing model/source/sensitivity combinations')
    if set(a.year)&{2003,2005,2007}:raise ValueError('Blocked year enabled')
    if ((a.year==2009)&(a.source=='UNL')).any():raise ValueError('Incomplete UNL account enabled')
    expected=a.set_index(keys).sort_index()
    fields=['valid_ha','profitable_ha','breakeven_ha','loss_ha','profit_total_usd']
    np.testing.assert_allclose(a.profitable_ha+a.breakeven_ha+a.loss_ha,a.valid_ha,rtol=0,atol=1e-7)
    county=pd.read_csv(out/'tables/county_sensitivity.csv')
    c=county.groupby(keys)[fields].sum(min_count=1).sort_index()
    np.testing.assert_allclose(c,expected[fields],rtol=1e-12,atol=.01)
    patch_parts=[]
    for chunk in pd.read_csv(out/'tables/patch_sensitivity.csv.gz',usecols=keys+fields,chunksize=100000):
        patch_parts.append(chunk.groupby(keys)[fields].sum(min_count=1))
    p=pd.concat(patch_parts).groupby(level=list(range(len(keys))))[fields].sum(min_count=1).sort_index()
    np.testing.assert_allclose(p,expected[fields],rtol=1e-12,atol=.01)
    bins=pd.read_csv(out/'tables/distribution_bins.csv')
    totals=bins.groupby(keys+['metric','basis']).area_ha.sum(min_count=1)
    for index,value in totals.items():
        row=expected.loc[index[:5]]
        if index[5]=='cash' and pd.isna(row.cash_margin_mean_usd_ac):
            if pd.notna(value):raise ValueError('Missing cash histogram became a zero')
        else:np.testing.assert_allclose(value,row.valid_ha,rtol=0,atol=1e-7)
    common=pd.read_csv(out/'tables/common_valid_profit.csv')
    transitions=pd.read_csv(out/'tables/profit_transitions.csv')
    if (common.year==2021).any() or (transitions.to_year==2021).any():raise ValueError('Experimental year in primary temporal results')
    if ((transitions.to_year-transitions.from_year)!=2).any():raise ValueError('Transition bridges a gap')
    np.testing.assert_allclose(common.profitable_ha+common.breakeven_ha+common.loss_ha,common.common_ha,atol=1e-7)
    frozen=json.loads((out/'code_manifest.json').read_text())
    for row in frozen:
        if sha(out/'code'/row['file'])!=row['sha256']:raise ValueError('Executed code changed')
    notebook=json.loads((out/'CH3_Profitability_executed.ipynb').read_text())
    code=[c for c in notebook['cells'] if c['cell_type']=='code']
    if any(c.get('execution_count') is None for c in code):raise ValueError('Notebook execution incomplete')
    if any(o.get('output_type')=='error' for c in code for o in c.get('outputs',[])):
        raise ValueError('Executed notebook contains an error')
    frozen_hash=hashlib.sha256(json.dumps(frozen,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    result=dict(verified=True,economic_combinations=len(a),baseline_combinations=int(((a.price_factor==1)&(a.cost_factor==1)).sum()),
                spatial_levels_reconciled=True,histogram_tails_reconciled=True,missing_cash_retained=True,
                temporal_gaps_and_experimental_exclusion_verified=True,executed_code_manifest_sha256=frozen_hash,
                method_provenance='Frozen code/ package and code_manifest.json; publication helpers are separately versioned')
    dump(out/'verification/release_audit.json',result)
    return result
