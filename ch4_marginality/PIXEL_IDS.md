# Indexable cropland and pixel identity

This supplement covers **every positive annual mapped dryland-corn pixel in the
CH4 MLRA 106 analysis masks, 2001–2021 biennially**. It does not claim coverage of
other crop types, land outside those masks, or persistent farm ownership.
Pixels with missing yield or unavailable economics retain their IDs.

The authoritative shared grid is EPSG:5070, 30 m, 5,343 rows × 5,469 columns,
with affine transform `[30,0,-111285,0,-30,2047275]`. Zero-based coordinates give
`pixel_id = row * 5469 + column + 1`. Zero is reserved for noncrop/nodata.
The integer pixel ID is independent of year, yield model, economic source,
dollar basis and sensitivity, and remains stable while this grid is unchanged.
Changing the grid requires a new identity namespace.

| Key | Meaning |
|---|---|
| `CH4G5070V1:P{pixel_id}` | Shared-grid location |
| `CH4G5070V1:Y{year}:P{pixel_id}` | Annual crop membership at that location |
| `CH4G5070V1:Y{year}:C{patch_id}` | Native annual patch ID within the locked parent release |
| `field_id` | Original normalized-geometry SHA-256 footprint ID, preserved verbatim |
| `field_year_id` | Original footprint-and-year ID, preserved verbatim |

Patch labels are annual connected crop components. A numeric label can recur
in another year or change after a mask revision. Use year plus the locked
release when addressing native labels; use the original `field_id` and
`field_year_id` when comparing identical footprints across releases. Neither
identifier establishes a management boundary or ownership.

The new, independently checksummed delivery is
`PHD/CSP3_GPP_outputs/CH4_marginality/20260930_indexable_ids_v1/`:

- `annual_crop_pixel_ids.tif`: lossless UInt32 Cloud-Optimized GeoTIFF, eleven
  year bands, identical native grid and exact crop support. Nearest-neighbor
  overviews are for display; use native pixels for identity queries. Float32
  IDs are forbidden because IDs above 16,777,216 can lose integer precision.
- `crop_pixel_index.sqlite`: one row per crop pixel-year, primary key
  `(year,pixel_id)`, indexed patch membership and enforced foreign keys.
- `patch_identity_registry.csv`: every native annual patch label joined to
  its original geometry footprint IDs and reconciled pixel count.
- `identity_schema.json`, `id_coverage.csv`, `id_verification.json`: provenance,
  full coverage, integer precision and database integrity evidence.

No scientific raster, classification, cost, yield equation or monetary result
is changed. The immutable parent is `20260929_rotation_priority_budget_v1`;
the supplement references its input and output manifest hashes.

Build with the published package, locally or in the existing mounted Colab:

```python
from pathlib import Path
from ch4_marginality.pixel_identity import build
root = Path('/content/drive/MyDrive/PHD/CSP3_GPP_outputs/CH4_marginality')
build(root / '20260929_rotation_priority_budget_v1',
      root / '20260930_indexable_ids_v1')  # refuses to overwrite an existing delivery
```

Query a pixel without scanning the raster or materializing points:

```python
from ch4_marginality.pixel_identity import lookup
record = lookup(root / '20260930_indexable_ids_v1/crop_pixel_index.sqlite',
                year=2019, identity=12345678)
# None means no annual crop membership, not a zero yield or zero return.
```

The SQL view `crop_pixel_lookup` exposes IDs, grid coordinates and annual patch
joins. Filter its numeric primary-key columns to retain indexed lookup:

```sql
SELECT * FROM crop_pixel_lookup WHERE year=2019 AND pixel_id=12345678;
SELECT * FROM patches WHERE year=2019 AND patch_id=1060;
SELECT pixel_id FROM crop_pixels WHERE year=2019 AND patch_id=1060;
```

Join the resulting `(year,patch_id)` to CH4 patch summary CSVs, adding the yield
scenario, economic source and price/cost factors for a unique statistics row.
The app's existing annual raster index and polygon assets use exactly these
native labels; the supplement verifies all assignments against those original
rasters. Yield validity never controls membership.

The [updated Yield_PEM app](https://ee-njberkowitz95.projects.earthengine.app/view/yieldpem)
was published and tested for the parent CH4 release. This supplement adds
queryable local/Drive identity products; it does not replace that deployed
script or invent a second app deployment. The committed publication evidence
records the tested source hash and live patch inspection.
