"""Year-scoped lossless JSON evidence, avoiding the EE script size limit."""
from pathlib import Path
import importlib
import json
import pandas as pd
import ee
from google.cloud import storage
from .profit_workspace import RUN_ID, ASSET_PREFIX
from .pipeline import dump, sha

def submit(root,bucket_name):
    out=Path(root)/'CH4_marginality'/RUN_ID
    data=json.loads((out/'app_data_profit.json').read_text())
    rows=[]
    for key in ['counties','distributions','associations']:
        source=data[key]
        if source and not isinstance(source[0],dict):source=[dict(zip(data['county_columns'],r)) for r in source]
        for year in data['years']:
            chunk=[]
            for row in [r for r in source if r['year']==year]:
                candidate=chunk+[row]
                if len(json.dumps(candidate,separators=(',',':')))>40000 and chunk:
                    rows.append(dict(year=year,payload=json.dumps(dict(table=key,rows=chunk),allow_nan=False,separators=(',',':')),geometry='POINT (0 0)'));chunk=[]
                chunk.append(row)
            if chunk:rows.append(dict(year=year,payload=json.dumps(dict(table=key,rows=chunk),allow_nan=False,separators=(',',':')),geometry='POINT (0 0)'))
    file=out/'app_assets/evidence.csv';pd.DataFrame(rows).to_csv(file,index=False)
    asset=ASSET_PREFIX+'_evidence';ee.Initialize(project='ee-njberkowitz95')
    try:existing=ee.data.getAsset(asset)
    except ee.EEException:existing=None
    if existing:
        assert existing['properties']['source_sha256']==sha(file)
        if not (out/'evidence_asset_task.json').exists():
            raise ValueError('Existing evidence asset requires its original submission record')
        importlib.invalidate_caches()
        from .rotation_verify_release import run
        run(root)
        return
    blob=storage.Client(project='ee-njberkowitz95').bucket(bucket_name).blob(f'CH4/{RUN_ID}/evidence.csv')
    blob.upload_from_filename(str(file),timeout=900)
    manifest=dict(name=asset,sources=[dict(uris=['gs://'+bucket_name+'/'+blob.name],charset='UTF-8',crs='EPSG:4326',primaryGeometryColumn='geometry')],properties=dict(source_sha256=sha(file),run_id=RUN_ID,input_manifest_sha256=sha(out/'input_manifest.json')))
    response=ee.data.startTableIngestion(ee.data.newTaskId()[0],manifest,allow_overwrite=False)
    dump(out/'evidence_asset_task.json',dict(response=response,manifest=manifest))
    print('Submitted year-scoped evidence',asset,flush=True)
    importlib.invalidate_caches()
    from .rotation_verify_release import run
    run(root)

def verify(root):
    out=Path(root)/'CH4_marginality'/RUN_ID;asset=ASSET_PREFIX+'_evidence'
    ee.Initialize(project='ee-njberkowitz95');fc=ee.FeatureCollection(asset)
    local=pd.read_csv(out/'app_assets/evidence.csv')
    assert fc.size().getInfo()==len(local)
    remote=fc.aggregate_array('payload').getInfo()
    assert sorted(remote)==sorted(local.payload.tolist()),'Lossless evidence payload changed'
    acl=ee.data.getAssetAcl('projects/ee-njberkowitz95/assets/ch4_verified_yields_corefilter_20260928')
    ee.data.setAssetAcl(asset,json.dumps(acl))
    dump(out/'evidence_asset_verification.json',dict(verified=True,asset=asset,records=len(remote),lossless_payload=True,source_sha256=sha(out/'app_assets/evidence.csv')))
