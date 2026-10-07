"""Complete reporting after a verified spatial run was interrupted by DriveFS."""
from datetime import datetime, timezone
from pathlib import Path
import json
import traceback

import geopandas as gpd
import pandas as pd
import rasterio

from .core import YEARS
from .pipeline import RUN_ID, dump, sha
from .reporting import create_report


def finish(root):
    root = Path(root)
    out = root / 'CH4_marginality' / RUN_ID
    required = ['annual_yield', 'sensitivity', 'patch_statistics', 'county_statistics',
                'nccpi_associations', 'economic_scenarios', 'year_eligibility']
    for name in required:
        assert (out / 'tables' / f'{name}.csv').is_file(), name
    annual = pd.read_csv(out / 'tables/annual_yield.csv')
    assert len(annual) == 22 and set(annual.year) == set(YEARS)
    raster_files = list((out / 'rasters').glob('*.tif'))
    assert len(raster_files) == 211, len(raster_files)
    with rasterio.open(raster_files[-1]) as src:
        assert src.crs.to_epsg() == 5070 and src.res == (30, 30)
    gpkg = out / 'CH4_spatial.gpkg'
    assert gpkg.is_file()
    layers = set(gpd.list_layers(gpkg).name)
    assert {'county_aoi', 'aoi', 'patch_statistics', 'county_statistics'} <= layers
    assert all(f'patches_{year}' in layers for year in YEARS)
    county = gpd.read_file(gpkg, layer='county_aoi')
    create_report(out, county, root)
    files = [dict(file=str(p.relative_to(out)).replace('\\', '/'), sha256=sha(p), bytes=p.stat().st_size)
             for p in sorted(out.rglob('*')) if p.is_file() and p.name not in ('manifest.json', 'status.json')]
    dump(out / 'manifest.json', {'created_utc':datetime.now(timezone.utc).isoformat(),
        'files':files, 'year_gate':'original exact-year matching UNL only',
        'seed':20260928, 'bootstrap_replicates':1999})
    dump(out / 'status.json', {'status':'analysis_complete', 'economic_years':[2019, 2021],
        'blocked_years':list(YEARS[:-2]), 'experimental_year':2021,
        'live_app_verified':False, 'github_published':False})
    return out


if __name__ == '__main__':
    root = Path('G:/My Drive/PHD/CSP3_GPP_outputs')
    try:
        print(finish(root), flush=True)
    except Exception:
        out = root / 'CH4_marginality' / RUN_ID
        error = traceback.format_exc()
        (out / 'logs' / 'resume_failure.log').write_text(error, encoding='utf8')
        dump(out / 'status.json', {'status':'failed', 'traceback':error})
        raise
