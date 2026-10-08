"""Recover interrupted cloud-file writes without changing scientific inputs.

CSV append streams and SQLite transactions are completed on local disk before
copying closed files to Drive. Original checkpoint records remain in evidence.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from datetime import datetime, timezone
import gc
import gzip
import json
import shutil
import sqlite3

import geopandas as gpd
import numpy as np
import pandas as pd

from ch4_marginality.pipeline import paths, read, sha, dump
from ch4_marginality.core import SENSITIVITIES
from .core import yield_groups, summarize_groups
from .pipeline import SOURCE_RELEASE

KEYS = ['year', 'scenario', 'source', 'price_factor', 'cost_factor']
TOTALS = ['valid_ha', 'profitable_ha', 'breakeven_ha', 'loss_ha', 'profit_total_usd']


def publish_closed_file(source: Path, destination: Path) -> str:
    """Copy a closed, immutable file and verify its bytes at the destination."""
    expected = sha(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    staged = destination.with_name(destination.name + '.uploading')
    shutil.copyfile(source, staged)
    if sha(staged) != expected:
        raise ValueError(f'Cloud copy checksum mismatch: {destination}')
    staged.replace(destination)
    if sha(destination) != expected:
        raise ValueError(f'Published checksum mismatch: {destination}')
    return expected


def validate_patch_frame(frame: pd.DataFrame, expected: pd.DataFrame) -> None:
    """Require all nine combinations, unique IDs, and reconciled native totals."""
    if frame.duplicated(KEYS + ['patch_id']).any():
        raise ValueError('Duplicate patch/sensitivity identity')
    got = frame.groupby(KEYS)[TOTALS].sum(min_count=1).sort_index()
    target = expected.set_index(KEYS)[TOTALS].sort_index()
    if not got.index.equals(target.index):
        raise ValueError('Patch sensitivity combinations are incomplete')
    np.testing.assert_allclose(got, target, rtol=1e-12, atol=.01)
    np.testing.assert_allclose(
        frame[['profitable_ha', 'breakeven_ha', 'loss_ha']].sum(axis=1, min_count=1),
        frame.valid_ha.where(frame.valid_ha > 0), rtol=0, atol=1e-7)


def recover_patches(root: Path, out: Path, scratch: Path) -> list[dict]:
    """Recompute only damaged patch tables using unchanged raster/model inputs."""
    prior = root / 'CH4_marginality' / SOURCE_RELEASE
    base = prior / 'analysis'
    accounts = pd.read_csv(out / 'tables/economic_scenarios.csv', float_precision='round_trip')
    annual = pd.read_csv(out / 'tables/annual_yield.csv', float_precision='round_trip')
    evidence = out / 'verification/cloud_write_recovery'
    evidence.mkdir(parents=True, exist_ok=True)
    changes = []
    for cp in sorted((out / 'logs').glob('*')):
        if not cp.is_dir() or not (cp / 'complete.json').exists():
            continue
        marker = json.loads((cp / 'complete.json').read_text(encoding='utf-8'))
        row = next(r for r in marker['files'] if r['file'] == 'patch_sensitivity.csv.gz')
        path = cp / row['file']
        actual = sha(path)
        expected = pd.read_csv(cp / 'aoi_sensitivity.csv', float_precision='round_trip')
        frame = pd.read_csv(path, float_precision='round_trip')
        if actual == row['sha256']:
            validate_patch_frame(frame, expected)
            continue
        print('Recovering closed patch output:', cp.name, flush=True)
        backup = evidence / cp.name
        backup.mkdir(exist_ok=True)
        if not (backup / 'complete_original.json').exists():
            shutil.copyfile(cp / 'complete.json', backup / 'complete_original.json')
            shutil.copyfile(path, backup / 'patch_incomplete.csv.gz')
        meta = expected.iloc[0]
        year, scenario, source = int(meta.year), meta.scenario, meta.source
        account = accounts[(accounts.year == year) & (accounts.source == source)].iloc[0].to_dict()
        yp, mp, ip = paths(root, year, scenario)
        mask = read(mp) == 1
        ids = read(ip)[mask].astype('int32')
        yields = read(yp)[mask].astype('float64')
        valid = np.isfinite(yields) & (yields >= 0)
        if source == 'FINBIN_county':
            valid &= read(base / 'app_assets/ch4_finbin_county_scope_corefilter_20260928.tif')[mask] == 1
        cutoff = annual[(annual.year == year) & (annual.scenario == scenario)].cutoff_Mg_ha.item()
        cached = yield_groups(ids, np.where(valid, yields, np.nan), valid)
        parts = []
        for pf, cf in SENSITIVITIES:
            stats = summarize_groups(ids, yields, valid, yields <= cutoff, account, pf, cf, cached)
            parts.append(stats.rename(columns={'zone': 'patch_id'}).assign(
                year=year, scenario=scenario, source=source, price_factor=pf, cost_factor=cf,
                experimental=year == 2021, match_designation=account['match_designation'],
                full_economic_account=account['full_economic_account']))
        restored = pd.concat(parts, ignore_index=True)
        validate_patch_frame(restored, expected)
        # Existing intact rows must remain numerically equal, including missingness.
        old = frame.set_index(KEYS + ['patch_id']).sort_index()
        common = restored.set_index(KEYS + ['patch_id']).loc[old.index, old.columns]
        pd.testing.assert_frame_equal(common, old, check_dtype=False, check_index_type=False,
                                      rtol=1e-12, atol=1e-8)
        local = scratch / (cp.name + '.csv.gz')
        restored.to_csv(local, index=False, compression={'method': 'gzip', 'mtime': 0})
        new_hash = publish_closed_file(local, path)
        change = dict(checkpoint=cp.name, incomplete_sha256=actual,
                      original_expected_sha256=row['sha256'], recovered_sha256=new_hash,
                      preserved_rows_verified=len(frame), restored_rows=len(restored),
                      unchanged_methods=True, all_nine_sensitivities_reconciled=True)
        row['sha256'] = new_hash
        marker['cloud_write_recovery'] = change
        dump(cp / 'complete.json', marker)
        changes.append(change)
        dump(evidence / 'patch_recovery.json', changes)
        del frame, restored, parts, cached, ids, yields, mask
        gc.collect()
    return changes


def assemble_patches(out: Path, scratch: Path) -> Path:
    """Assemble verified CSV members on local disk, retaining one header."""
    target = scratch / 'patch_sensitivity.csv.gz'
    with target.open('wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', mtime=0) as dst:
        header = None
        for path in sorted((out / 'logs').glob('*/patch_sensitivity.csv.gz')):
            marker = json.loads((path.parent / 'complete.json').read_text(encoding='utf-8'))
            expected = next(r['sha256'] for r in marker['files'] if r['file'] == path.name)
            if sha(path) != expected:
                raise ValueError(f'Checkpoint changed during assembly: {path}')
            with gzip.open(path, 'rb') as src:
                candidate = src.readline()
                if header is None:
                    header = candidate
                    dst.write(header)
                elif candidate != header:
                    raise ValueError('Patch CSV schema changed')
                shutil.copyfileobj(src, dst)
    return target


def build_spatial(root: Path, out: Path, scratch: Path, patches: Path) -> Path:
    """Build and integrity-check SQLite locally; never transact on mounted Drive."""
    prior = root / 'CH4_marginality' / SOURCE_RELEASE / 'analysis/CH4_spatial.gpkg'
    target = scratch / 'CH3_spatial.gpkg'
    for name in ['county_aoi', 'aoi'] + [f'patches_{y}' for y in range(2001, 2022, 2)]:
        gpd.read_file(prior, layer=name).to_file(target, layer=name, driver='GPKG')
    with sqlite3.connect(target) as con:
        for name in ['annual_profitability', 'county_sensitivity']:
            pd.read_csv(out / 'tables' / (name + '.csv'), float_precision='round_trip').to_sql(
                name, con, index=False, if_exists='replace')
        rows = 0
        for chunk in pd.read_csv(patches, chunksize=50000, float_precision='round_trip'):
            chunk.to_sql('patch_sensitivity', con, index=False, if_exists='replace' if rows == 0 else 'append')
            rows += len(chunk)
        con.execute('CREATE INDEX ch3_patch_lookup ON patch_sensitivity(year,patch_id,scenario,source,price_factor,cost_factor)')
        for name in ['annual_profitability', 'county_sensitivity', 'patch_sensitivity']:
            con.execute("INSERT INTO gpkg_contents(table_name,data_type,identifier,description) VALUES (?, 'attributes', ?, ?)",
                        (name, name, 'Chapter 3 modeled profitability; original-year source accounts; missing values retained'))
        con.commit()
        if con.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('GeoPackage integrity failed')
        if con.execute('SELECT COUNT(*) FROM patch_sensitivity').fetchone()[0] != rows:
            raise ValueError('GeoPackage patch row count failed')
    print('Closed GeoPackage verified:', rows, 'patch rows', flush=True)
    return target


def run(root: Path, out: Path) -> dict:
    """Repair cloud-write artifacts and preserve the executed scientific package."""
    root, out = Path(root), Path(out)
    package = Path(__file__).resolve().parents[1]
    for name in ['ch3_profitability/core.py', 'ch4_marginality/core.py']:
        if sha(package / name) != sha(out / 'code' / name):
            raise ValueError('Recovery must use the frozen scientific calculations')
    with TemporaryDirectory(prefix='ch3_closed_outputs_') as folder:
        scratch = Path(folder)
        changes = recover_patches(root, out, scratch)
        print('Assembling verified patch tables', flush=True)
        patches = assemble_patches(out, scratch)
        patch_sha = publish_closed_file(patches, out / 'tables/patch_sensitivity.csv.gz')
        spatial = build_spatial(root, out, scratch, patches)
        spatial_sha = publish_closed_file(spatial, out / 'CH3_spatial.gpkg')
    result = dict(verified=True, recovered_utc=datetime.now(timezone.utc).isoformat(),
                  checkpoint_repairs=changes, patch_table_sha256=patch_sha,
                  geopackage_sha256=spatial_sha, local_closed_file_publication=True,
                  yield_equations_prices_costs_and_rasters_unchanged=True)
    dump(out / 'verification/cloud_write_recovery.json', result)
    return result
