"""Derive CH4 app evidence from a locked, checksum-verified input inventory.

No yield equations or source budgets are modified. Run locally or in Colab.
"""
from pathlib import Path
from datetime import datetime, timezone
import csv, gc, json, shutil
import numpy as np
import pandas as pd
import geopandas as gpd
import rasterio
from .pipeline import paths, read, sha, dump, boundaries, grouped, YEARS, SCENARIOS, SOIL_RUN, TRANSFORM, SHAPE
from .core import MGHA_PER_BUAC, ACRES_PER_HA, SENSITIVITIES
from .final_checks import records

from .release_context import RUN_ID, BASE_ID, ASSET_PREFIX


def distribution(values, metric, dollar_factor=1.):
    """Equal-area native pixels; two explicit tails prevent silent truncation."""
    v = np.asarray(values, dtype=float)
    v = v[np.isfinite(v)] * dollar_factor
    edges = np.arange(0, 2001, 100) if metric == 'revenue' else np.arange(-1000, 1001, 100)
    counts, _ = np.histogram(v, np.r_[-np.inf, edges, np.inf])
    labels = [f'< {edges[0]}'] + [f'{a} to < {b}' for a,b in zip(edges[:-1], edges[1:])] + [f'≥ {edges[-1]}']
    # numpy includes the final right edge only; infinity makes all finite inner edges left-inclusive.
    assert counts.sum() == len(v)
    return [dict(bin=i, label=label, pixels=int(n) if len(v) else None, area_ha=float(n)*.09 if len(v) else None,
                 defined=bool(len(v))) for i,(label,n) in enumerate(zip(labels,counts))]


def lock_inputs(root, base, out, previous=None):
    inv = pd.read_csv(base/'tables/input_inventory.csv')
    files = {}
    for r in inv.to_dict('records'):
        for key, digest, parent in [('path','sha256',root),('mask','mask_sha256',root.parent),('patch_index','index_sha256',root)]:
            p = parent/r[key]
            actual = sha(p)
            if actual != r[digest]:
                raise ValueError(f'Numerical source must be compared/rebuilt before publication: {p}')
            files[str(p)] = dict(path=str(p),sha256=actual,role=key)
        idx = root/r['patch_index']
        fm = json.loads((idx.parent/'field_index_manifest.json').read_text())
        for item in fm['outputs']:
            if item['file'].endswith('.gpkg'):
                p=idx.parent/item['file']; actual=sha(p)
                if actual != item['sha256']: raise ValueError(f'Geometry changed: {p}')
                files[str(p)] = dict(path=str(p),sha256=actual,role='patch_geometry')
    extras = [(root/SOIL_RUN/'rasters/nccpi_corn_v3.tif','NCCPI'),
              (root.parent/'MLRANE.zip','AOI'),
              (root/'FINBIN_benchmark/source_audit/tl_2021_us_county.zip','county'),
              (base/'app_assets/ch4_finbin_county_scope_corefilter_20260928.tif','FINBIN_scope')]
    extras += [(p,'economic_source') for p in sorted((base/'sources').rglob('*')) if p.is_file()]
    extras += [(p,'verified_base_table') for p in sorted((base/'tables').glob('*.csv'))]
    extras += [(root/'extension_2019_2021/20260928_corefilter_remask_v1/run_manifest.json','supersession_manifest')]
    # Detect new candidate runs as well as modifications within the selected run.
    candidate_dirs=sorted(p.name for p in (root/'extension_2019_2021').iterdir() if p.is_dir())
    extras += [(p,'supersession_record') for p in sorted((root/'extension_2019_2021').glob('*/SUPERSEDED.md'))]
    extras += [(p,'supersession_record') for p in sorted((root/'extension_2019_2021').glob('*/products/SUPERSEDED.md'))]
    for p,role in extras: files[str(p)]=dict(path=str(p),sha256=sha(p),role=role)
    # Canonical remasks can differ in TIFF encoding. Compare their actual crop pixels.
    canonical=[]
    for year in (2019,2021):
        p=root.parent/f'non_irrigated_corn/clean/non_irrigated_corn_mlrane_{year}_clean.tif'
        staged=paths(root,year,SCENARIOS[0])[1]
        with rasterio.open(p) as a,rasterio.open(staged) as b:
            assert a.crs==b.crs and a.transform==b.transform and a.shape==b.shape
            changed=sum(int(np.count_nonzero((a.read(1,window=w)==1)!=(b.read(1,window=w)==1))) for _,w in a.block_windows(1))
        if changed: raise ValueError(f'Canonical {year} mask changed by {changed} crop pixels')
        canonical.append(dict(year=year,path=str(p),sha256=sha(p),staged_sha256=sha(staged),different_crop_pixels=changed))
        files[str(p)]=dict(path=str(p),sha256=sha(p),role='canonical_mask')
    for item in files.values(): item['logical_path']=Path(item['path']).relative_to(root.parent).as_posix()
    manifest=dict(run_id=RUN_ID,base_run=BASE_ID,verified_utc=datetime.now(timezone.utc).isoformat(),
                  crs='EPSG:5070',transform=list(TRANSFORM)[:6],shape=list(SHAPE),pixel_area_ha=.09,
                  files=list(files.values()),canonical_mask_comparisons=canonical,candidate_run_directories=candidate_dirs)
    if previous is not None:
        if 'platforms' in previous:manifest['platforms']=previous['platforms']
        old={r.get('logical_path',r['path']):r['sha256'] for r in previous['files']}
        new={r['logical_path']:r['sha256'] for r in manifest['files']}
        if old!=new: raise ValueError('Inputs changed during preparation; publication stopped')
        if previous.get('candidate_run_directories')!=candidate_dirs:raise ValueError('New candidate dataset appeared; re-audit required')
    dump(out/('deployment_input_manifest.json' if previous else 'input_manifest.json'),manifest)
    return manifest


def prefix(scenario,source):
    return scenario[:2].lower()+'_'+{'UNL':'u','ERS_Heartland':'e','FINBIN_state':'s','FINBIN_county':'c'}[source]


def run(root):
    root=Path(root);base=root/'CH4_marginality'/BASE_ID;out=root/'CH4_marginality'/RUN_ID
    out.mkdir(parents=True,exist_ok=True)
    for folder in ['tables','sources','rasters','app_assets','logs','code']: (out/folder).mkdir(exist_ok=True)
    assert json.loads((base/'validation.json').read_text())['verified']
    manifest=lock_inputs(root,base,out)
    dump(out/'status.json',dict(status='preparing',input_manifest_sha256=sha(out/'input_manifest.json')))
    cost=pd.read_csv(base/'tables/economic_scenarios.csv')
    annual=pd.read_csv(base/'tables/annual_yield.csv',float_precision='round_trip');sens=pd.read_csv(base/'tables/sensitivity.csv',float_precision='round_trip')
    eligibility=pd.read_csv(base/'tables/year_eligibility.csv')
    enabled=set(eligibility.loc[eligibility.eligible,'year'])
    if not set(cost.year)<=enabled: raise ValueError('Economic scenarios contain a blocked year')
    county,zones=boundaries(root,out)
    scope=read(base/'app_assets/ch4_finbin_county_scope_corefilter_20260928.tif')==1
    county_rows=[];bins=[];checks=[]
    patch_file=out/'tables/patch_sensitivity.csv.gz'
    first=True
    index_file=out/'app_assets/annual_patch_index.tif'
    profile=dict(driver='GTiff',height=SHAPE[0],width=SHAPE[1],count=len(YEARS),dtype='int32',crs='EPSG:5070',
                 transform=TRANSFORM,nodata=0,tiled=True,blockxsize=512,blockysize=512,compress='deflate',interleave='band')
    with rasterio.open(index_file,'w',**profile) as packed:
        for band,year in enumerate(YEARS,1):
            print(f'CH4 profit evidence {year}',flush=True)
            yp,mp,ip=paths(root,year,SCENARIOS[0]);crop=read(mp)==1
            ix=np.nan_to_num(read(ip)).astype('int32')
            assert np.all(ix[crop]>0),'Crop pixel without annual patch identity'
            packed.write(ix,band);packed.set_band_description(band,f'y{year}')
            geom=gpd.read_file(base/'CH4_spatial.gpkg',layer=f'patches_{year}')
            assert geom.crs.to_epsg()==5070 and geom.geometry.is_valid.all()
            # label_id is the native raster key; field_id is a year-specific mapped unit.
            key='label_id' if 'label_id' in geom else 'patch_id'
            geom=geom.set_index(key,drop=False).sort_index()
            wide={}
            wide['label_id']=pd.Series(geom.index,index=geom.index);wide['year']=pd.Series(year,index=geom.index)
            for scenario in SCENARIOS:
                y=read(paths(root,year,scenario)[0]).astype(float)
                valid=crop&np.isfinite(y)&(y>=0)
                cutoff=float(annual.query('year==@year and scenario==@scenario').cutoff_Mg_ha.item())
                # Work on crop pixels only; preserve missing crop observations in denominators.
                pid=ix[crop];cz=zones[crop];yv=y[crop];good=valid[crop];q=yv<=cutoff
                basepatch=grouped(pid,np.ones(len(pid),bool),good,yv,q)
                for name in ['crop_ha','valid_ha','missing_ha','coverage_percent','yield_Mg_ha_mean','quartile_ha']:
                    wide[scenario[:2].lower()+'_'+name]=basepatch.set_index('zone')[name]
                if year not in enabled: continue
                for c in cost[cost.year==year].to_dict('records'):
                    source=c['source'];eligible=good&(scope[crop] if source=='FINBIN_county' else True)
                    pre=prefix(scenario,source)
                    srcbase=grouped(pid,np.ones(len(pid),bool),eligible,yv,q).set_index('zone')
                    for name in ['valid_ha','missing_ha','coverage_percent','yield_Mg_ha_mean','quartile_ha']:
                        wide[pre+'_'+name]=srcbase[name]
                    for pf,cf in SENSITIVITIES:
                        revenue=yv/MGHA_PER_BUAC*c['nass_price_usd_bu']*pf*c['operator_share']
                        ret=revenue-c['total_cost_usd_ac']*cf;cash=revenue-c['cash_cost_usd_ac']*cf
                        meta=dict(year=year,scenario=scenario,source=source,price_factor=pf,cost_factor=cf,experimental=year==2021)
                        patches=grouped(pid,np.ones(len(pid),bool),eligible,yv,q,ret,cash,revenue)
                        patches=patches.rename(columns={'zone':'patch_id'}).assign(**meta)
                        patches.to_csv(patch_file,index=False,mode='w' if first else 'a',header=first,compression='gzip');first=False
                        counties=grouped(cz,np.ones(len(pid),bool),eligible,yv,q,ret,cash,revenue).assign(**meta)
                        counties=counties.merge(county[['zone','GEOID','NAME']],on='zone')
                        county_rows.append(counties)
                        row=sens.query('year==@year and scenario==@scenario and source==@source and price_factor==@pf and cost_factor==@cf').iloc[0]
                        for label,frame in [('patch',patches),('county',counties)]:
                            np.testing.assert_allclose(frame.valid_ha.sum(),row.valid_ha,atol=1e-7,rtol=0)
                            np.testing.assert_allclose(frame.economic_loss_ha.sum(),row.loss_ha,atol=1e-7,rtol=0)
                            np.testing.assert_allclose(frame.return_usd_ac_sum_usd.sum(),row.total_return_usd,atol=.01,rtol=0)
                        checks.append(dict(**meta,valid_ha=row.valid_ha,loss_ha=row.loss_ha,reconciled=True))
                        for metric,vals in [('return',ret),('cash',cash),('revenue',revenue)]:
                            for basis,factor in [('nominal',1),('2021',c['to_2021_dollars'])]:
                                for b in distribution(vals[eligible],metric,factor): bins.append(dict(**meta,metric=metric,basis=basis,**b))
                        sk=f'{int(round(pf*100))}_{int(round(cf*100))}'
                        pp=patches.set_index('patch_id')
                        for name,short in [('economic_loss_ha','loss'),('both_ha','both'),('disagree_ha','disagree')]:
                            wide[pre+'_'+sk+'_'+short]=pp[name]
                del y;gc.collect()
            wide=pd.DataFrame(wide,index=geom.index).reset_index(drop=True)
            geom=geom.reset_index(drop=True)
            assert len(wide)==len(geom)
            # GeoJSON geometry serialized into .geo is Earth Engine's documented CSV schema.
            from shapely.geometry import mapping
            wide['.geo']=[json.dumps(mapping(g),separators=(',',':')) for g in geom.to_crs(4326).geometry]
            wide.to_csv(out/f'app_assets/patches_{year}.csv',index=False)
            geom.to_file(out/'CH4_spatial.gpkg',layer=f'patches_{year}',driver='GPKG')
            del geom,wide,ix,crop;gc.collect()
    from rasterio.shutil import copy as rio_copy
    temp=index_file.with_suffix('.cog.tif')
    rio_copy(index_file,temp,driver='COG',compress='DEFLATE',blocksize=512,overview_resampling='nearest')
    temp.replace(index_file)
    with rasterio.open(index_file) as ds:assert ds.tags(ns='IMAGE_STRUCTURE').get('LAYOUT')=='COG'
    counties=pd.concat(county_rows,ignore_index=True);counties.to_csv(out/'tables/county_sensitivity.csv',index=False)
    pd.DataFrame(bins).to_csv(out/'tables/distribution_bins.csv',index=False)
    payload=json.loads((base/'app_data.json').read_text())
    compact_bins=[]
    bf=pd.DataFrame(bins)
    keys=['year','scenario','source','price_factor','cost_factor','metric','basis']
    for k,g in bf.groupby(keys,sort=True):
        native=[v.item() if isinstance(v,np.generic) else v for v in k]
        counts=[int(v) if pd.notna(v) else None for v in g.sort_values('bin').pixels]
        compact_bins.append(dict(zip(keys,native),counts=counts))
    compact_counties=['year','scenario','source','price_factor','cost_factor','GEOID','NAME','crop_ha','valid_ha',
                      'missing_ha','coverage_percent','yield_Mg_ha_mean','quartile_ha','return_usd_ac_mean',
                      'return_usd_ac_sum_usd','cash_margin_usd_ac_mean','revenue_usd_ac_mean','economic_loss_ha','both_ha','disagree_ha']
    payload.update(run_id=RUN_ID,input_manifest_sha256=sha(out/'input_manifest.json'),
                   patch_index_asset=ASSET_PREFIX+'_index',patch_assets={str(y):ASSET_PREFIX+f'_patches_{y}' for y in YEARS},
                   county_columns=compact_counties,counties=[list(r.values()) for r in records(counties[compact_counties])],distributions=compact_bins,
                   associations=records(pd.read_csv(base/'tables/nccpi_associations.csv')))
    from .release_context import ROTATION
    if ROTATION:payload['budget_policy']='closest_rotation'
    # Include source ledger and full denominator-bearing annual records.
    payload['annual']=records(annual)
    dump(out/'app_data_profit.json',payload)
    lock_inputs(root,base,out,manifest)
    dump(out/'validation.json',dict(verified=True,reconciliations=checks,histogram_tails_included=True,
                                  annual_patch_identity_verified=True,input_manifest_sha256=sha(out/'input_manifest.json')))
    dump(out/'status.json',dict(status='evidence_complete',economic_combinations=len(checks),published=False))
    print(out,flush=True)
    return out


if __name__=='__main__':
    import sys
    run(sys.argv[1] if len(sys.argv)>1 else 'G:/My Drive/PHD/CSP3_GPP_outputs')
