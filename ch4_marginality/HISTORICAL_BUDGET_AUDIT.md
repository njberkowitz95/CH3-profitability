# Historical UNL budget recovery and strict-system review

Reviewed September 29, 2026 for Nebraska MLRA 106 CH4 marginality research.

The required enterprise is **Eastern Nebraska dryland conventional-tillage corn in a corn–soybean rotation**. Matching the production year is necessary but insufficient: tillage, rotation, irrigation status and geography also have to match. This review enables **no additional economic year**. Economic scenarios remain available for 2019 and experimental 2021; yield-quartile marginality remains available for every odd year from 2001 through 2021.

## Recovery findings

| Production year | Original publication | Reviewed dryland corn budget pages (PDF / printed) | Decision |
|---|---|---|---|
| 2001 | Recovered EC01-872 | Budgets 13–17: PDF 27–31 / printed 13–17 | Conventional budget 13 is continuous corn; budget 15 after soybean is no-till. Excluded. |
| 2003 | Original not recovered | Bibliographic lead EC03-872-S | Remains blocked; a citation is insufficient evidence. |
| 2005 | Original not recovered | EC05-838 is a different publication about alternative crops | Remains blocked; no adjacent-year or alternative-crop substitution. |
| 2007 | Original not recovered | Government catalog result identifies a 2006 publication | Remains blocked; catalog reporting year is not production year. |
| 2009 | Recovered EC09-872 | Tables 11–14: PDF 17–20 / printed 15–18 | Conventional continuous corn; no-till corn after soybean. Excluded. |
| 2011 | Recovered EC11-872 | Budgets 8–12: PDF / printed 16–20 | Conventional continuous corn; no-till corn after soybean. Excluded. |
| 2013 | Recovered EC13-872 | Budgets 8–12: PDF 17–21 / printed 16–20 | Conventional continuous corn; no-till corn after soybean. Excluded. |
| 2015 | Recovered EC872 | Budgets 15–19: PDF 24–28 / printed 23–27 | Conventional continuous corn; no-till corn after soybean. Excluded. |
| 2017 | Recovered EC872 | Budgets 16–23: PDF 68–75 / printed 27–34 | Eastern Nebraska conventional budget 16 is continuous corn. After-soybean budgets 21 and 22 are no-till. Excluded. |

The 2017 PDF has an unusual physical page order: the printed corn pages occur near the end of the file. The review inspected their actual page images and field operations, rather than relying on PDF page order or budget numbers. The reviewed candidate descriptions, yields, geographic assumptions, pages and exclusions are retained in `unl_budget_registry.json` and `unl_budget_candidates.csv`.

## Search record and source distinctions

The [CAP crop-budget archive](https://cap.unl.edu/cropbudgets/archive/) explicitly starts in 2009. The supplied [DigitalCommons record /extensionhist/2024/](https://digitalcommons.unl.edu/extensionhist/2024/) contains the **2001** publication; 2024 is its repository item number. The repository posting date is January 13, 2012. Neither number changes the production year. Its original PDF was downloaded through Chrome because a direct HTTP request returned 403; original bytes and SHA-256 are preserved.

Searches covered DigitalCommons historical-materials indexes for 2003, 2005 and 2007; targeted EC03-872/EC05-872/EC07-872 and year-specific title searches; current UNL Extension EC872 listings; Nebraska government publication catalogs; and the Internet Archive CDX index for the historically cited UNL EC872 PDF URL over 2003–2007. The CDX query returned an empty result for that specific URL and interval. This is not evidence that all historical URLs or editions are absent.

The [UNL biography of Robert Klein](https://agronomy.unl.edu/klein/) cites EC03-872-S but supplies no original file. The [2005 DigitalCommons index](https://digitalcommons.unl.edu/extensionhist/index.4.html) lists EC05-838, *Alternative Crop Budgets and Decision Making*, rather than a verified matching corn budget. The [2007 Nebraska government publications list](https://govdocs.nebraska.gov/epubs/l4200/d001-2007.pdf) lists *Nebraska Crop Budgets 2006*. These are retained as leads or exclusions; no claim is made that original 2003, 2005 or 2007 editions never existed.

Supporting literature distinguishes rotation and tillage effects in southeastern Nebraska; these treatments should not be treated as equivalent without changing the study's scenario definition. SciSpace identified the UNL/USDA study by Wilhelm and Wortmann (2004), [*Tillage and Rotation Interactions for Corn and Soybean Grain Yield as Affected by Precipitation and Air Temperature*](https://digitalcommons.unl.edu/usdaarsfacpub/66/). This literature supports maintaining the distinctions; it does not supply a missing UNL budget or validate modeled producer profits.

## Numerical results and implementation

The original production-system requirement is retained. FINBIN and ERS cannot override the UNL gate. Excluded budget costs are not used in revenue, margins, returns or breakeven calculations. This source review does not alter yield equations, raster pixels, masks, geometries, quartile cutoffs, economic inputs or experimental-year treatment.

The runtime now reads a reviewed eligibility register, checks original-year and system evidence, and verifies original checksums for every eligible year. Enabling a future year also requires reviewed cost transcriptions, a Nebraska NASS crop-year price and inflation evidence; incomplete additions fail before calculations. Budget source facts remain distinct from eligibility.

The versioned release `20260929_historical_budget_audit_v1` references the prior executed numerical release `20260929_profit_app_v1`. Its freshness verification checks the prior locked inventory and compares freshly prepared economic inputs with the published inputs. When identical, it reuses the numerical results and Earth Engine assets, publishes updated source information, and preserves the current app as a rollback copy. No model or economic rerun is warranted solely by recovering an excluded original.

See the release's `verification.json`, `source_manifest.json`, `unl_budget_candidates.csv`, reviewed original PDFs and rendered pages for evidence. The prior executed Colab notebook and checksummed numerical outputs remain authoritative for numerical results.
