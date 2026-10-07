"""Materialize exact, queryable crop-pixel identity without changing CH4 results.

Scope is every positive annual dryland-corn mask pixel in the CH4 AOI, including
missing yields. Pixel identity describes a location; patch identity describes an
annual mapped component, never ownership. Work is O(grid cells + crop pixels).
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import shutil
import sqlite3
import tempfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
from rasterio.shutil import copy as raster_copy
from rasterio.transform import Affine

LOG = logging.getLogger(__name__)
NAMESPACE = "CH4G5070V1"
HEIGHT, WIDTH = 5343, 5469
TRANSFORM = Affine(30, 0, -111285, 0, -30, 2047275)
YEARS = tuple(range(2001, 2022, 2))


def pixel_id(row: int, column: int, height: int = HEIGHT, width: int = WIDTH) -> int:
    """Encode zero-based row/column; reject out-of-grid and noninteger input."""
    if type(row) is not int or type(column) is not int or height <= 0 or width <= 0:
        raise ValueError("Integer grid coordinates and positive dimensions required")
    if not (0 <= row < height and 0 <= column < width):
        raise ValueError("Coordinate outside the identity grid")
    return row * width + column + 1


def pixel_coordinates(identity: int, height: int = HEIGHT, width: int = WIDTH) -> tuple[int, int]:
    """Invert an integer pixel ID; zero is reserved for noncrop/nodata."""
    if type(identity) is not int or not 1 <= identity <= height * width:
        raise ValueError("Pixel ID outside the identity grid")
    return divmod(identity - 1, width)


def create_schema(db: sqlite3.Connection) -> None:
    """Create primary/foreign keys; protect patch identity and pixel membership."""
    db.executescript(f"""
        PRAGMA foreign_keys=ON;
        CREATE TABLE patches (
            year INTEGER NOT NULL, patch_id INTEGER NOT NULL CHECK(patch_id>0),
            patch_key TEXT NOT NULL UNIQUE, field_id TEXT NOT NULL,
            field_year_id TEXT NOT NULL UNIQUE, crop_pixels INTEGER NOT NULL,
            PRIMARY KEY(year,patch_id)) WITHOUT ROWID;
        CREATE TABLE crop_pixels (
            year INTEGER NOT NULL, pixel_id INTEGER NOT NULL
                CHECK(pixel_id BETWEEN 1 AND {HEIGHT * WIDTH}),
            patch_id INTEGER NOT NULL,
            PRIMARY KEY(year,pixel_id),
            FOREIGN KEY(year,patch_id) REFERENCES patches(year,patch_id)) WITHOUT ROWID;
        CREATE VIEW crop_pixel_lookup AS SELECT year,pixel_id,patch_id,
            '{NAMESPACE}:P'||pixel_id AS pixel_key,
            '{NAMESPACE}:Y'||year||':P'||pixel_id AS pixel_year_key,
            '{NAMESPACE}:Y'||year||':C'||patch_id AS patch_key,
            CAST((pixel_id-1)/{WIDTH} AS INTEGER) AS grid_row,
            (pixel_id-1)%{WIDTH} AS grid_column FROM crop_pixels;
    """)


def lookup(database: Path, year: int, identity: int) -> dict | None:
    """Query a native pixel in O(log n); absence means noncrop, never zero yield."""
    row, column = pixel_coordinates(identity)
    with closing(sqlite3.connect(f"{database.resolve().as_uri()}?mode=ro", uri=True)) as db:
        db.row_factory = sqlite3.Row
        got = db.execute("SELECT p.*,f.field_id,f.field_year_id FROM crop_pixel_lookup p "
                         "JOIN patches f USING(year,patch_id) WHERE p.year=? AND p.pixel_id=?",
                         (year, identity)).fetchone()
    if got is None:
        return None
    result = dict(got)
    result.update(center_easting_m=TRANSFORM.c + (column + .5) * 30,
                  center_northing_m=TRANSFORM.f - (row + .5) * 30)
    return result


def checksum(path: Path) -> str:
    """Hash original bytes with bounded memory."""
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def build(parent_release: Path, destination: Path) -> dict:
    """Build and fully reconcile all 11 annual pixel indexes; never mutate parent.

    Args:
        parent_release: The checksummed rotation-priority release on Drive.
        destination: New supplement directory, which must not already exist.
    Returns:
        Coverage and integrity evidence after every pixel is verified.
    Raises:
        ValueError: A source checksum, grid, patch join or pixel count differs.
    """
    destination.mkdir(parents=True, exist_ok=False)
    parent_manifest = parent_release / "output_manifest.json"
    parent_items = {r["path"]: r["sha256"] for r in json.loads(parent_manifest.read_text(encoding="utf-8"))["files"]}
    # The parent input inventory binds masks and original field geometry independently.
    manifest = json.loads((parent_release / "input_manifest.json").read_text(encoding="utf-8"))
    if manifest["shape"] != [HEIGHT, WIDTH] or manifest["transform"] != list(TRANSFORM)[:6]:
        raise ValueError("Identity grid differs from locked CH4 grid")
    phd = parent_release.parents[2]
    inventory = manifest["files"]
    def source(role: str, suffix: str) -> Path:
        matches = [r for r in inventory if r["role"] == role and r["logical_path"].endswith(suffix)]
        if len(matches) != 1:
            raise ValueError(f"Ambiguous locked source: {role}/{suffix}")
        item = matches[0]
        path = phd / item["logical_path"]
        if checksum(path) != item["sha256"]:
            raise ValueError(f"Source changed: {path}")
        return path
    index_path = parent_release / "app_assets/annual_patch_index.tif"
    if checksum(index_path) != parent_items["app_assets/annual_patch_index.tif"]:
        raise ValueError("Published patch index checksum differs")
    coverage, evidence_sources, examples = [], [], []
    with tempfile.TemporaryDirectory(prefix="ch4_pixel_ids_") as temp_name:
        temp = Path(temp_name)
        database = temp / "crop_pixel_index.sqlite"
        raster = temp / "annual_crop_pixel_ids.tif"
        with closing(sqlite3.connect(database)) as db, rasterio.open(index_path) as patches:
            create_schema(db)
            db.execute("PRAGMA cache_size=-131072")
            profile = dict(driver="GTiff",height=HEIGHT,width=WIDTH,count=len(YEARS),dtype="uint32",
                           crs="EPSG:5070",transform=TRANSFORM,nodata=0,tiled=True,blockxsize=512,
                           blockysize=512,compress="deflate",predictor=2,interleave="band")
            with rasterio.open(raster,"w",**profile) as target:
                for band, year in enumerate(YEARS, 1):
                    index_source = source("patch_index", f"csp3_field_index_{year}.tif")
                    mask = source("mask", f"non_irrigated_corn_mlrane_{year}_clean.tif")
                    geometry = index_source.parent / "csp3_indexed_fields.gpkg"
                    geometry_item = next(r for r in inventory if r["role"] == "patch_geometry" and
                                         r["logical_path"] == geometry.relative_to(phd).as_posix())
                    if checksum(geometry) != geometry_item["sha256"]:
                        raise ValueError("Original field geometry changed")
                    with closing(sqlite3.connect(f"{geometry.resolve().as_uri()}?mode=ro", uri=True)) as original:
                        records = original.execute(f'SELECT label_id,field_id,field_year_id,crop_pixels FROM "fields_{year}"').fetchall()
                    rows = [(year,int(p),f"{NAMESPACE}:Y{year}:C{p}",fid,fy,int(n)) for p,fid,fy,n in records]
                    db.executemany("INSERT INTO patches VALUES (?,?,?,?,?,?)",rows)
                    expected = {int(p):int(n) for p,fid,fy,n in records}
                    maximum = max(expected)
                    counts = np.zeros(maximum+1,dtype="int64")
                    crop_count = 0
                    with rasterio.open(mask) as masks, rasterio.open(index_source) as originals:
                        for ds in (patches,masks,originals):
                            if ds.crs.to_epsg()!=5070 or ds.shape!=(HEIGHT,WIDTH) or ds.transform!=TRANSFORM:
                                raise ValueError("Native grid mismatch")
                        for _, window in patches.block_windows(band):
                            labels = patches.read(band,window=window)
                            crop = masks.read(1,window=window,masked=True).filled(0)==1
                            if not np.array_equal(labels>0,crop) or not np.array_equal(labels,originals.read(1,window=window)):
                                raise ValueError("Unindexed crop or changed patch assignment")
                            rr,cc = np.indices(labels.shape,dtype="uint32")
                            ids = (rr+int(window.row_off))*WIDTH+cc+int(window.col_off)+1
                            values = np.where(crop,ids,0).astype("uint32")
                            target.write(values,band,window=window)
                            counts += np.bincount(labels[crop],minlength=maximum+1)
                            crop_count += int(crop.sum())
                            db.executemany("INSERT INTO crop_pixels VALUES (?,?,?)",
                                           ((year,int(i),int(p)) for i,p in zip(ids[crop],labels[crop])))
                        target.set_band_description(band,f"y{year}")
                    if any(counts[p]!=n for p,n in expected.items()) or sum(expected.values())!=crop_count:
                        raise ValueError("Pixel/patch totals differ")
                    db.commit()
                    got = db.execute("SELECT COUNT(*) FROM crop_pixels WHERE year=?",(year,)).fetchone()[0]
                    if got!=crop_count:
                        raise ValueError("Database lost or duplicated pixels")
                    evidence_sources.append(dict(year=year,mask_sha256=checksum(mask),index_sha256=checksum(index_source),
                                                 geometry_sha256=geometry_item["sha256"]))
                    coverage.append(dict(year=year,crop_pixels=crop_count,patches=len(rows),unindexed_pixels=0,
                                         missing_yield_pixels_retained=True,verified=True))
                    for record in db.execute("SELECT pixel_id FROM crop_pixels WHERE year=? ORDER BY pixel_id LIMIT 1",(year,)):
                        examples.append(lookup(database,year,int(record[0])))
                    LOG.info("Verified %s: %s crop pixels, %s patches",year,crop_count,len(rows))
                target.update_tags(identity_namespace=NAMESPACE,id_formula="row*5469+column+1",
                                   scope="All original annual dryland corn mask pixels, including missing yield",
                                   parent_input_manifest_sha256=checksum(parent_release/"input_manifest.json"))
            db.execute("CREATE INDEX pixels_by_patch ON crop_pixels(year,patch_id,pixel_id)")
            if db.execute("PRAGMA integrity_check").fetchone()[0]!="ok" or db.execute("PRAGMA foreign_key_check").fetchall():
                raise ValueError("Pixel database failed integrity checks")
            db.commit()
            registry_rows = db.execute("SELECT * FROM patches ORDER BY year,patch_id").fetchall()
        with (destination/"patch_identity_registry.csv").open("w",encoding="utf-8",newline="") as stream:
            writer=csv.writer(stream);writer.writerow(["year","patch_id","patch_key","field_id","field_year_id","crop_pixels"])
            writer.writerows(registry_rows)
        cog=destination/"annual_crop_pixel_ids.tif"
        raster_copy(raster,cog,driver="COG",compress="DEFLATE",predictor=2,blocksize=512,overview_resampling="NEAREST")
        # Every output ID and every mask bit is independently reread after COG conversion.
        with rasterio.open(cog) as ds,rasterio.open(index_path) as patches:
            if ds.tags(ns="IMAGE_STRUCTURE").get("LAYOUT")!="COG" or ds.dtypes!=("uint32",)*len(YEARS):
                raise ValueError("Identity raster lost integer precision or COG layout")
            for band in range(1,len(YEARS)+1):
                for _,window in ds.block_windows(band):
                    rr,cc=np.indices((int(window.height),int(window.width)),dtype="uint32")
                    ids=(rr+int(window.row_off))*WIDTH+cc+int(window.col_off)+1
                    expected=np.where(patches.read(band,window=window)>0,ids,0)
                    if not np.array_equal(ds.read(band,window=window),expected):
                        raise ValueError("COG pixel identity mismatch")
        shutil.copy2(database,destination/database.name)
    schema=dict(namespace=NAMESPACE,crs="EPSG:5070",shape=[HEIGHT,WIDTH],transform=list(TRANSFORM)[:6],
                row_column_basis="zero-based",pixel_id_formula="row*5469+column+1",noncrop_nodata=0,
                pixel_key=f"{NAMESPACE}:P{{pixel_id}}",pixel_year_key=f"{NAMESPACE}:Y{{year}}:P{{pixel_id}}",
                patch_key=f"{NAMESPACE}:Y{{year}}:C{{patch_id}}",years=YEARS,source_inventory=evidence_sources,
                identity_scope="CH4 annual mapped dryland corn in MLRA 106; not every crop type or farm ownership",
                parent_release=parent_release.name,parent_input_manifest_sha256=checksum(parent_release/"input_manifest.json"),
                parent_output_manifest_sha256=checksum(parent_manifest))
    report=dict(verified=True,created_utc=datetime.now(timezone.utc).isoformat(),years=coverage,
                total_pixel_years=sum(r["crop_pixels"] for r in coverage),total_annual_patches=len(registry_rows),
                all_output_pixels_checked=True,database_integrity="ok",unindexed_crop_pixels=0,examples=examples)
    for name,value in [("identity_schema.json",schema),("id_verification.json",report)]:
        (destination/name).write_text(json.dumps(value,indent=2),encoding="utf-8")
    with (destination/"id_coverage.csv").open("w",encoding="utf-8",newline="") as stream:
        writer=csv.DictWriter(stream,fieldnames=list(coverage[0]));writer.writeheader();writer.writerows(coverage)
    return report


def main() -> None:
    """Build a supplement or query one year/pixel in an existing database."""
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parent",type=Path);parser.add_argument("--destination",type=Path)
    parser.add_argument("--database",type=Path);parser.add_argument("--year",type=int);parser.add_argument("--pixel-id",type=int)
    args=parser.parse_args();logging.basicConfig(level=logging.INFO,format="%(message)s")
    if args.database:
        if args.year is None or args.pixel_id is None:parser.error("Query needs --year and --pixel-id")
        print(json.dumps(lookup(args.database,args.year,args.pixel_id),indent=2))
    else:
        if args.parent is None or args.destination is None:parser.error("Build needs --parent and --destination")
        report=build(args.parent,args.destination)
        print(json.dumps({k:v for k,v in report.items() if k not in ["years","examples"]},indent=2))


if __name__=="__main__":
    main()
