"""Colab analysis from locked CH4 inputs; Chapter 4 remains read-only."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import gc
import json
from pathlib import Path
import shutil
import sqlite3

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.shutil import copy as rio_copy

from ch4_marginality.pipeline import paths, read, sha, dump, boundaries, SHAPE, TRANSFORM, SOIL_RUN
from ch4_marginality.core import YEARS, SCENARIOS, SENSITIVITIES, spatial_association
from ch4_marginality.profit_workspace import lock_inputs, distribution
from ch4_marginality.final_checks import records
from .core import calculate, yield_groups, summarize_groups, CLASS_NODATA, CLASSES, PIXEL_HA

SOURCE_RELEASE = '20260929_rotation_priority_budget_v1'
RUN_ID = '20261007_profitability_v1'
SOURCE_COMMIT = '422455e1e57d47dada284136e650ac3170682012'


def write_cog(path: Path, array: np.ndarray, description: str, categorical: bool = False) -> None:
    """Write the exact native grid with explicit nodata and reproducible overviews."""
    dtype, nodata = ('int8', CLASS_NODATA) if categorical else ('float64', -9999.)
    tmp = path.with_suffix('.partial.tif')
    with rasterio.open(tmp, 'w', driver='GTiff', height=SHAPE[0], width=SHAPE[1], count=1,
                       crs='EPSG:5070', transform=TRANSFORM, dtype=dtype, nodata=nodata,
                       tiled=True, blockxsize=512, blockysize=512, compress='deflate') as dst:
        dst.write(np.where(np.isfinite(array), array, nodata).astype(dtype), 1)
        dst.set_band_description(1, description)
        dst.update_tags(chapter='3', run_id=RUN_ID, classification='-1 loss; 0 breakeven; 1 profitable; -128 missing')
    rio_copy(tmp, path, driver='COG', compress='DEFLATE', blocksize=512, overview_resampling='nearest')
    tmp.unlink()
    with rasterio.open(path) as check:
        if check.transform != TRANSFORM or check.shape != SHAPE or check.tags(ns='IMAGE_STRUCTURE').get('LAYOUT') != 'COG':
            raise ValueError('COG contract failed')


def method_fingerprint() -> str:
    """Fingerprint the actual numerical implementation, independent of app/report edits."""
    import hashlib
    repo=Path(__file__).resolve().parents[1]
    names=['ch3_profitability/'+n+'.py' for n in ['core','pipeline','temporal']]
    names+=['ch4_marginality/'+n+'.py' for n in ['core','pipeline','profit_workspace']]
    return hashlib.sha256(json.dumps([(n,sha(repo/n)) for n in names]).encode()).hexdigest()


def checkpoint_valid(folder: Path, manifest_hash: str, method_hash: str | None = None) -> bool:
    """Reuse only complete checkpoints whose outputs and inputs still match."""
    marker = folder / 'complete.json'
    if not marker.exists():
        return False
    record = json.loads(marker.read_text(encoding='utf-8'))
    if record['input_hash'] != manifest_hash:
        raise ValueError('Checkpoint inputs changed')
    if method_hash is not None and record.get('method_hash') != method_hash:
        return False
    for row in record['files']:
        p = (folder.parent.parent if row.get('root_relative') else folder) / row['file']
        if sha(p) != row['sha256']:
            raise ValueError(f'Checkpoint output changed: {p}')
    return True


def run(root: str | Path) -> Path:
    """Compute every source/model/sensitivity with reconciled native-area summaries."""
    root = Path(root)
    prior = root / 'CH4_marginality' / SOURCE_RELEASE
    base = prior / 'analysis'
    out = root / 'CH3_profitability' / RUN_ID
    for name in ['tables','rasters','sources','logs','figures','app_assets','verification','code']:
        (out / name).mkdir(parents=True, exist_ok=True)
    if not json.loads((prior / 'validation.json').read_text(encoding='utf-8'))['verified']:
        raise ValueError('Verified Chapter 4 release required')
    original = json.loads((prior / 'input_manifest.json').read_text(encoding='utf-8'))
    print('Auditing locked spatial and economic inputs', flush=True)
    locked = lock_inputs(root, base, out, original)
    locked.update(chapter=3, run_id=RUN_ID, source_release=SOURCE_RELEASE, source_commit=SOURCE_COMMIT)
    dump(out / 'input_manifest.json', locked)
    # Timestamp is excluded from the stable numerical fingerprint.
    import hashlib
    fingerprint = hashlib.sha256(json.dumps(sorted((r['logical_path'], r['sha256']) for r in locked['files'])).encode()).hexdigest()
    methods=method_fingerprint()
    dump(out / 'status.json', dict(status='running', input_fingerprint=fingerprint, published=False))
    shutil.copytree(base / 'sources', out / 'sources', dirs_exist_ok=True)
    for name in ['economic_scenarios.csv','year_eligibility.csv','annual_yield.csv','input_inventory.csv',
                 'common_valid_yield.csv','quartile_transitions.csv','persistence_M1_fixed.csv','persistence_M2_HI_sensitivity.csv']:
        shutil.copy2(base / 'tables' / name, out / 'tables' / name)
    costs = pd.read_csv(base / 'tables/economic_scenarios.csv', float_precision='round_trip')
    eligibility = pd.read_csv(base / 'tables/year_eligibility.csv')
    enabled = set(eligibility.loc[eligibility.eligible, 'year'])
    if not set(costs.year) <= enabled or set(costs.year) & {2003, 2005, 2007}:
        raise ValueError('Blocked economic year present')
    if ((costs.year == 2009) & (costs.source == 'UNL')).any():
        raise ValueError('Incomplete 2009 UNL full account cannot produce profit')
    county, zones = boundaries(root, out)
    (out / 'CH4_spatial.gpkg').replace(out / 'CH3_spatial.gpkg')
    soil = read(root / SOIL_RUN / 'rasters/nccpi_corn_v3.tif')
    scope = read(base / 'app_assets/ch4_finbin_county_scope_corefilter_20260928.tif') == 1
    annual_yield = pd.read_csv(base / 'tables/annual_yield.csv', float_precision='round_trip')
    old_sens = pd.read_csv(base / 'tables/sensitivity.csv', float_precision='round_trip')
    # Stable native IDs are reused, not relabeled for the chapter.
    shutil.copy2(prior / 'app_assets/annual_patch_index.tif', out / 'app_assets/annual_patch_index.tif')
    for year in YEARS:
        print('Chapter 3 year', year, flush=True)
        mask = read(paths(root, year, SCENARIOS[0])[1]) == 1
        ix = np.nan_to_num(read(paths(root, year, SCENARIOS[0])[2])).astype('int32')
        if not np.array_equal(ix > 0, mask) or np.any(zones[mask] == 0):
            raise ValueError('Unindexed crop pixel or missing county assignment')
        geom = gpd.read_file(base / 'CH4_spatial.gpkg', layer=f'patches_{year}')
        geom.to_file(out / 'CH3_spatial.gpkg', layer=f'patches_{year}', driver='GPKG')
        del geom
        # Yield-only years retain their masks and quartile outputs.
        for scenario in SCENARIOS:
            qp = base / f'rasters/quartile_{year}_{scenario}.tif'
            if qp.exists(): shutil.copy2(qp, out / 'rasters' / qp.name)
        if year not in enabled:
            continue
        rr, cc = np.where(mask)
        pid, cz, nccpi = ix[mask], zones[mask], soil[mask]
        east = TRANSFORM.c + (cc + .5) * 30
        north = TRANSFORM.f - (rr + .5) * 30
        for scenario in SCENARIOS:
            y = read(paths(root, year, scenario)[0])[mask].astype('float64')
            good = np.isfinite(y) & (y >= 0)
            cut = annual_yield.query('year==@year and scenario==@scenario').cutoff_Mg_ha.item()
            q = y <= cut
            for account in costs[costs.year == year].to_dict('records'):
                source = account['source']
                key = f'{year}_{scenario}_{source}'
                cp = out / 'logs' / key
                cp.mkdir(exist_ok=True)
                if checkpoint_valid(cp, fingerprint, methods):
                    print('Verified completed checkpoint', key, flush=True)
                    continue
                valid = good & (scope[mask] if source == 'FINBIN_county' else True)
                sy = np.where(valid, y, np.nan)
                caches = {level: yield_groups(z, sy, valid) for level, z in
                          [('patch', pid), ('county', cz), ('aoi', np.ones(len(y), dtype='int32'))]}
                result_rows, county_rows, bins, associations, checks = [], [], [], [], []
                patch_dest = cp / 'patch_sensitivity.csv.gz'
                for i, (pf, cf) in enumerate(SENSITIVITIES):
                    meta = dict(year=year, scenario=scenario, source=source, price_factor=pf, cost_factor=cf,
                                experimental=year == 2021, match_designation=account['match_designation'],
                                full_economic_account=account['full_economic_account'])
                    e = calculate(sy, account, pf, cf)
                    frames = {}
                    for level, z in [('patch',pid), ('county',cz), ('aoi',np.ones(len(y), dtype='int32'))]:
                        frames[level] = summarize_groups(z, y, valid, q, account, pf, cf, caches[level]).assign(**meta)
                    aoi = frames['aoi'].iloc[0]
                    old = old_sens.query('year==@year and scenario==@scenario and source==@source and price_factor==@pf and cost_factor==@cf').iloc[0]
                    np.testing.assert_allclose(aoi.profit_mean_usd_ac, old.mean_return_usd_ac, rtol=1e-12, atol=1e-9)
                    np.testing.assert_allclose(aoi.profit_total_usd, old.total_return_usd, rtol=1e-12, atol=.01)
                    for level in frames:
                        f = frames[level]
                        np.testing.assert_allclose(f[['loss_ha','breakeven_ha','profitable_ha']].sum(axis=1,min_count=1),
                                                   f.valid_ha.where(f.valid_ha > 0), atol=1e-7, rtol=0, equal_nan=True)
                        for field in ['valid_ha','loss_ha','breakeven_ha','profitable_ha','profit_total_usd']:
                            np.testing.assert_allclose(f[field].sum(min_count=1), aoi[field], rtol=1e-12, atol=.01 if 'usd' in field else 1e-7)
                    frames['patch'].rename(columns={'zone':'patch_id'}).to_csv(patch_dest, index=False,
                                mode='w' if i == 0 else 'a', header=i == 0, compression='gzip')
                    county_rows.append(frames['county'].merge(county[['zone','GEOID','NAME']],on='zone'))
                    result_rows.append(frames['aoi'])
                    for metric, values in [('profit', e['total_return']), ('cash', e['cash_margin']), ('revenue',e['revenue'])]:
                        for basis, factor in [('nominal',1.), ('2021',account['to_2021_dollars'])]:
                            bins.extend(dict(**meta, metric=metric, basis=basis, **b) for b in distribution(values, metric, factor))
                    stem = f'{key}_p{pf:.2f}_c{cf:.2f}'
                    grid = np.full(SHAPE, CLASS_NODATA, dtype='int8'); grid[mask] = e['profit_class']
                    write_cog(out / f'rasters/profit_class_{stem}.tif', grid, 'Unrounded profit sign; -1 loss, 0 breakeven, 1 profitable', True)
                    if pf == cf == 1:
                        for metric, field in [('profit','total_return'),('cash_margin','cash_margin'),('revenue','revenue')]:
                            for basis, factor in [('nominal',1.),('2021',account['to_2021_dollars'])]:
                                a = np.full(SHAPE, np.nan); a[mask] = e[field] * factor
                                write_cog(out / f'rasters/{metric}_{key}_{basis}.tif', a, f'{metric}; {basis} USD/acre; {source}')
                                del a
                        overlap = np.full(SHAPE, CLASS_NODATA, dtype='int8')
                        overlap[rr[valid],cc[valid]] = (e['profit_class'][valid]+1)*2 + q[valid].astype('int8')
                        write_cog(out / f'rasters/profit_quartile_{key}.tif',overlap,'0 loss/nonquartile;1 loss/quartile;2 breakeven/nonquartile;3 breakeven/quartile;4 profit/nonquartile;5 profit/quartile',True)
                        cpsoil = valid & np.isfinite(nccpi)
                        for metric, values in [('profit',e['total_return']), ('profitable',(e['profit_class'] == 1).astype(float))]:
                            for block in [5000,10000,20000]:
                                associations.append(dict(**meta,metric=metric,**spatial_association(nccpi[cpsoil],values[cpsoil],east[cpsoil],north[cpsoil],block)))
                    checks.append(dict(**meta, areas_reconciled=True, monetary_totals_reconciled=True, prior_economics_equal=True))
                    del frames, e, grid
                for name, data in [('aoi_sensitivity',pd.concat(result_rows)),('county_sensitivity',pd.concat(county_rows)),
                                   ('distribution_bins',pd.DataFrame(bins)),('nccpi_associations',pd.DataFrame(associations))]:
                    data.to_csv(cp / f'{name}.csv', index=False)
                dump(cp / 'checks.json',checks)
                files = [dict(file=p.name, sha256=sha(p)) for p in sorted(cp.iterdir()) if p.name != 'complete.json']
                files += [dict(file=str(p.relative_to(out)),sha256=sha(p),root_relative=True)
                          for p in sorted((out/'rasters').glob(f'*{key}*.tif'))]
                dump(cp / 'complete.json',dict(input_hash=fingerprint, method_hash=methods, files=files))
                print('Completed',key,flush=True)
                del caches; gc.collect()
        del ix, mask; gc.collect()
    for name in ['aoi_sensitivity','county_sensitivity','distribution_bins','nccpi_associations']:
        parts = [pd.read_csv(p,float_precision='round_trip') for p in sorted((out/'logs').glob(f'*/{name}.csv'))]
        pd.concat(parts,ignore_index=True).to_csv(out/'tables'/f'{name}.csv',index=False)
    with (out/'tables/patch_sensitivity.csv.gz').open('wb') as dst:
        # Read each member to retain one CSV header across concatenated checkpoints.
        import gzip
        with gzip.GzipFile(fileobj=dst,mode='wb') as zipped:
            for i,p in enumerate(sorted((out/'logs').glob('*/patch_sensitivity.csv.gz'))):
                with gzip.open(p,'rb') as src:
                    if i: src.readline()
                    shutil.copyfileobj(src,zipped)
    from .temporal import run as temporal
    temporal(out)
    from .exports import run as exports
    exports(root,out,prior)
    lock_inputs(root,base,out,original)
    dump(out/'validation.json',dict(verified=True,input_fingerprint=fingerprint,
         economic_combinations=len(pd.read_csv(out/'tables/aoi_sensitivity.csv')),
         blocked_years=[2003,2005,2007], unrounded_sign=True, source_commit=SOURCE_COMMIT,
         colab_execution='google.colab' in __import__('sys').modules, completed_utc=datetime.now(timezone.utc).isoformat()))
    dump(out/'status.json',dict(status='analysis_complete',published=False))
    return out


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('root', type=Path)
    run(parser.parse_args().root)
