# Verified indexable crop identities

The supplement indexes all 111,290 annual crop patches and 37,286,045
crop-pixel-year records in the eleven CH4 dryland-corn masks (2001–2021
biennially). There are zero unindexed crop pixels. Missing yield and economic
unavailability never remove identity. Coverage is the analysis crop domain,
not all agricultural land or persistent ownership.

See [identity methods and query instructions](../../PIXEL_IDS.md) and
`identity_schema.json`. Every original footprint ID is retained; native patch
labels are addressed by year and the locked source release. Integer pixel IDs
are stable by shared-grid location. Original budgets, models, rasters and
economic results are unchanged.

Large exact-integer COG and indexed SQLite lookup products are saved under
`PHD/CSP3_GPP_outputs/CH4_marginality/20260930_indexable_ids_v1/` through the
local Google Drive mount. The supplement's manifest lists the checksummed
files. The full original scientific release remains immutable.

All output raster IDs were read back and checked against crop support and
original patch assignments. Database primary keys enforce unique annual
pixels, foreign keys bind patches, and integrity checks pass. The current
158-file source inventory was rechecked; all sources and candidate-run
records remain unchanged. Example 2019 patch 1060 has 712 crop pixels/64.08 ha,
matching the live app's previously verified crop denominator.

The 28 scientific tests and JavaScript controller contracts pass. The six
GitHub checks on code revision `900d9995d36b35ed9327285257f837d9e714831d`
passed. `github_code_inventory.json` records all 183 published code files,
including notebooks, helpers, tests, workflows and the deployed app source.
Subsequent delivery-record commits add evidence without changing that code.

The [CH4 Yield_PEM app](https://ee-njberkowitz95.projects.earthengine.app/view/yieldpem)
was already published and tested for the parent release. Its source remains
byte-identical to that tested deployment, recorded in
`app_publication_record.json`. This supplement does not alter app code or
assets. A fresh browser check could not be completed because the Chrome
connection timed out; the prior live verification is explicitly dated and
preserved rather than represented as a new check. The Drive connector also
could not access the prior release folder, so this step verifies saved bytes
through the user's local Drive mount and does not assert a fresh cloud listing.
