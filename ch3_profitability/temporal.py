"""Baseline profit persistence and three-state transitions on explicit support."""
from pathlib import Path
import numpy as np
import pandas as pd
import rasterio
from ch4_marginality.core import SCENARIOS, ACRES_PER_HA
from ch4_marginality.pipeline import SHAPE
from .core import CLASS_NODATA, CLASSES, transition_counts


def load_class(path: Path) -> np.ndarray:
    """Read categorical nodata without converting it to a zero-return observation."""
    with rasterio.open(path) as src:
        return src.read(1)


def run(out: Path) -> None:
    """Primary temporal statistics exclude 2021 and never bridge unavailable years."""
    from .pipeline import write_cog
    costs = pd.read_csv(out/'tables/economic_scenarios.csv')
    transitions, gaps, persistence, commons = [], [], [], []
    for policy in ['closest_rotation','exact']:
      selected = costs[(costs.year < 2021) & ((costs.strict_eligible) if policy == 'exact' else True)]
      for source, accounts in selected.groupby('source'):
        years = sorted(accounts.year.unique())
        for scenario in SCENARIOS:
            count = np.zeros(SHAPE,'uint8'); positive = count.copy(); zero = count.copy()
            common = np.ones(SHAPE,bool); previous = None
            for year in years:
                a = load_class(out/f'rasters/profit_class_{year}_{scenario}_{source}_p1.00_c1.00.tif')
                valid = a != CLASS_NODATA; count += valid; positive += a == 1; zero += a == 0; common &= valid
                if previous is not None:
                    py, pa = previous
                    meta = dict(policy=policy, source=source, scenario=scenario, from_year=py,to_year=year,
                                budget_system_change=year in [2017,2019],source_change_caveat=year == 2019)
                    if year-py == 2:
                        rows = transition_counts(pa,a,int(py),int(year))
                        np.testing.assert_allclose(sum(r['transition_ha'] for r in rows),rows[0]['pair_common_ha'],atol=1e-7)
                        transitions.extend(dict(**meta,**r) for r in rows)
                    else: gaps.append(dict(**meta,status='No transition across unavailable years'))
                previous = (year,a)
            stem = f'{scenario}_{source}_{policy}'
            write_cog(out/f'rasters/observed_seasons_{stem}.tif',np.where(count>0,count,np.nan),'Eligible observed primary seasons; 2021 excluded')
            for label, frequency in [('profitable',positive),('breakeven',zero),('loss',count-positive-zero)]:
                f = np.divide(frequency,count,out=np.full(SHAPE,np.nan),where=count>0)
                write_cog(out/f'rasters/{label}_frequency_{stem}.tif',f,'Fraction of observed eligible seasons; not a predictive probability')
                for n in range(1,len(years)+1):
                    for k in range(n+1):
                        persistence.append(dict(policy=policy,source=source,scenario=scenario,class_label=label,
                            available_years=';'.join(map(str,years)),observed_seasons=n,class_seasons=k,
                            area_ha=int(((count==n)&(frequency==k)).sum())*.09))
            write_cog(out/f'rasters/common_valid_{stem}.tif',np.where(count>0,common.astype(float),np.nan),'Intersection across available primary source years')
            for year in years:
                with rasterio.open(out/f'rasters/profit_{year}_{scenario}_{source}_nominal.tif') as src:
                    v=src.read(1,masked=True).filled(np.nan)[common]
                factor=accounts.loc[accounts.year==year,'to_2021_dollars'].item()
                commons.append(dict(policy=policy,source=source,scenario=scenario,year=year,
                    common_ha=int(common.sum())*.09, available_years=';'.join(map(str,years)),
                    profitable_ha=int((v>0).sum())*.09,breakeven_ha=int((v==0).sum())*.09,loss_ha=int((v<0).sum())*.09,
                    mean_profit_usd_ac=float(v.mean()) if len(v) else np.nan,
                    mean_profit_2021usd_ac=float(v.mean()*factor) if len(v) else np.nan,
                    total_profit_usd=float(v.sum()*.09*ACRES_PER_HA) if len(v) else np.nan))
    for name, data in [('profit_transitions',transitions),('transition_gaps',gaps),('profit_persistence',persistence),('common_valid_profit',commons)]:
        pd.DataFrame(data).to_csv(out/'tables'/f'{name}.csv',index=False)
