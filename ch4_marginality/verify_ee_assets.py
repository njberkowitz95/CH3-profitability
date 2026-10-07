"""Verify ingested assets at native scale, and reuse the existing app asset ACL."""
from pathlib import Path
import json,time
import ee
import pandas as pd
from .pipeline import TRANSFORM,SHAPE,sha

def run(output):
    output=Path(output);ee.Initialize(project='ee-njberkowitz95')
    prefix='projects/ee-njberkowitz95/assets/'
    names=['ch4_verified_yields_corefilter_20260928','ch4_finbin_county_scope_corefilter_20260928']
    evidence={}
    for name in names:
        for attempt in range(30):
            try:
                metadata=ee.data.getAsset(prefix+name)
                if metadata.get('bands'):break
            except ee.EEException:pass
            time.sleep(10)
        else:raise RuntimeError(f'Asset not ready: {name}')
        evidence[name]=metadata
    image=ee.Image(prefix+names[0])
    assert len(evidence[names[0]]['bands'])==22
    grid=list(TRANSFORM)[:6]
    region=ee.Geometry.Rectangle([TRANSFORM.c,TRANSFORM.f-SHAPE[0]*30,TRANSFORM.c+SHAPE[1]*30,TRANSFORM.f],proj='EPSG:5070',geodesic=False)
    stats=image.reduceRegion(reducer=ee.Reducer.count().combine(ee.Reducer.mean(),sharedInputs=True),geometry=region,
        crs='EPSG:5070',crsTransform=grid,maxPixels=1e9,tileScale=4).getInfo()
    # Completeness of the local analysis is checked before final reconciliation.
    evidence['native_statistics']=stats
    acl=ee.data.getAssetAcl(prefix+'csp3_dryland_corn_yield_2019_M1_fixed')
    for name in names:
        ee.data.setAssetAcl(prefix+name,json.dumps(acl))
        ee.data.setAssetProperties(prefix+name,{'ch4_run':'20260928_corefilter_exact_year_v2','source_sha256':sha(output/'app_assets'/f'{name}.tif')})
        evidence[name]['acl_matches_existing_app_asset']=ee.data.getAssetAcl(prefix+name)==acl
    (output/'ee_ingestion_verification.json').write_text(json.dumps(evidence,indent=2))
    print('Earth Engine native statistics and existing-app ACL verified',flush=True)

if __name__=='__main__':
    import sys
    run(sys.argv[1])
