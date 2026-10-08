"""Publish compact CH3 evidence; reuse verified CH4 native IDs and geometry."""
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import numpy as np
import pandas as pd
import rasterio
from ch4_marginality.pipeline import sha,dump,SHAPE,TRANSFORM
from ch4_marginality.final_checks import records
from .build_app import ASSET_PREFIX
from .pipeline import RUN_ID,SOURCE_RELEASE


def prepare(out: Path) -> None:
    """Create indexed patch attributes, year-scoped evidence and temporal rasters."""
    out=Path(out)
    stage=TemporaryDirectory(prefix='ch3_earth_engine_')
    dest=Path(stage.name)
    tables=[]
    for year in range(2001,2022,2):
        rows=[]
        for file in sorted((out/'logs').glob(f'{year}_*/patch_sensitivity.csv.gz')):
            df=pd.read_csv(file,usecols=['patch_id','year','scenario','source','price_factor','cost_factor','profitable_ha','breakeven_ha','loss_ha'])
            df['prefix']=df.scenario.str[:2].str.lower()+'_'+df.source.map({'UNL':'u','ERS_Heartland':'e','FINBIN_state':'s','FINBIN_county':'c'})+'_'+(df.price_factor*100).round().astype(int).astype(str)+'_'+(df.cost_factor*100).round().astype(int).astype(str)
            wide=df.pivot(index=['year','patch_id'],columns='prefix',values=['profitable_ha','breakeven_ha','loss_ha'])
            short={'profitable_ha':'profit','breakeven_ha':'zero','loss_ha':'loss'}
            wide.columns=[prefix+'_'+short[metric] for metric,prefix in wide.columns]
            rows.append(wide)
        if rows:
            tables.append(pd.concat(rows,axis=1).reset_index())
    pd.concat(tables,ignore_index=True).to_csv(dest/'patch_evidence.csv',index=False)
    evidence=[]
    for name,file in [('county','county_sensitivity'),('associations','nccpi_associations')]:
        df=pd.read_csv(out/'tables'/f'{file}.csv')
        if name=='county':
            df=df[['year','scenario','source','price_factor','cost_factor','NAME','valid_ha','profitable_percent','profitable_ha','breakeven_ha','loss_ha']]
        for year,g in df.groupby('year'):
            values=records(g)
            for i in range(0,len(values),50):
                evidence.append(dict(year=int(year),table=name,part=i//50,payload=json.dumps(dict(table=name,rows=values[i:i+50]),separators=(',',':'),allow_nan=False)))
    pd.DataFrame(evidence).to_csv(dest/'evidence.csv',index=False)
    paths=[]
    for policy,polshort in [('closest_rotation','closest'),('exact','exact')]:
        for scenario in ['M1_fixed','M2_HI_sensitivity']:
            for source,short in [('UNL','u'),('ERS_Heartland','e'),('FINBIN_state','s'),('FINBIN_county','c')]:
                for metric,suffix in [('profitable_frequency','frequency'),('observed_seasons','count')]:
                    p=out/f'rasters/{metric}_{scenario}_{source}_{policy}.tif'
                    paths.append((p,f'{scenario[:2].lower()}_{short}_{polshort}_{suffix}'))
    with rasterio.open(dest/'temporal.tif','w',driver='GTiff',height=SHAPE[0],width=SHAPE[1],count=len(paths),
                       crs='EPSG:5070',transform=TRANSFORM,dtype='float32',nodata=-9999,compress='deflate',tiled=True) as dst:
        for band,(path,name) in enumerate(paths,1):
            with rasterio.open(path) as src: dst.write(src.read(1).astype('float32'),band)
            dst.set_band_description(band,name)
    dump(dest/'temporal_bands.json',[name for _,name in paths])
    from .recover_release import publish_closed_file
    for path in sorted(dest.iterdir()):
        publish_closed_file(path,out/'app_assets'/path.name)
    stage.cleanup()


def submit(out: Path, bucket_name: str = 'testernoah135') -> list[dict]:
    """Use the existing project and bucket with immutable, checksummed new assets."""
    import ee
    from google.cloud import storage
    out=Path(out);ee.Initialize(project='ee-njberkowitz95')
    if not json.loads((out/'verification/release_audit.json').read_text(encoding='utf-8'))['verified']:
        raise ValueError('Independent release audit must pass before importing assets')
    bucket=storage.Client(project='ee-njberkowitz95').bucket(bucket_name)
    task_record=out/'asset_tasks.json'
    recorded=json.loads(task_record.read_text()) if task_record.exists() else []
    by_asset={row['asset']:row for row in recorded}
    tasks=[]
    for name,file in [('patch_evidence','patch_evidence.csv'),('evidence','evidence.csv'),('temporal','temporal.tif')]:
        path=out/'app_assets'/file;asset=ASSET_PREFIX+'_'+name
        previous=by_asset.get(asset)
        if previous and 'response' in previous:
            if previous.get('source_sha256')!=sha(path):
                raise ValueError('Recorded import input differs; create a new release')
            status=ee.data.getTaskStatus([previous['response']['id']])[0]
            if status['state'] not in ['READY','RUNNING','COMPLETED']:
                raise ValueError('Recorded import requires investigation: '+str(status))
            tasks.append(previous)
            continue
        try: existing=ee.data.getAsset(asset)
        except ee.EEException: existing=None
        if existing:
            if existing.get('properties',{}).get('source_sha256')!=sha(path): raise ValueError('Existing CH3 asset differs')
            tasks.append(dict(asset=asset,state='EXISTING'));continue
        blob=bucket.blob(f'CH3/{RUN_ID}/{file}');blob.upload_from_filename(str(path),timeout=900)
        uri='gs://'+bucket_name+'/'+blob.name
        properties=dict(run_id=RUN_ID,source_sha256=sha(path),input_manifest_sha256=sha(out/'input_manifest.json'))
        if name=='temporal':
            bands=json.loads((out/'app_assets/temporal_bands.json').read_text())
            manifest=dict(name=asset,tilesets=[dict(id='temporal',sources=[dict(uris=[uri])])],
                bands=[dict(id=b,tilesetId='temporal',tilesetBandIndex=i,pyramidingPolicy='SAMPLE') for i,b in enumerate(bands)],
                missingData=dict(values=[-9999]),properties=properties)
            response=ee.data.startIngestion(ee.data.newTaskId()[0],manifest,allow_overwrite=False)
        else:
            manifest=dict(name=asset,sources=[dict(uris=[uri],charset='UTF-8')],properties=properties)
            response=ee.data.startTableIngestion(ee.data.newTaskId()[0],manifest,allow_overwrite=False)
        tasks.append(dict(asset=asset,response=response,source_sha256=sha(path)))
        dump(out/f'app_assets/{name}_ingestion.json',manifest)
        dump(out/'asset_tasks.json',tasks)
    return tasks


def verify(out: Path) -> dict:
    """Check task completion, table identities, native temporal pixels, and app ACL."""
    import ee
    ee.Initialize(project='ee-njberkowitz95');out=Path(out)
    tasks=json.loads((out/'asset_tasks.json').read_text())
    states=ee.data.getTaskStatus([r['response']['id'] for r in tasks if 'response' in r])
    if any(s['state']!='COMPLETED' for s in states):raise ValueError('Asset tasks not completed: '+str([(s['state'],s.get('error_message')) for s in states]))
    acl=ee.data.getAssetAcl('projects/ee-njberkowitz95/assets/ch4_verified_yields_corefilter_20260928')
    checks=[]
    for name,file in [('patch_evidence','patch_evidence.csv'),('evidence','evidence.csv')]:
        df=pd.read_csv(out/'app_assets'/file);fc=ee.FeatureCollection(ASSET_PREFIX+'_'+name)
        if fc.size().getInfo()!=len(df):raise ValueError('Evidence row count differs')
        if name=='patch_evidence':
            if df.duplicated(['year','patch_id']).any():raise ValueError('Duplicate patch-year key')
            for year,g in df.groupby('year'):
                row=g.iloc[0];keys=[k for k in df if pd.notna(row[k])]
                got=fc.filter(ee.Filter.eq('year',int(year))).filter(ee.Filter.eq('patch_id',int(row.patch_id))).first().toDictionary().getInfo()
                for key in keys:np.testing.assert_allclose(got[key],row[key],rtol=1e-7,atol=1e-5)
                for key in df.columns:
                    if pd.isna(row[key]) and got.get(key) is not None:
                        raise ValueError('Missing patch observation was converted to a value: '+key)
                checks.append(dict(year=int(year),patch_id=int(row.patch_id),verified=True))
        ee.data.setAssetAcl(ASSET_PREFIX+'_'+name,json.dumps(acl))
    image=ee.Image(ASSET_PREFIX+'_temporal')
    with rasterio.open(out/'app_assets/temporal.tif') as src:
        if image.bandNames().getInfo()!=list(src.descriptions):raise ValueError('Temporal band identity differs')
        for band in [1,2,17,18]:
            a=src.read(band);r,c=np.where(a!=-9999);positions=np.linspace(0,len(r)-1,5,dtype=int)
            for i in positions:
                point=ee.Geometry.Point([TRANSFORM.c+(int(c[i])+.5)*30,TRANSFORM.f-(int(r[i])+.5)*30],'EPSG:5070')
                value=image.select([band-1]).reduceRegion(ee.Reducer.first(),point,crs='EPSG:5070',crsTransform=list(TRANSFORM)[:6]).getInfo()
                np.testing.assert_allclose(list(value.values())[0],a[r[i],c[i]],rtol=1e-6,atol=1e-7)
    ee.data.setAssetAcl(ASSET_PREFIX+'_temporal',json.dumps(acl))
    result=dict(verified=True,patch_checks=checks,missing_patch_values_preserved=True,temporal_pixel_checks=20,reused_identity_and_geometry_prefix='projects/ee-njberkowitz95/assets/ch4_rotation_20260929')
    dump(out/'asset_verification.json',result)
    return result
