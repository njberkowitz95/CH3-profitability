"""Check completed 2019/2021 native output pixels independently against inputs."""
from pathlib import Path
import numpy as np
import pandas as pd
import rasterio
from ch4_marginality.pipeline import paths,read,SHAPE,TRANSFORM,dump
from ch4_marginality.core import MGHA_PER_BUAC,SCENARIOS
from .pipeline import SOURCE_RELEASE


def run(root: Path, out: Path) -> dict:
    root,out=Path(root),Path(out)
    costs=pd.read_csv(out/'tables/economic_scenarios.csv',float_precision='round_trip')
    scope=read(root/'CH4_marginality'/SOURCE_RELEASE/'analysis/app_assets/ch4_finbin_county_scope_corefilter_20260928.tif')==1
    checks=[]
    for year in [2019,2021]:
        for scenario in SCENARIOS:
            y=read(paths(root,year,scenario)[0]).astype(float)
            crop=read(paths(root,year,scenario)[1])==1
            for c in costs[costs.year==year].to_dict('records'):
                valid=crop&np.isfinite(y)&(y>=0)
                if c['source']=='FINBIN_county':valid&=scope
                selected=[]
                for mask in [valid,crop&~valid,~crop]:
                    flat=np.flatnonzero(mask)
                    if len(flat):selected.extend(flat[np.linspace(0,len(flat)-1,9,dtype=int)].tolist())
                rr,cc=np.unravel_index(selected,SHAPE)
                points=[(TRANSFORM.c+(int(col)+.5)*30,TRANSFORM.f-(int(row)+.5)*30) for row,col in zip(rr,cc)]
                revenue=y[rr,cc]/MGHA_PER_BUAC*c['nass_price_usd_bu']*c['operator_share']
                profit=revenue-c['total_cost_usd_ac']
                stem=f"{year}_{scenario}_{c['source']}"
                for metric,expected in [('profit',profit),('revenue',revenue),('cash_margin',revenue-c['cash_cost_usd_ac'])]:
                    for basis,factor in [('nominal',1),('2021',c['to_2021_dollars'])]:
                        with rasterio.open(out/f'rasters/{metric}_{stem}_{basis}.tif') as src:
                            assert src.crs.to_epsg()==5070 and src.transform==TRANSFORM and src.shape==SHAPE
                            assert src.tags(ns='IMAGE_STRUCTURE').get('LAYOUT')=='COG'
                            values=np.array([r[0] for r in src.sample(points)])
                            target=np.where(valid[rr,cc]&np.isfinite(expected),expected*factor,src.nodata)
                            np.testing.assert_allclose(values,target,rtol=0,atol=1e-9)
                with rasterio.open(out/f'rasters/profit_class_{stem}_p1.00_c1.00.tif') as src:
                    values=np.array([r[0] for r in src.sample(points)])
                    target=np.where(valid[rr,cc],np.sign(profit),-128)
                    np.testing.assert_array_equal(values,target)
                checks.append(dict(year=year,scenario=scenario,source=c['source'],pixels=len(selected),missing_and_noncrop_tested=True,verified=True))
    result=dict(verified=True,checks=checks,interpretation='Numerical consistency checks, not independent producer-level validation')
    dump(out/'verification/local_native_pixels.json',result)
    return result
