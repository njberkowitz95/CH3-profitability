"""Economic temporal summaries with explicit observation gaps and valid support."""
from pathlib import Path
import gc
import numpy as np
import pandas as pd
from .pipeline import read, cog, summary, SHAPE, SCENARIOS
from .core import ACRES_PER_HA

def run(out):
    out=Path(out);cost=pd.read_csv(out/'tables/economic_scenarios.csv')
    transitions=[];gaps=[];persistence=[];common_rows=[]
    for source,c in cost[cost.year<2021].groupby('source'):
      years=sorted(c.year.unique())
      for scenario in SCENARIOS:
        count=np.zeros(SHAPE,'uint8');frequency=np.zeros(SHAPE,'uint8');common=np.ones(SHAPE,bool)
        previous=None
        for year in years:
            loss=read(out/f'rasters/loss_{year}_{scenario}_{source}_p1.00_c1.00.tif')
            valid=np.isfinite(loss);common&=valid;count+=valid.astype('uint8');frequency+=(valid&(loss==1)).astype('uint8')
            if previous is not None:
                py,pl,pv=previous
                if year-py==2:
                    keep=pv&valid
                    for a,b in [(0,0),(0,1),(1,0),(1,1)]:
                        transitions.append(dict(source=source,scenario=scenario,from_year=py,to_year=year,interval_years=2,
                            from_class=a,to_class=b,pair_common_ha=keep.sum()*.09,transition_ha=(keep&(pl==a)&(loss==b)).sum()*.09,
                            budget_system_change=year in (2017,2019),source_change_caveat=year==2019))
                else:gaps.append(dict(source=source,scenario=scenario,from_year=py,to_year=year,interval_years=int(year-py),status='No biennial transition estimated across unavailable observations'))
            previous=(year,loss,valid)
        stem=f'{scenario}_{source}'
        cog(out/f'rasters/economic_observed_seasons_{stem}.tif',np.where(count>0,count,np.nan),'Number of eligible source-valid primary observations; 2021 excluded')
        cog(out/f'rasters/economic_loss_frequency_{stem}.tif',np.divide(frequency,count,out=np.full(SHAPE,np.nan),where=count>0),'Negative-return frequency among observed eligible primary years; gaps retained')
        cog(out/f'rasters/economic_common_valid_{stem}.tif',np.where(count>0,common.astype(float),np.nan),'Common-valid domain across available primary source years; unavailable years excluded and listed')
        for n in range(1,len(years)+1):
            for f in range(n+1):persistence.append(dict(source=source,scenario=scenario,available_years=';'.join(map(str,years)),observed_seasons=n,loss_seasons=f,area_ha=((count==n)&(frequency==f)).sum()*.09))
        for year in years:
            ret=read(out/f'rasters/total_return_{year}_{scenario}_{source}.tif')[common]
            factor=c.loc[c.year==year,'to_2021_dollars'].item();stats=summary(ret)
            common_rows.append(dict(year=int(year),source=source,scenario=scenario,available_years=';'.join(map(str,years)),
                common_ha=common.sum()*.09,loss_ha=(ret<0).sum()*.09,total_return_usd=ret.sum(dtype='float64')*.09*ACRES_PER_HA if ret.size else np.nan,
                total_return_2021usd=ret.sum(dtype='float64')*.09*ACRES_PER_HA*factor if ret.size else np.nan,
                mean_return_2021usd_ac=stats['mean']*factor,**stats,experimental=False))
        del loss,count,frequency,common,previous;gc.collect()
    for _,g in pd.DataFrame(transitions).groupby(['source','scenario','from_year','to_year']):
        np.testing.assert_allclose(g.transition_ha.sum(),g.pair_common_ha.iloc[0],rtol=0,atol=1e-7)
    for name,rows in [('economic_transitions',transitions),('economic_transition_gaps',gaps),('economic_persistence',persistence),('economic_common_valid',common_rows)]:
        pd.DataFrame(rows).to_csv(out/'tables'/f'{name}.csv',index=False)
