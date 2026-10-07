"""Build an editor preview from verified inputs; compare with Colab before publishing."""
from pathlib import Path
import json
import numpy as np
import pandas as pd
from .pipeline import paths,read,YEARS,SCENARIOS
from .core import MGHA_PER_BUAC,SENSITIVITIES
from .prepare_budgets import build
from .final_checks import records

def run(root,out):
    root,out=Path(root),Path(out)
    cost,eligibility=build(Path(__file__).parent/'tables')
    scope=read(out/'app_assets/ch4_finbin_county_scope_corefilter_20260928.tif')==1
    annual=[];sensitivity=[]
    for year in YEARS:
        crop=read(paths(root,year,SCENARIOS[0])[1])==1
        for scenario in SCENARIOS:
            image=read(paths(root,year,scenario)[0]);valid=crop&np.isfinite(image)&(image>=0)
            assert valid.sum()==(np.isfinite(image)&(image>=0)).sum(),'Uploaded yield contains crop-mask-excluded pixels'
            v=image[valid].astype(float);cut=float(np.quantile(v,.25));q=v<=cut
            annual.append(dict(year=year,scenario=scenario,n=len(v),mean=float(v.mean()),valid_ha=len(v)*.09,
                quartile_ha=q.sum()*.09,quartile_percent=q.mean()*100,cutoff_Mg_ha=cut))
            for c in cost[cost.year==year].to_dict('records'):
                selected=scope[valid] if c['source']=='FINBIN_county' else np.ones(len(v),bool)
                vs=v[selected];qs=q[selected]
                for pf,cf in SENSITIVITIES:
                    revenue=vs/MGHA_PER_BUAC*c['nass_price_usd_bu']*pf*c['operator_share']
                    returns=revenue-c['total_cost_usd_ac']*cf;loss=returns<0
                    sensitivity.append(dict(year=year,scenario=scenario,source=c['source'],price_factor=pf,cost_factor=cf,
                        valid_ha=len(vs)*.09,loss_ha=loss.sum()*.09,quartile_ha=qs.sum()*.09,both_ha=(qs&loss).sum()*.09,
                        disagree_ha=(qs!=loss).sum()*.09,mean_return_usd_ac=returns.mean(),mean_return_2021usd_ac=returns.mean()*c['to_2021_dollars']))
            print(year,scenario,flush=True)
    data={'years':list(YEARS),'mgha_per_buac':MGHA_PER_BUAC,'asset':'projects/ee-njberkowitz95/assets/ch4_verified_yields_corefilter_20260928',
          'county_scope_asset':'projects/ee-njberkowitz95/assets/ch4_finbin_county_scope_corefilter_20260928','annual':records(pd.DataFrame(annual)),
          'sensitivity':records(pd.DataFrame(sensitivity)),'costs':records(cost),'eligibility':records(eligibility)}
    (out/'app_data_candidate.json').write_text(json.dumps(data,indent=2,allow_nan=False))
    package=Path(__file__).parent
    source=(package/'rollback/gee_app_Yield_PEM_pre_CH4.js').read_text(encoding='utf8')
    source+='\nvar CH4_DATA = '+json.dumps(data,allow_nan=False)+';\n'+(package/'gee_controls.js').read_text(encoding='utf8')
    (package/'gee_app_candidate.js').write_text(source,encoding='utf8')
    return data

if __name__=='__main__':
    import sys
    run(sys.argv[1],sys.argv[2])
