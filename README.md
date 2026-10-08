# Chapter 3: Spatial and Temporal Crop Profitability

Modeled profitability of Nebraska MLRA 106 dryland corn for odd production years 2001–2021, using the unchanged Chapter 4 yield models, native 30 m EPSG:5070 grid, masks, accounts, prices and crop-unit identities.

**The Chapter 3 release is executed, verified and published.** All 5,347,656 patch records across 522 economic combinations reconcile with the closed GeoPackage and regional summaries. All three Earth Engine imports completed; native-grid verification passed for 58 source/model cases. Chapter 4 and the existing yield, CSP3, seasonal and NCCPI views are preserved.

- [Live Yield_PEM app](https://ee-njberkowitz95.projects.earthengine.app/view/yieldpem): select **CH3 Profitability**.
- [Versioned Drive release](https://drive.google.com/drive/folders/1gGqczx1znckJ8gqt6hvukJkRBcbDgFLm): workbooks, tables, GeoPackage, COGs, maps, report and checksummed manifests.
- [Executed analysis in Colab](https://colab.research.google.com/drive/165-0mg2VLl79SK9Qjl6SXgbaGhvS28cr) and [executed publication verification](https://colab.research.google.com/drive/1FHNIHyjaz5aAJACvg04Lc_SZyk6iBr8u).

Consult `delivery_status.json`, `verification/live_app_verification.json` and `verification/output_manifest.json` for evidence. `gee/gee_app_Yield_PEM_deployed.js` preserves the source retrieved from the published app; it differs from the canonical candidate only by an outer newline. Rollback source and its checksum remain in the Drive release.

Profit equals grain revenue minus published total per-acre costs. Positive, exactly zero and negative unrounded returns are classified independently; missing values remain missing. Cash margins are supplementary. FINBIN is an operator-account proxy; ERS is a separate regional scenario.

Closest rotation-matched original-year UNL budgets are the default, with no-till/geographic differences labeled. Exact-only policy remains available. 2003/2005/2007 remain economically unavailable; 2009 UNL full returns are unavailable. Experimental 2021 is outside primary temporal summaries; 2019 retains its mask-source caveat.

## Reproduce

Install pinned `requirements.txt` into a fresh Python 3.12+ environment before starting the analysis kernel. Mount the authorized Google Drive in Colab and run `CH3_Profitability.ipynb`. Code and input hashes are verified before computation. Earth Engine publication additionally needs the recorded Colab Earth Engine and Google Cloud Storage environment.

Local entry point: `python -m ch3_profitability.pipeline <PHD/CSP3_GPP_outputs>`. Tests: `python -m unittest discover -s ch3_profitability/tests -v`. Retained CH4 tests are under `ch4_marginality/tests`.

## Deliverables

Versioned output directory: `PHD/CSP3_GPP_outputs/CH3_profitability/20261007_profitability_v1/`.

- Nine price–cost combinations, both yield scenarios, distinct source accounts and nominal/constant-2021-dollar summaries.
- Profitability-class COGs for all sensitivities; baseline monetary COGs; yield-quartile comparisons; patch/county/AOI summaries; GeoPackage, maps and academic report.
- Baseline observed-season frequencies, three-state transitions, common-valid support, and NCCPI spatial-block uncertainty (1,999 replicates; seed 20260928; 10 km plus 5/20 km).
- Existing pixel namespace CH4G5070V1 and annual patch IDs retained. IDs describe mapped crop units, not ownership; cross-release joins require provenance.

The `ch4_marginality` package retains the original scientific implementation. `ch3_profitability` adds chapter-specific outputs without changing CH4 schemas. The verified combined GEE source is under `gee/`. See `docs/RASTER_METADATA.md` for the transparent metadata erratum affecting inherited generic COG tags; numerical bands and nodata values are verified.

Source: [CH4-marginality](https://github.com/njberkowitz95/CH4-marginality), commit `422455e1e57d47dada284136e650ac3170682012`. `CH4_SOURCE_README.md` and `MIGRATION_PROVENANCE.json` retain the original repository documentation.

These are modeled returns, not independent producer-level profitability validation. Fixed spatial prices/costs make continuous-profit associations algebraic transformations of yield associations.
