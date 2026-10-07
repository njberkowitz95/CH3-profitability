"""Pack unchanged verified yields into one multiband image for GEE ingestion."""
from pathlib import Path
import json
import numpy as np
import rasterio
from .pipeline import paths, sha, YEARS, SCENARIOS, TRANSFORM, SHAPE

def build(root, destination):
    root, destination = Path(root), Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    rows=[]
    with rasterio.open(destination,'w',driver='GTiff',height=SHAPE[0],width=SHAPE[1],
        count=22,dtype='float32',crs='EPSG:5070',transform=TRANSFORM,nodata=-9999,
        tiled=True,blockxsize=512,blockysize=512,compress='deflate',predictor=3,
        interleave='band',BIGTIFF='IF_SAFER') as dst:
        for i,(year,scenario) in enumerate((y,s) for y in YEARS for s in SCENARIOS):
            src=paths(root,year,scenario)[0]
            name=f'y{year}_{scenario[:2]}'
            with rasterio.open(src) as ds:
                assert ds.transform==TRANSFORM and ds.shape==SHAPE and ds.nodata==-9999
                for _,window in ds.block_windows(1):dst.write(ds.read(1,window=window),i+1,window=window)
            dst.set_band_description(i+1,name)
            rows.append({'band':i+1,'name':name,'year':year,'scenario':scenario,'source_sha256':sha(src)})
            print(name,flush=True)
    with rasterio.open(destination) as ds:
        for row in rows:
            with rasterio.open(paths(root,row['year'],row['scenario'])[0]) as src:
                for _,w in src.block_windows(1):
                    assert np.array_equal(ds.read(row['band'],window=w),src.read(1,window=w))
    destination.with_suffix('.json').write_text(json.dumps({'sha256':sha(destination),'bands':rows,'pixel_equality_verified':True},indent=2))
    return destination

if __name__=='__main__':
    import sys
    build(sys.argv[1],sys.argv[2])
