"""Compare native Earth Engine currency layers with deterministic raster samples."""
from pathlib import Path
import json
import numpy as np
import ee
from ch4_marginality.pipeline import read,paths,TRANSFORM,YEARS,SCENARIOS,sha,dump
from ch4_marginality.core import MGHA_PER_BUAC
from .pipeline import RUN_ID,SOURCE_RELEASE
from .core import classify

def run(root):
    root=Path(root);out=root/'CH3_profitability'/RUN_ID;prior=root/'CH4_marginality'/SOURCE_RELEASE;base=prior/'analysis'
    ee.Initialize(project='ee-njberkowitz95')
    data=json.loads((prior/'app_data_profit.json').read_text());scope=read(base/'app_assets/ch4_finbin_county_scope_corefilter_20260928.tif')==1
    for name in ('ch4_verified_yields_corefilter_20260928','ch4_finbin_county_scope_corefilter_20260928'):
        asset=ee.data.getAsset('projects/ee-njberkowitz95/assets/'+name)
        assert asset['properties']['source_sha256']==sha(base/'app_assets'/f'{name}.tif'),'Earth Engine input asset was replaced'
    snapshots=[]
    for task in json.loads((prior/'asset_tasks.json').read_text()):
        asset=ee.data.getAsset(task['asset'])
        assert asset['properties']['source_sha256']==task['sha256'],'Reused identity/geometry asset was replaced'
        snapshots.append(dict(asset=task['asset'],metadata=asset))
    dump(out/'reused_asset_manifest.json',snapshots)
    checks=[];sentinel=-1e12;grid=list(TRANSFORM)[:6]
    for year in sorted({c['year'] for c in data['costs']}):
        for scenario in SCENARIOS:
            y=read(paths(root,year,scenario)[0]).astype(float);crop=read(paths(root,year,scenario)[1])==1
            valid=crop&np.isfinite(y)&(y>=0);flat=np.flatnonzero(valid)
            selected=list(flat[np.linspace(0,len(flat)-1,12,dtype=int)])
            # Include a missing-yield crop observation and both FINBIN domain sides.
            for mask in (crop&~valid,valid&scope,valid&~scope):
                where=np.flatnonzero(mask)
                if len(where):selected.append(int(where[len(where)//2]))
            rr,cc=np.unravel_index(selected,y.shape)
            points=ee.FeatureCollection([ee.Feature(ee.Geometry.Point([TRANSFORM.c+(int(c)+.5)*30,TRANSFORM.f-(int(r)+.5)*30],'EPSG:5070'),{'sample':i}) for i,(r,c) in enumerate(zip(rr,cc))])
            image=ee.Image(data['asset']).select([list(YEARS).index(year)*2+(scenario==SCENARIOS[1])]).toDouble();image=image.updateMask(image.gte(0))
            projection=image.projection().getInfo();assert projection['crs']=='EPSG:5070' and projection['transform']==grid
            for cost in [c for c in data['costs'] if c['year']==year]:
                src=image;good=valid.copy()
                if cost['source']=='FINBIN_county':src=src.updateMask(ee.Image(data['county_scope_asset']).eq(1));good&=scope
                rev=src.divide(MGHA_PER_BUAC).multiply(cost['nass_price_usd_bu']*cost['operator_share'])
                ret=rev.subtract(cost['total_cost_usd_ac']);factor=cost['to_2021_dollars']
                bands=rev.multiply(factor).rename('revenue').addBands(ret.multiply(factor).rename('return')).addBands(ret.lt(0).rename('loss'))
                cutoff=[a['cutoff_Mg_ha'] for a in data['annual'] if a['year']==year and a['scenario']==scenario][0]
                bands=bands.addBands(src.lte(cutoff).rename('quartile')).addBands(ret.gt(0).subtract(ret.lt(0)).rename('profit_class'))
                expected_rev=y[rr,cc]/MGHA_PER_BUAC*cost['nass_price_usd_bu']*cost['operator_share']
                expected={'profit_class':classify(expected_rev-cost['total_cost_usd_ac']),'revenue':expected_rev*factor,'return':(expected_rev-cost['total_cost_usd_ac'])*factor,'loss':expected_rev<cost['total_cost_usd_ac'],'quartile':y[rr,cc]<=cutoff}
                if cost['cash_cost_usd_ac'] is not None:
                    bands=bands.addBands(rev.subtract(cost['cash_cost_usd_ac']).multiply(factor).rename('cash'))
                    expected['cash']=(expected_rev-cost['cash_cost_usd_ac'])*factor
                result=bands.toDouble().unmask(sentinel,sameFootprint=False).sampleRegions(collection=points,projection=ee.Projection('EPSG:5070',grid),geometries=False).getInfo()['features']
                assert len(result)==len(selected)
                for feature in result:
                    props=feature['properties'];i=int(props['sample'])
                    for name,values in expected.items():np.testing.assert_allclose(props[name],float(values[i]) if good[rr[i],cc[i]] else sentinel,rtol=0,atol=1e-6)
                checks.append(dict(year=year,scenario=scenario,source=cost['source'],samples=len(selected),verified=True))
                print('Verified native profit pixels',year,scenario,cost['source'],flush=True)
    dump(out/'profit_pixel_verification.json',dict(verified=True,checks=checks,grid_preserved=True,input_asset_checksums_verified=True,missing_and_scope_edges_included=True))
    return checks
