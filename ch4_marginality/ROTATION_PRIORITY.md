# Historical marginality: rotation-priority originals

This release implements the approved choice to prioritize dryland corn after soybean while retaining original production-year UNL budgets. No-till and geographic differences are explicit approximations; costs and modeled yields are not adjusted to imply conventional-tillage equivalence.

| Production year | Budget | PDF / printed page | Designation | UNL account limitation |
|---|---:|---:|---|---|
| 2001 | 15 | 29 / 15 | Approximate, no-till; Eastern geography unspecified | Published total available; cash undefined |
| 2009 | 13 | 19 / 17 | Approximate, no-till; statewide | Required additional costs blank; full return unavailable |
| 2011 | 11 | 19 / 19 | Approximate, no-till; statewide | Published material rounding residual retained |
| 2013 | 11 | 20 / 19 | Approximate, no-till; statewide | Published accounting retained |
| 2015 | 18 | 27 / 26 | Approximate, no-till; statewide | Published accounting retained |
| 2017 | 22 | 74 / 33 | Approximate, Eastern Nebraska no-till | Published accounting retained |
| 2019 | 18 | 36 / 30 | Exact | Existing values retained |
| 2021 | 18 | 30 / 30 | Exact; experimental yield | Separate from primary temporal statistics |

Original 2003/2005/2007 editions remain unrecovered. Every economic source and sensitivity is blocked for those years; yield quartile results remain available. The preserved strict register is `sources/unl_budget_registry.json`. The separate calculation register is derived from `sources/unl_rotation_selections.json`; an approximate selection never becomes exact.

UNL full-return calculations require published complete total costs. The verified 2009 original anchors separately labeled ERS and usable FINBIN scenarios but cannot supply a fabricated UNL total. FINBIN county and statewide reports retain separate annual sample counts, geography, operator shares and suppression decisions. ERS operating expenses are not a complete cash account. Missing and undefined accounts never become zero.

Finalized Nebraska NASS marketing-year prices and annual CPI-U factors are documented in `sources/rotation_annual_prices.json`, with production year separate from report publication year. The workbook retains original line items, accounting definitions, partial accounts and reconciliation residuals.

## Execution

Run `CH4_Rotation_Priority.ipynb`, followed by `CH4_Rotation_Evidence.ipynb`, in Google Colab with the authorized Drive mounted and dependencies from `requirements.txt`. Evidence submission automatically executes a separate saved verification notebook, waits for ingestion, verifies native pixels/patches and lossless chart records, and compiles the candidate after a freshness check. Live publication follows browser testing. The staged package uses `CH4_BUDGET_POLICY=closest_rotation`. Analysis checks every native input against the prior verified inventory before reusing yield-only and 2019/2021 results, then calculates the newly enabled historical economics. Economic temporal summaries exclude experimental 2021 and do not bridge missing biennial observations.

The editable workbook is authored from the final CSV tables using the bundled `@oai/artifact-tool` engine through `verify_workbook.mjs --create`. It recalculates and verifies all baseline formulas and editable price propagation; it does not rerun mapped classifications when edited.

Versioned outputs are under [the verified Drive release folder](https://drive.google.com/drive/folders/1uTn-Vu9zOLp6AOF2hDll1k8fW9DrE50X):

`PHD/CSP3_GPP_outputs/CH4_marginality/20260929_rotation_priority_budget_v1/`

The `analysis/` subdirectory holds source originals, baseline and nine-sensitivity results, nominal and constant-dollar COGs, GeoPackage, budget workbook, temporal summaries, NCCPI block uncertainty and methods/results report. Workspace evidence retains the full regional crop footprint as its missingness denominator; baseline source-account tables also document source-domain crop support. These denominators must remain distinguishable.

## App and verification

Yield_PEM adds **Exact matches only** and **Closest rotation-matched budgets** (default). Defaults remain 2019/M1/UNL/baseline/constant-2021 dollars. Approximation status, budget number, actual system and geography accompany evidence and patch inspection. Strict mode excludes all approximate years across economic sources. Histograms retain both tails; missing pixels are transparent rather than zero.

Year-scoped Earth Engine JSON evidence preserves full decimal precision and avoids the Code Editor's script-size limit. Native annual patch geometry/index assets use prefix `projects/ee-njberkowitz95/assets/ch4_rotation_20260929`. Patch attributes retain the documented Earth Engine import precision; CSVs remain authoritative. Asynchronous year/patch responses are guarded against stale selections.

Publication requires reconciled summaries, native Earth Engine pixel and patch verification, refreshed input checksums, candidate testing and CI. The previously deployed source is preserved in the release's `rollback/gee_app_Yield_PEM_before_rotation.js`. Delivery status must distinguish calculation completion, asset verification and live publication; submission alone is not successful deployment.
