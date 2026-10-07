"""Ingest immutable annual patch geometry and native identity assets from Colab."""
from pathlib import Path
import json
import numpy as np
import pandas as pd
import rasterio
import ee
from shapely.geometry import shape
from shapely import to_wkt
from google.cloud import storage
from .pipeline import YEARS,TRANSFORM,sha,dump
from .profit_workspace import RUN_ID,ASSET_PREFIX,BASE_ID

def submit(root,bucket_name):
    root=Path(root);out=root/'CH4_marginality'/RUN_ID
    ee.Initialize(project='ee-njberkowitz95')
    client=storage.Client(project='ee-njberkowitz95');bucket=client.bucket(bucket_name)
    tasks=[]
    for year in [None,*YEARS]:
        asset=ASSET_PREFIX+('_index' if year is None else f'_patches_{year}')
        file=out/'app_assets'/('annual_patch_index.tif' if year is None else f'patches_{year}.csv')
        try:
            existing=ee.data.getAsset(asset)
        except ee.EEException:
            existing=None
        if existing:
            if existing.get('properties',{}).get('source_sha256')!=sha(file):raise ValueError(f'Existing asset differs: {asset}')
            tasks.append(dict(asset=asset,state='EXISTING'));continue
        upload=file
        if year is not None:
            # Explicit WKT geometry avoids the CSV GeoJSON inference failure.
            # Retain the original evidence CSV and its checksum unchanged.
            table=pd.read_csv(file)
            table['geometry']=table.pop('.geo').map(lambda value:to_wkt(shape(json.loads(value)),rounding_precision=-1))
            upload=file.with_name(file.stem+'_ee.csv')
            table.to_csv(upload,index=False)
        blob=bucket.blob(f'CH4/{RUN_ID}/{upload.name}')
        blob.upload_from_filename(str(upload),timeout=900)
        uri='gs://'+bucket_name+'/'+blob.name
        props=dict(run_id=RUN_ID,source_sha256=sha(file),input_manifest_sha256=sha(out/'input_manifest.json'))
        if year is None:
            manifest=dict(name=asset,tilesets=[dict(id='patches',sources=[dict(uris=[uri])])],
                          bands=[dict(id=f'y{y}',tilesetId='patches',tilesetBandIndex=i,pyramidingPolicy='MODE') for i,y in enumerate(YEARS)],
                          missingData=dict(values=[0]),properties=props)
            task=ee.data.newTaskId()[0];response=ee.data.startIngestion(task,manifest,allow_overwrite=False)
        else:
            manifest=dict(name=asset,sources=[dict(uris=[uri],charset='UTF-8',crs='EPSG:4326',geodesic=False,primaryGeometryColumn='geometry',maxErrorMeters=1)],
                          properties=props,startTime=f'{year}-01-01T00:00:00Z',endTime=f'{year+1}-01-01T00:00:00Z')
            task=ee.data.newTaskId()[0];response=ee.data.startTableIngestion(task,manifest,allow_overwrite=False)
        dump(out/f'app_assets/{file.stem}_ingestion_manifest.json',manifest)
        tasks.append(dict(asset=asset,request_id=task,task=response['id'],response=response,source=str(file),sha256=sha(file),upload=str(upload),upload_sha256=sha(upload)))
        dump(out/'asset_tasks.json',tasks);print('Submitted',asset,flush=True)
    dump(out/'asset_tasks.json',tasks)
    return tasks

def verify(root):
    root=Path(root);out=root/'CH4_marginality'/RUN_ID;ee.Initialize(project='ee-njberkowitz95')
    acl=ee.data.getAssetAcl('projects/ee-njberkowitz95/assets/ch4_verified_yields_corefilter_20260928')
    checks=[];image=ee.Image(ASSET_PREFIX+'_index')
    assert image.bandNames().getInfo()==[f'y{y}' for y in YEARS]
    for year in YEARS:
        asset=ASSET_PREFIX+f'_patches_{year}';fc=ee.FeatureCollection(asset)
        frame=pd.read_csv(out/f'app_assets/patches_{year}.csv',usecols=lambda c:c!='.geo')
        assert fc.size().getInfo()==len(frame),'Annual geometry count changed'
        assert fc.aggregate_count_distinct('label_id').getInfo()==len(frame),'Annual raster IDs not unique'
        area_total=fc.aggregate_sum('m1_crop_ha').getInfo()
        # EE numeric table ingestion rounds individual values to float32.
        # The original CSV remains the authoritative full-precision evidence.
        np.testing.assert_allclose(area_total,frame.m1_crop_ha.sum(),rtol=0,atol=.001)
        # Verify deterministic representative crop and missing-yield patch attributes.
        samples=pd.concat([frame.head(1),frame.tail(1),frame.nlargest(1,'m1_missing_ha')]).drop_duplicates('label_id')
        for row in samples.to_dict('records'):
            keys=[k for k in row if pd.notna(row[k])]
            got=fc.filter(ee.Filter.eq('label_id',row['label_id'])).first().toDictionary(keys).getInfo()
            for k in keys:
                if k in ('label_id','year'):assert got[k]==row[k]
                else:np.testing.assert_allclose(got[k],row[k],rtol=1e-7,atol=1e-6)
        with rasterio.open(out/'app_assets/annual_patch_index.tif') as ds:
            array=ds.read(list(YEARS).index(year)+1);rr,cc=np.where(array>0)
            positions=np.linspace(0,len(rr)-1,7,dtype=int)
            points=ee.FeatureCollection([ee.Feature(ee.Geometry.Point([TRANSFORM.c+(int(cc[i])+.5)*30,TRANSFORM.f-(int(rr[i])+.5)*30],'EPSG:5070'),{'expected':int(array[rr[i],cc[i]])}) for i in positions])
            actual=image.select(f'y{year}').sampleRegions(collection=points,projection=ee.Projection('EPSG:5070',list(TRANSFORM)[:6]),geometries=False).getInfo()
            assert len(actual['features'])==7
            assert all(f['properties']['expected']==f['properties'][f'y{year}'] for f in actual['features'])
        ee.data.setAssetAcl(asset,json.dumps(acl))
        checks.append(dict(year=year,features=len(frame),sampled_patch_attributes=len(samples),native_pixel_identity_samples=7,table_area_rounding_ha=area_total-float(frame.m1_crop_ha.sum()),verified=True))
        print('Verified annual patch asset',year,flush=True)
    ee.data.setAssetAcl(ASSET_PREFIX+'_index',json.dumps(acl))
    dump(out/'asset_verification.json',dict(verified=True,checks=checks,existing_app_acl_preserved=True,table_total_area_tolerance_ha=.001,table_property_relative_tolerance=1e-7,full_precision_evidence='Original patch CSVs and reconciled sensitivity tables'))
    return checks
