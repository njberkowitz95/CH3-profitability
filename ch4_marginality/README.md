# CH4 marginality analysis

Every annual crop patch and crop pixel has an indexable identity. The [pixel identity supplement](PIXEL_IDS.md) publishes exact integer ID rasters, a primary-keyed pixel-to-patch database, original footprint-ID joins and full coverage evidence for all eleven analysis years, retaining pixels with missing yield.

This analysis reuses the verified 30 m EPSG:5070 dryland-corn yield products for Nebraska MLRA 106, odd years 2001–2021. It reports **economic loss** and **lowest annual yield quartile** separately and equally. Experimental 2021 is excluded from primary temporal summaries.

The September 28 core-filter update superseded the 2019 and 2021 rasters, masks, and field indexes after the initial CH4 analysis. This version uses the refreshed 2019/2021 products and current GitHub main base `c432832`; all 2001–2017 input hashes remained identical. See [input freshness audit](INPUT_FRESHNESS.md).

**The current release adds a separate closest rotation-matched policy.** It selects original-year dryland corn-after-soybean budgets for 2001/2009/2011/2013/2015/2017, explicitly labeling no-till and geographic approximations. Exact mode still enables only 2019 and experimental 2021. 2003/2005/2007 remain economically unavailable. The incomplete 2009 UNL account cannot produce full return; separately labeled ERS and verified FINBIN scenarios can be calculated. See [rotation-priority implementation](ROTATION_PRIORITY.md). Their yield-only analysis is retained. Recovered 2009–2017 originals do not offer the selected conventional-tillage corn–soybean system; The 2001 original is now recovered but also lacks the selected system. Original 2003, 2005 and 2007 files remain unrecovered; their existence is not ruled out. See [historical source review](HISTORICAL_BUDGET_AUDIT.md). These describe the preserved strict-policy audit; closest mode is governed by its separate reviewed register.

## Sources and interpretation

- UNL original production-year rotation-matched budgets for 2001/2009/2011/2013/2015/2017 and exact Budget 18 for 2019/2021. Approximation status remains explicit. The 2009 UNL total account is incomplete, 2001 cash is undefined, and the printed 2019 cash $/bushel does not reconcile; these exceptions are documented.
- FINBIN four-county and statewide reports remain separate. Operator-share revenue and incomplete opportunity-cost accounting are explicit; FINBIN negative returns are accounting proxies.
- USDA ERS Commodity Costs and Returns, annual source accounts, TB-1970 and Farm Resource Regions documentation support a separate Heartland scenario and cost reconciliation. ERS operating expenses are not assumed to be cash costs.
- Final Nebraska NASS marketing-year prices provide shared grain revenue. Source-native ERS and FINBIN prices remain distinct. CPI-U converts to 2021 purchasing-power dollars.

See [METHODS.md](METHODS.md), [source ledger](sources/acquisition_manifest.json), and the executed output eligibility register. The original CH4V4 document is preserved. No independent producer-profitability validation is claimed.

## Reproduce in Google Colab

Run [CH4_Rotation_Priority.ipynb](CH4_Rotation_Priority.ipynb), then [CH4_Rotation_Evidence.ipynb](CH4_Rotation_Evidence.ipynb), with the authorized Drive mounted. The [connected Colab run](https://colab.research.google.com/drive/10pKscDzqeBuTmwKGzbSK74UqWHOKD1Y5) executes these notebooks in separate kernels and preserves executed copies. Install `requirements.txt` if needed. Code is staged in the versioned release's `code/ch4_marginality` folder. It does not refit or change yield models. See [execution and workbook instructions](ROTATION_PRIORITY.md). The original [strict-policy notebook](CH4_Marginality.ipynb) remains available for the archived exact release.

Output directory:

`Google Drive/PHD/CSP3_GPP_outputs/CH4_marginality/20260929_rotation_priority_budget_v1/`

The run supplies a budget workbook, CSV tables, a GeoPackage, COG rasters, PNG/PDF publication figures, academic methods/results report, source originals, input inventories, fixed-seed block uncertainty and SHA-256 manifests. Large products remain in Drive; compact tables and reports are under `outputs/` in this repository. The executed notebook retains actual runtime outputs.

`python -m unittest discover -s ch4_marginality/tests -v` runs the calculation contracts. `final_checks.py` additionally reconciles patch/county/AOI areas and dollars, checks all nine sensitivities, validates every COG grid and compares all 22 Earth Engine native counts and means against Colab.

## App and rollback

The September 29 release adds the dedicated **CH4 Economics** profit workspace: continuous monetary maps, native academic charts, county sensitivities and annual crop-patch inspection. See [PROFIT_WORKSPACE.md](PROFIT_WORKSPACE.md) and [verified release status](outputs/profit_20260929/delivery_status.json). The full versioned release is [in Google Drive](https://drive.google.com/drive/folders/1fMyxJVeqOCmEXTuZ98VttYpmo7m5_pES). `gee_profit_controls.js` now supplies the CH4 interface; `gee_controls.js` preserves the earlier binary-marginality implementation.

The additive CH4 view in [Yield_PEM](https://ee-njberkowitz95.projects.earthengine.app/view/yieldpem) uses the pixel-verified 22-band asset `projects/ee-njberkowitz95/assets/ch4_verified_yields_corefilter_20260928` and audited four-county scope asset. The always-available CH4 button also opens it when the existing selector is disabled for the 2019/2021 yield extensions. Source, year, yield scenario, definition and price/cost controls are independent. Blocked economic years and suppressed FINBIN reports are explicitly unavailable.

`gee_controls.js` contains the added view; the complete deployed source is `../csp3_maize_gpp/gee_app_Yield_PEM.js`. `rollback/gee_app_Yield_PEM_pre_CH4.js` preserves the refreshed repository app source from GitHub main `c432832` (SHA-256 `07b88a85130d3eb920ba78e949e6372db763e0926e0fc2378124bb6e9025caa1`). Re-deploy that file through the existing app's **Overwrite with current contents of editor** option to roll back. Existing yield, research-site, seasonal-results and NCCPI views are preserved.

Publication and live verification evidence is recorded separately from numerical completion; inspect `outputs/delivery_status.json` for the final verified state.

## Preserved strict-policy historical audit (September 29, 2026)

The original 2001 PDF and 32 historical dryland-corn budget pages were reviewed visually. No additional economic year qualifies under the strict conventional-tillage corn–soybean definition. Eligibility now comes from `sources/unl_budget_registry.json`; original checksums, year, tillage, rotation, water and geography are validated before calculations. Future eligibility also requires reviewed cost/price/inflation inputs. The source-only release `20260929_historical_budget_audit_v1` reuses the executed numerical release after checksum and economic-input equality checks. It includes the original PDFs, review images, candidates, source searches and an app rollback. Run `python -m ch4_marginality.historical_budget_release` against the verified Drive root; this stops if numerical inputs or eligibility differ.

The [published audit release](https://drive.google.com/drive/folders/1JmwjLfWM2FwWVa07YqEvKZmExKuebz9d) contains the preserved originals and visual-review evidence, which are excluded from Git. Before reproducing the source-only publisher from a clean checkout, restore its `sources/` files into this package's `sources/`, `verification/review_pages/` into `preflight/historical_budget_review/`, and `verification/archive_responses.json` into `preflight/historical_archive_responses.json`. Reproduction requires the same parent numerical release and Drive input inventory. The register distinguishes unrecovered publications from recovered publications lacking the selected system.
