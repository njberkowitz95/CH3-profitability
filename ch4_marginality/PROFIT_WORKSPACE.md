# CH4 Economics workspace

The September 29 release adds continuous revenue, cash-margin and total-return maps; loss/quartile agreement; area-weighted distributions with tails; county summaries; a nine-combination sensitivity matrix; baseline NCCPI uncertainty; and annual crop-patch inspection to the existing Yield_PEM app. The default is 2019, M1, UNL, baseline prices/costs and constant 2021 dollars. Monetary rates are dollars per acre; areas are hectares.

The current rotation-priority release adds two policies: Closest rotation-matched budgets (default) and Exact matches only. The former enables verified original-year historical approximations with visible system/geography labels; the latter retains 2019 and experimental 2021. 2003/2005/2007 remain blocked. Historical yield quartiles remain available. See ROTATION_PRIORITY.md. FINBIN statewide and four-county accounts are distinct operator-account proxies. ERS Heartland operating costs do not establish a cash-cost account; cash margins are unavailable for that source. Suppressed 2021 county FINBIN data remain unavailable.

## Reproduction and evidence

Run `CH4_Profit_Workspace.ipynb` in authenticated Google Colab with access to the versioned Drive helper package. The executed September 29 notebook retains the original analysis and actual profit-workspace outputs, including 15 passed calculation tests, 11 verified annual geometry assets, 77 native patch-ID pixel checks, 33 patch-property checks and 210 economic pixel comparisons across 14 source/model cases.

The 134-file input inventory records grids, paths, hashes, verification and supersession evidence. GitHub main `c432832` and the September 28 field-cleanup branches have identical relevant numerical inventories. Changed canonical crop-mask encodings were compared pixel by pixel and contain no changed classifications. The latest refreshed 2019/2021 yields and annual fields are used. Reused baseline tables match their input hashes; newly derived county/patch sensitivities and distribution bins reconcile with the AOI. The freshness gate runs again when compiling a candidate and stops on changed inputs or candidate inventories.

Drive release directory:

`PHD/CSP3_GPP_outputs/CH4_marginality/20260929_profit_app_v1/`

The directory contains full input/output manifests, workbook and source originals, precise CSV summaries, GeoPackage layers, six continuous baseline COGs, publication PNG/PDF charts and maps, methods/results supplement, reviewed code and rollback source. Compact results and verification records are in `outputs/profit_20260929/`. Large patch-sensitivity outputs remain in Drive.

Earth Engine assets use prefix `projects/ee-njberkowitz95/assets/ch4_profit_20260929`, with `_index` and eleven `_patches_YEAR` tables. The app reads the native annual raster ID and retrieves the matching polygon. IDs describe mapped annual crop units and do not establish ownership or persistent farm identity. Imported numeric table properties have small float rounding; the precise CSVs remain authoritative. Documented aggregate rounding is less than 0.001 ha.

## App verification and rollback

`build_profit_app.py` requires reconciled tables, verified assets and native profit-pixel checks before compiling the full app. Builds use identical UTF-8/LF bytes in Colab and Windows. Calculation tests cover units, eligibility, source scope, currency conversion, quartile ties, missing data and sensitivities. The native UI contract checks defaults, stale asynchronous responses, annual patch reset and restoration of existing views. CI also runs the original CSP3 checks.

The prior deployed CH4 app is preserved at `rollback/gee_app_Yield_PEM_pre_profit_20260929.js` and `Yield_PEM_rollback_20260929.js` in Drive, SHA-256 `d9bcc527b24f9eaa5aa5bfc8b0bf72c866d2524baad780c440f84464bbba23e2`. Restore it through the existing app's overwrite option. Publication is recorded separately from numerical verification; consult the release delivery status for live-app verification.
