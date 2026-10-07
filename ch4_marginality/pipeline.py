"""Run in Colab against pinned, verified Drive products. No yield-model fitting."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, shutil, gc, logging
import numpy as np
import pandas as pd
import geopandas as gpd
import rasterio
from rasterio.transform import Affine
from rasterio.features import rasterize
from rasterio.shutil import copy as rio_copy
from .core import *
from .prepare_budgets import build, HERE

TRANSFORM=Affine(30,0,-111285,0,-30,2047275)
SHAPE=(5343,5469)
NODATA=-9999.
EXT_NEW='extension_2019_2021/20260928_corefilter_remask_v1'
RUN_ID='20260928_corefilter_exact_year_v2'
FIELD_HIST='fields/5469d89b3ee271530885'
SOIL_RUN='NCCPI_comparison/20260927_nccpi_slope_corefilter'

def sha(p):
    h=hashlib.sha256()
    with Path(p).open('rb') as f:
        for b in iter(lambda:f.read(8*1024*1024),b''):h.update(b)
    return h.hexdigest()

def dump(p,obj):Path(p).write_text(json.dumps(obj,indent=2,default=str),encoding='utf8')

def paths(root,year,scenario):
    if year<=2017:
        base=root/'CH2V6_yield_outputs'; fields=root/FIELD_HIST
        mask=root.parent/f'non_irrigated_corn/clean/non_irrigated_corn_mlrane_{year}_clean.tif'
    else:
        current=root/EXT_NEW/str(year)
        base=current/'rasters'
        candidates=[p for p in (current/'fields').iterdir() if p.is_dir() and (p/'field_index_manifest.json').exists()]
        if len(candidates)!=1:raise ValueError(f'Expected one verified field index for {year}: {candidates}')
        fields=candidates[0]
        mask=current/f'masks/non_irrigated_corn_mlrane_{year}_clean.tif'
    return base/f'csp3_dryland_corn_yield_{year}_{scenario}.tif', mask,fields/f'csp3_field_index_{year}.tif'

def read(p):
    with rasterio.open(p) as s:
        if s.crs.to_epsg()!=5070 or s.shape!=SHAPE or s.transform!=TRANSFORM or s.count!=1:
            raise ValueError(f'Grid contract failed: {p}')
        return s.read(1,masked=True).astype('float32').filled(np.nan)

def cog(p,a,description):
    p=Path(p);temp=p.with_suffix('.partial.tif')
    with rasterio.open(temp,'w',driver='GTiff',height=SHAPE[0],width=SHAPE[1],count=1,dtype='float32',
        crs='EPSG:5070',transform=TRANSFORM,nodata=NODATA,compress='deflate',predictor=3,tiled=True,blockxsize=512,blockysize=512) as d:
        d.write(np.where(np.isfinite(a),a,NODATA).astype('float32'),1);d.set_band_description(1,description)
        d.update_tags(analysis='CH4 exact-year UNL gated',run_id=p.parent.parent.name)
    rio_copy(temp,p,driver='COG',compress='DEFLATE',blocksize=512,overview_resampling='nearest')
    temp.unlink()
    with rasterio.open(p) as s:
        assert s.tags(ns='IMAGE_STRUCTURE').get('LAYOUT')=='COG'
        assert s.transform==TRANSFORM and s.shape==SHAPE

def audit(root,out):
    hist=pd.read_csv(root/'CH2V6_yield_outputs/csp3_dryland_corn_yield_summary.csv')
    extension=json.loads((root/EXT_NEW/'run_manifest.json').read_text())
    rows=[]
    for year in YEARS:
        for scenario in SCENARIOS:
            p,mask,idx=paths(root,year,scenario)
            expected=(hist.loc[(hist.year==year)&(hist.scenario==scenario),'yield_sha256'].item() if year<=2017 else
                next(x['yield_sha256'] for x in extension['years'][str(year)]['annual'] if x['scenario']==scenario))
            actual=sha(p)
            if actual!=expected:raise ValueError(f'Yield checksum changed: {p}')
            with rasterio.open(p) as s:
                assert s.crs.to_epsg()==5070 and s.shape==SHAPE and s.transform==TRANSFORM
            fm=json.loads((idx.parent/'field_index_manifest.json').read_text())
            ix=next(v for v in fm['outputs'] if v['file']==idx.name)
            assert sha(idx)==ix['sha256'],'Patch index checksum mismatch'
            rows.append(dict(year=year,scenario=scenario,path=str(p.relative_to(root)),sha256=actual,
                mask=str(mask.relative_to(root.parent)),mask_sha256=sha(mask),patch_index=str(idx.relative_to(root)),
                index_sha256=ix['sha256'],units='Mg/ha at 15.5% grain moisture',experimental=year==2021))
    soil=root/SOIL_RUN/'rasters/nccpi_corn_v3.tif'
    sm=pd.read_csv(root/SOIL_RUN/'output_manifest.csv')
    # Preserve the existing soil manifest and verify against its recorded digest.
    matches=sm[sm.astype(str).apply(lambda c:c.str.contains('rasters/nccpi_corn_v3.tif',regex=False)).any(axis=1)]
    if len(matches)!=1:raise ValueError('NCCPI manifest entry missing/ambiguous')
    assert sha(soil)==matches.iloc[0]['sha256'],'NCCPI checksum mismatch'
    pd.DataFrame(rows).to_csv(out/'tables/input_inventory.csv',index=False)
    for p in [root/'CH2V6_yield_outputs/csp3_raster_manifest.csv',root/SOIL_RUN/'output_manifest.csv',root/SOIL_RUN/'sources/nccpi_source_manifest.json']:
        shutil.copy2(p,out/'sources'/('soil_'+p.name if p.name=='output_manifest.csv' else p.name))
    return rows

def boundaries(root,out):
    aoi_path=root.parent/'MLRANE.zip'
    if sha(aoi_path)!='bb7c38f10ba2ee35d6ee2eb23627e362a5880ab40b4337c64b86fc21994013db':raise ValueError('AOI source changed')
    aoi=gpd.read_file(aoi_path).to_crs(5070).geometry.union_all()
    if not aoi.is_valid:raise ValueError('Invalid AOI')
    source=root/'FINBIN_benchmark/source_audit/tl_2021_us_county.zip'
    county=gpd.read_file(source);county=county[county.STATEFP=='31'].to_crs(5070)
    county=county[county.intersects(aoi)][['GEOID','NAME','geometry']].copy()
    full=county.copy()
    county['geometry']=county.geometry.intersection(aoi);county=county[county.area>1].sort_values('GEOID').reset_index(drop=True)
    county['zone']=np.arange(1,len(county)+1);county['polygon_area_ha']=county.area/1e4
    zones=rasterize(zip(county.geometry,county.zone),out_shape=SHAPE,transform=TRANSFORM,fill=0,dtype='int16')
    full=full.merge(county[['GEOID','zone']],on='GEOID')
    fullzones=rasterize(zip(full.geometry,full.zone),out_shape=SHAPE,transform=TRANSFORM,fill=0,dtype='int16')
    # The immutable crop masks retain a few AOI edge cells whose centers fall outside the vector boundary.
    # Assign these cells by their county center, while retaining the original 0.09-ha pixel accounting.
    edge=zones==0
    zones=np.where(edge,fullzones,zones).astype('int16')
    # Historical masks have a documented <=24.1 m boundary mismatch. Only
    # unassigned centers within one grid cell receive a nearest-county label.
    fringe=rasterize(zip(county.geometry.buffer(30),county.zone),out_shape=SHAPE,transform=TRANSFORM,fill=0,dtype='int16')
    rr,cc=np.where((zones==0)&(fringe>0))
    from shapely import points
    near=gpd.GeoDataFrame({'row':rr,'col':cc},geometry=points(TRANSFORM.c+(cc+.5)*30,TRANSFORM.f-(rr+.5)*30),crs=5070)
    near=near.sjoin_nearest(county[['zone','geometry']],max_distance=30,distance_col='distance_m').sort_values(['row','col','distance_m','zone']).drop_duplicates(['row','col'])
    zones[near.row.to_numpy(),near.col.to_numpy()]=near.zone.to_numpy()
    cog(out/'rasters/aoi_center_outside.tif',edge.astype(float),'1 = center outside vector AOI; original crop-mask edge cells retained')
    county.to_file(out/'CH4_spatial.gpkg',layer='county_aoi',driver='GPKG')
    gpd.GeoDataFrame({'name':['MLRA 106 Nebraska']},geometry=[aoi],crs=5070).to_file(out/'CH4_spatial.gpkg',layer='aoi',driver='GPKG')
    dump(out/'sources/boundaries.json',{'aoi_file':str(aoi_path),'aoi_sha256':sha(aoi_path),'county_file':str(source),
        'county_sha256':sha(source),'county_source':'https://www2.census.gov/geo/tiger/TIGER2021/COUNTY/',
        'raster_assignment':'county pixel center on immutable crop mask; outside-vector edge pixels assigned by full county, or nearest AOI county within 30 m if outside state; edge counts separately reported'})
    return county,zones

def summary(values):
    v=np.asarray(values,float);v=v[np.isfinite(v)]
    if not len(v):return dict(n=0,mean=np.nan,sd=np.nan,p05=np.nan,p25=np.nan,median=np.nan,p75=np.nan,p95=np.nan,min=np.nan,max=np.nan)
    return dict(n=len(v),mean=v.mean(),sd=v.std(),min=v.min(),max=v.max(),**dict(zip(['p05','p25','median','p75','p95'],np.quantile(v,[.05,.25,.5,.75,.95]))))

def grouped(zone,crop,valid,y,q,ret=None,cash=None,revenue=None):
    n=int(zone.max())+1
    cv=np.bincount(zone[crop],minlength=n);vv=np.bincount(zone[valid],minlength=n)
    d=pd.DataFrame({'zone':np.arange(n),'crop_pixels':cv,'valid_pixels':vv})
    d['crop_ha']=cv*.09;d['valid_ha']=vv*.09;d['missing_ha']=(cv-vv)*.09
    d['coverage_percent']=np.divide(vv*100,cv,out=np.full(n,np.nan),where=cv>0)
    for name,a in [('yield_Mg_ha',y),('quartile',q),('return_usd_ac',ret),('cash_margin_usd_ac',cash),('revenue_usd_ac',revenue)]:
        if a is None:continue
        good=valid & np.isfinite(a);counts=np.bincount(zone[good],minlength=n)
        sums=np.bincount(zone[good],weights=a[good],minlength=n)
        d[name+'_mean']=np.divide(sums,counts,out=np.full(n,np.nan),where=counts>0)
        if name=='quartile':d['quartile_ha']=np.where(counts>0,sums*.09,np.nan)
        if name.endswith('usd_ac'):d[name+'_sum_usd']=np.where(counts>0,sums*.09*ACRES_PER_HA,np.nan)
    if ret is not None:
        for name,m in [('economic_loss',ret<0),('both',(ret<0)&(q==1)),('disagree',(ret<0)!=(q==1))]:
            d[name+'_ha']=np.where(vv>0,np.bincount(zone[valid&m],minlength=n)*.09,np.nan)
    return d.loc[(d.zone>0)&(d.crop_pixels>0)].copy()

def run(root,run_id=RUN_ID):
    root=Path(root);out=root/'CH4_marginality'/run_id
    out.mkdir(parents=True,exist_ok=True)
    for name in ('tables','rasters','figures','sources','logs'): (out/name).mkdir(exist_ok=True)
    log=logging.getLogger('CH4');log.setLevel(logging.INFO)
    if not log.handlers:
        log.addHandler(logging.FileHandler(out/'logs/run.log'));log.addHandler(logging.StreamHandler())
    dump(out/'status.json',{'status':'running','started_utc':datetime.now(timezone.utc).isoformat()})
    costs,elig=build(out/'tables');shutil.copytree(HERE/'sources',out/'sources',dirs_exist_ok=True)
    log.info('Auditing pinned yield, patch and NCCPI products')
    inventory=audit(root,out);county,zones=boundaries(root,out)
    soil=read(root/SOIL_RUN/'rasters/nccpi_corn_v3.tif')
    if np.nanmin(soil)<0 or np.nanmax(soil)>1:raise ValueError('NCCPI must be on 0-1 scale')
    annual=[];sens=[];associations=[];county_rows=[];patch_rows=[];transitions=[];common_rows=[]
    cuts={};file_lookup={}
    # Common-valid domains are kept separately for each yield scenario, primary years only.
    commons={s:np.ones(SHAPE,dtype=bool) for s in SCENARIOS}
    freq={s:np.zeros(SHAPE,dtype='uint8') for s in SCENARIOS};counts={s:np.zeros(SHAPE,dtype='uint8') for s in SCENARIOS}
    previous={}
    for year in YEARS:
        for scenario in SCENARIOS:
            log.info('Year %s %s',year,scenario)
            yp,mp,ip=paths(root,year,scenario);y=read(yp);crop=read(mp)==1;ix=read(ip)
            ix=np.where(np.isfinite(ix)&(ix>0),ix,0).astype('int32')
            if not np.array_equal(ix>0,crop):raise ValueError('Crop mask and patch index differ')
            if (crop&(zones==0)).any():raise ValueError('Crop pixels fall outside county-AOI coverage')
            valid=crop&np.isfinite(y)&(y>=0);y[~valid]=np.nan
            cutoff,q=quartile(y);cuts[f'{year}_{scenario}']=cutoff
            meta=dict(year=year,scenario=scenario,experimental=year==2021)
            edge=read(out/'rasters/aoi_center_outside.tif')==1
            stat=summary(y[valid]);annual.append(dict(**meta,**stat,cutoff_Mg_ha=cutoff,crop_ha=crop.sum()*.09,aoi_boundary_crop_ha=(crop&edge).sum()*.09,
                valid_ha=valid.sum()*.09,missing_ha=(crop&~valid).sum()*.09,quartile_ha=np.nansum(q)*.09,
                quartile_percent=np.nansum(q)/valid.sum()*100,nccpi_valid_ha=(valid&np.isfinite(soil)).sum()*.09))
            base=f'{year}_{scenario}'
            cog(out/f'rasters/quartile_{base}.tif',q,'1 = yield <= annual regional 25th percentile; 0 = higher yield; missing = nodata')
            # Field IDs are annual connected crop patches, never treated as persistent surveyed fields.
            pg=grouped(ix,crop,valid,y,q).assign(**meta,source='yield_only')
            cg=grouped(zones,crop,valid,y,q).assign(**meta,source='yield_only')
            assert int(pg.valid_pixels.sum())==int(cg.valid_pixels.sum())==int(valid.sum())
            assert np.isclose(pg.quartile_ha.sum(),np.nansum(q)*.09)
            patch_rows.append(pg);county_rows.append(cg)
            paired=valid&np.isfinite(soil);rr,cc=np.where(paired);east=TRANSFORM.c+(cc+.5)*30;north=TRANSFORM.f-(rr+.5)*30
            for metric,a in [('yield',y),('quartile_marginality',q)]:
                for b in (5000,10000,20000):
                    associations.append(dict(**meta,source='yield_only',metric=metric,**spatial_association(soil[paired],a[paired],east,north,b)))
            if year!=2021:
                commons[scenario]&=valid;freq[scenario]+=np.nan_to_num(q).astype('uint8');counts[scenario]+=valid.astype('uint8')
                if scenario in previous:
                    py,pq,pv=previous[scenario];keep=pv&valid
                    for old,new in SENSITIVITY_TRANSITIONS:
                        transitions.append(dict(scenario=scenario,from_year=py,to_year=year,from_class=old,to_class=new,
                            pair_common_ha=keep.sum()*.09,transition_ha=(keep&(pq==old)&(q==new)).sum()*.09,
                            source_change_caveat=year==2019))
                previous[scenario]=(year,q.copy(),valid.copy())
            for c in costs[costs.year==year].to_dict('records'):
                source=c['source'];scope=valid.copy()
                if source=='FINBIN_county':scope &= np.isin(zones,county[county.NAME.isin(['Gage','Johnson','Lancaster','Pawnee'])].zone)
                sy=np.where(scope,y,np.nan); scrop=crop&np.isfinite(np.where(scope,1,np.nan))
                # Missing-yield crop area must remain in the coverage denominator.
                scrop=crop & (np.isin(zones,county[county.NAME.isin(['Gage','Johnson','Lancaster','Pawnee'])].zone) if source=='FINBIN_county' else True)
                for pf,cf in SENSITIVITIES:
                    e=economic(sy,c['nass_price_usd_bu'],c['cash_cost_usd_ac'],c['total_cost_usd_ac'],eligible=bool(elig.set_index('year').loc[year,'eligible']),price_factor=pf,cost_factor=cf,operator_share=c['operator_share'])
                    ret=e['total_return'];loss=e['loss'];v=ret[scope];factor=c['to_2021_dollars']
                    sens.append(dict(**meta,source=source,full_economic_account=c['full_economic_account'],price_factor=pf,cost_factor=cf,
                        valid_ha=scope.sum()*.09,loss_ha=np.nansum(loss)*.09,quartile_ha=np.nansum(q[scope])*.09,
                        both_ha=((loss==1)&(q==1)).sum()*.09,disagree_ha=(scope&((loss==1)!=(q==1))).sum()*.09,
                        mean_return_usd_ac=np.nanmean(v),mean_return_2021usd_ac=np.nanmean(v)*factor,
                        total_return_usd=np.nansum(v)*.09*ACRES_PER_HA,total_return_2021usd=np.nansum(v)*.09*ACRES_PER_HA*factor,
                        mean_revenue_usd_ac=np.nanmean(e['revenue'][scope]),mean_cash_margin_usd_ac=float(np.nanmean(e['cash_margin'][scope])) if np.isfinite(e['cash_margin'][scope]).any() else np.nan,
                        breakeven_bu_ac=e['breakeven_bu_ac'],breakeven_Mg_ha=e['breakeven_Mg_ha'],
                        return_p05=np.quantile(v,.05),return_median=np.median(v),return_p95=np.quantile(v,.95)))
                    cog(out/f'rasters/loss_{base}_{source}_p{pf:.2f}_c{cf:.2f}.tif',loss,'1 = negative source-account return; FINBIN is an accounting proxy, not complete economic profit')
                    if pf==cf==1:
                        for metric in ('revenue','cash_margin','total_return'):
                            cog(out/f'rasters/{metric}_{base}_{source}.tif',e[metric],f'{metric}, nominal dollars per acre, {source}')
                        overlap=np.where(scope,q+2*loss,np.nan);cog(out/f'rasters/overlap_{base}_{source}.tif',overlap,'0 neither; 1 quartile only; 2 economic loss only; 3 both')
                        ep=grouped(ix,scrop,scope,y,q,ret,e['cash_margin'],e['revenue']).assign(**meta,source=source)
                        ec=grouped(zones,scrop,scope,y,q,ret,e['cash_margin'],e['revenue']).assign(**meta,source=source)
                        for frame in (ep,ec):
                            for col in ('return_usd_ac_mean','return_usd_ac_sum_usd','cash_margin_usd_ac_mean','revenue_usd_ac_mean'):
                                frame[col+'_2021dollars']=frame[col]*factor
                        assert np.isclose(ep.return_usd_ac_sum_usd.sum(),sens[-1]['total_return_usd'])
                        assert np.isclose(ec.return_usd_ac_sum_usd.sum(),sens[-1]['total_return_usd'])
                        assert np.isclose(ep.economic_loss_ha.sum(),sens[-1]['loss_ha'])
                        patch_rows.append(ep);county_rows.append(ec)
                        cp=paired&scope;rr2,cc2=np.where(cp);east2=TRANSFORM.c+(cc2+.5)*30;north2=TRANSFORM.f-(rr2+.5)*30
                        for metric,a in [('source_return',ret),('economic_loss',loss)]:
                            for b in (5000,10000,20000):
                                associations.append(dict(**meta,source=source,metric=metric,**spatial_association(soil[cp],a[cp],east2,north2,b)))
                del e,ret,loss
            pd.DataFrame(annual).to_csv(out/'tables/annual_yield.csv',index=False)
            pd.DataFrame(sens).to_csv(out/'tables/sensitivity.csv',index=False)
            pd.DataFrame(associations).to_csv(out/'tables/nccpi_associations.csv',index=False)
            dump(out/'progress.json',meta)
            gc.collect()
    for scenario in SCENARIOS:
        keep=commons[scenario];n=counts[scenario];f=freq[scenario]
        cog(out/f'rasters/common_valid_{scenario}.tif',np.where(n>0,keep.astype(float),np.nan),'Primary 2001-2019 all-season common-valid domain')
        cog(out/f'rasters/observed_seasons_{scenario}.tif',np.where(n>0,n,np.nan),'Number of valid observed odd crop seasons 2001-2019; 2021 excluded')
        cog(out/f'rasters/quartile_frequency_{scenario}.tif',np.divide(f,n,out=np.full(SHAPE,np.nan,dtype='float32'),where=n>0),'Fraction quartile-marginal among valid observed crop seasons; variable support')
        for year in YEARS[:-1]:
            y=read(paths(root,year,scenario)[0]);cut=cuts[f'{year}_{scenario}'];v=y[keep]
            common_rows.append(dict(year=year,scenario=scenario,common_ha=keep.sum()*.09,**summary(v),
                                   quartile_ha=(v<=cut).sum()*.09,annual_cutoff=cut,source_change_caveat=year==2019))
        rows=[]
        for observed in range(1,11):
            for marginal in range(observed+1):rows.append(dict(scenario=scenario,observed_seasons=observed,marginal_seasons=marginal,area_ha=((n==observed)&(f==marginal)).sum()*.09))
        pd.DataFrame(rows).to_csv(out/f'tables/persistence_{scenario}.csv',index=False)
    pd.DataFrame(common_rows).to_csv(out/'tables/common_valid_yield.csv',index=False)
    pd.DataFrame(transitions).to_csv(out/'tables/quartile_transitions.csv',index=False)
    patch=pd.concat(patch_rows,ignore_index=True);countyt=pd.concat(county_rows,ignore_index=True).merge(county[['zone','GEOID','NAME']],on='zone',how='left')
    patch.rename(columns={'zone':'patch_id'}).to_csv(out/'tables/patch_statistics.csv',index=False)
    countyt.to_csv(out/'tables/county_statistics.csv',index=False)
    # Attach annual patch geometry once; source-specific statistics remain a relational CSV keyed by year/scenario/patch_id.
    for year in YEARS:
        ip=paths(root,year,SCENARIOS[0])[2]
        geometry=gpd.read_file(ip.parent/'csp3_indexed_fields.gpkg',layer=f'fields_{year}')[['label_id','field_id','geometry']]
        yp=patch[(patch.year==year)&(patch.source=='yield_only')]
        for scenario in SCENARIOS:
            small=yp[yp.scenario==scenario][['zone','valid_ha','missing_ha','yield_Mg_ha_mean','quartile_ha']]
            small=small.rename(columns={c:f'{scenario}_{c}' for c in small if c!='zone'})
            geometry=geometry.merge(small,left_on='label_id',right_on='zone',how='left').drop(columns='zone')
        geometry['year']=year
        geometry.to_file(out/'CH4_spatial.gpkg',layer=f'patches_{year}',driver='GPKG')
    import sqlite3
    with sqlite3.connect(out/'CH4_spatial.gpkg') as con:
        patch.rename(columns={'zone':'patch_id'}).to_sql('patch_statistics',con,index=False,if_exists='replace')
        countyt.to_sql('county_statistics',con,index=False,if_exists='replace')
    dump(out/'tables/quartile_cutoffs.json',cuts)
    from .reporting import create_report
    create_report(out,county,root)
    files=[dict(file=str(p.relative_to(out)).replace('\\','/'),sha256=sha(p),bytes=p.stat().st_size) for p in sorted(out.rglob('*')) if p.is_file() and p.name not in ('manifest.json','status.json')]
    dump(out/'manifest.json',{'created_utc':datetime.now(timezone.utc).isoformat(),'files':files,'year_gate':'original exact-year matching UNL only','seed':SEED,'bootstrap_replicates':1999})
    dump(out/'status.json',{'status':'analysis_complete','economic_years':sorted(elig.loc[elig.eligible,'year'].tolist()),'blocked_years':sorted(elig.loc[~elig.eligible,'year'].tolist()),'experimental_year':2021,'live_app_verified':False,'github_published':False})
    log.info('CH4 analysis completed: %s',out)
    return out

SENSITIVITY_TRANSITIONS=((0,0),(0,1),(1,0),(1,1))
