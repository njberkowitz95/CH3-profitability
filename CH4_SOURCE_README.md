# CH4 marginality

Reproducible Chapter 4 analysis of dryland corn in Nebraska MLRA 106: economic
loss, lowest-yield-quartile marginality, their overlap, spatial associations and
price–cost sensitivity on verified 30 m EPSG:5070 yield rasters.

This independent repository publishes the complete verified marginality
package from `njberkowitz95/Yields-and-Fields-CH1`, revision
`dc5306dacc80fa1c809e7928a2c4899768596592`. `MIGRATION_PROVENANCE.json`
records the SHA-256 of every exported file. The package, published GEE script,
source registers and archived execution records retain their original bytes.

## Start here

- [Analysis and source guide](ch4_marginality/README.md)
- [Methods](ch4_marginality/METHODS.md) and [closest-budget policy](ch4_marginality/ROTATION_PRIORITY.md)
- [Historical Colab analysis](https://colab.research.google.com/github/njberkowitz95/CH4-marginality/blob/main/ch4_marginality/CH4_Rotation_Priority.ipynb)
- [Profit workspace Colab notebook](https://colab.research.google.com/github/njberkowitz95/CH4-marginality/blob/main/ch4_marginality/CH4_Profit_Workspace.ipynb)
- [Completed historical execution and verification](ch4_marginality/results/20260929_rotation_priority_budget_v1/)
- [Pixel-ID methods and indexed queries](ch4_marginality/PIXEL_IDS.md)
- [Completed ID verification](ch4_marginality/results/20260930_indexable_ids_v1/)
- [Deployed GEE app source](csp3_maize_gpp/gee_app_Yield_PEM.js) and [rollback copies](ch4_marginality/rollback/)

## Install and verify

Use Python 3.11 or 3.12 and Node.js 22. From this repository's root:

```text
python -m venv .venv
python -m pip install -r ch4_marginality/requirements.txt
python -m ch4_marginality.acquire_sources
python -m unittest discover -s ch4_marginality/tests -v
node --check csp3_maize_gpp/gee_app_Yield_PEM.js
node ch4_marginality/tests/profit_ui_contracts.cjs
node ch4_marginality/tests/profit_ui_contracts.cjs --compiled
```

Activate the virtual environment before installing: `.venv\Scripts\Activate.ps1`
in PowerShell, or `source .venv/bin/activate` on Linux/macOS. Source acquisition
restores checksum-pinned public originals and stops if published bytes differ.
The GitHub workflow independently retrieves the original UNL publications
required by the tests. The optional workbook authoring script uses the
`@oai/artifact-tool` runtime documented in the analysis guide.

The recorded Colab notebooks use authorized Google Drive inputs and the staged
package in their versioned release's `code/` folder. Dataset paths, checksums,
release-specific execution and verification records are preserved in the
notebooks and manifests. Notebook execution is distinct from app deployment.

## Data and published results

Large rasters, GeoPackages, budget workbooks and pixel databases remain in
Google Drive and Earth Engine. This repository includes compact tables,
source/transcription registers, manifests, completed notebooks and verification.

- [Live Yield_PEM application](https://ee-njberkowitz95.projects.earthengine.app/view/yieldpem)
- [Complete scientific Drive release](https://drive.google.com/drive/folders/1uTn-Vu9zOLp6AOF2hDll1k8fW9DrE50X)
- Drive scientific release: `PHD/CSP3_GPP_outputs/CH4_marginality/20260929_rotation_priority_budget_v1/`
- Drive ID supplement: `PHD/CSP3_GPP_outputs/CH4_marginality/20260930_indexable_ids_v1/`
- [Original implementation PR and history](https://github.com/njberkowitz95/Yields-and-Fields-CH1/pull/5)

## Scientific interpretation

The series covers eleven odd years, 2001–2021. Historical economics use
original-production-year dryland corn-after-soybean budgets, explicitly
labeling no-till and geographic approximations. Exact-match mode retains
2019 and experimental 2021. Years 2003/2005/2007 remain economically
unavailable; 2009 lacks complete UNL economic costs, and 2001 UNL cash margin
is unavailable. UNL, ERS and FINBIN retain separate accounting and geographic
definitions. Experimental 2021 is outside primary temporal summaries.

The completed analysis has 522 economic price–cost combinations. All 111,290
annual mapped crop patches and 37,286,045 crop-pixel-year records are indexed,
including missing yield. IDs describe mapped crop units and grid locations;
they do not establish farm ownership. Modeled returns are not independent
producer-profitability validation. See the methods and source records for
units, uncertainty, eligibility, missingness and reconciliation.
