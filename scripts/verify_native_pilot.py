"""Read-only representative full-year check against retained Chapter 4 totals."""
from pathlib import Path
import numpy as np
import pandas as pd
from ch4_marginality.pipeline import paths,read
from ch3_profitability.core import summarize_groups

root=Path('G:/My Drive/PHD/CSP3_GPP_outputs')
base=root/'CH4_marginality/20260929_rotation_priority_budget_v1/analysis'
accounts=pd.read_csv(base/'tables/economic_scenarios.csv',float_precision='round_trip')
account=accounts[(accounts.year==2019)&(accounts.source=='UNL')].iloc[0].to_dict()
yp,mp,ip=paths(root,2019,'M1_fixed')
crop=read(mp)==1;y=read(yp)[crop].astype(float)
v=np.isfinite(y)&(y>=0);q=y<=np.quantile(y[v],.25)
got=summarize_groups(np.ones(len(y),dtype=int),y,v,q,account,1,1).iloc[0]
old=pd.read_csv(base/'tables/sensitivity.csv',float_precision='round_trip')
old=old[(old.year==2019)&(old.source=='UNL')&(old.scenario=='M1_fixed')&(old.price_factor==1)&(old.cost_factor==1)].iloc[0]
np.testing.assert_allclose(got.profit_mean_usd_ac,old.mean_return_usd_ac,atol=1e-9,rtol=1e-12)
np.testing.assert_allclose(got.profit_total_usd,old.total_return_usd,atol=.01,rtol=1e-12)
print(got[['profit_mean_usd_ac','profitable_ha','breakeven_ha','loss_ha','valid_ha']].to_string())
