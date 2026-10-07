CH4 Economics workspace: verified-input supplement

Nebraska MLRA 106 dryland corn; version 20260929_profit_app_v1

The analysis retains the original yield equations, 30 m EPSG:5070 grid, annual masks and native crop-patch identifiers. The new workspace derives maps, regional distributions, county evidence and patch sensitivity from the same locked input inventory.

Economics is eligible only in 2019 and experimental 2021. Every other target year remains blocked for all economic sources because a matching original exact-year UNL budget is unavailable. Historical yields and quartile classifications remain available.

UNL uses the original Eastern Nebraska conventional-tillage corn-after-soybean budget. ERS Heartland is a separate regional planted-acre scenario. FINBIN is an operator-account proxy; county and statewide geography and report counts remain distinct. Shared revenue uses Nebraska NASS crop-year marketing-year prices. ERS cash margin is unavailable.

Return equals revenue minus source total costs. Cash margin uses defined cash costs only. Rates are dollars per acre; areas are hectares. CPI-U converts nominal values into constant 2021 dollars without changing marginality. Economic loss is return below zero. Yield marginality retains all values at or below the annual regional 25th percentile, including ties.

Raster distributions include explicit lower and upper saturated tails. Patch and county native areas and monetary totals reconcile to the AOI for all 126 source–model–price–cost combinations. Missing yield and source exclusions remain in denominators. Geometry identifies mapped annual crop units, not farm ownership.

NCCPI uncertainty remains baseline only: 10 km blocks, 1,999 replicates, seed 20260928, with 5 km and 20 km sensitivity results. Producer-level economic observations are unavailable for independent profitability validation.

Earth Engine table imports round numeric patch attributes. Imported totals differ from the original CSV by less than 0.001 ha, below one 0.09 ha native pixel. Full-precision CSV/GeoPackage evidence remains authoritative; raster identifiers are verified exactly.

The 2019 crop-mask source differs from historical years. Experimental 2021 uses the LGRIP2020 proxy, has identical M1 and M2 yields, and is excluded from primary temporal summaries. No economic trend line bridges unavailable years.

2019: baseline M1 UNL mean return $-0.72/acre in 2021 dollars; 144,884.16 ha negative (41.05% of 352,962.18 valid ha). Quartile area 88,240.59 ha; overlap 88,240.59 ha; disagreement 56,643.57 ha.

2021 experimental: baseline M1 UNL mean return $523.85/acre in 2021 dollars; 2.16 ha negative (0.00% of 175,770.99 valid ha). Quartile area 43,942.77 ha; overlap 2.16 ha; disagreement 43,940.61 ha.

Original CH4 methods, source ledger, budget workbook and blocked-year register accompany this supplement.

Input manifest SHA-256: 7164c8d526808f815d15c165f69958797b5853190fc3f1348ad933ac2c08e93a

UNL: https://cap.unl.edu/cropbudgets/ ; ERS: https://www.ers.usda.gov/data-products/commodity-costs-and-returns ; FINBIN: https://finbin.umn.edu/ ; Nebraska NASS: https://www.nass.usda.gov/Statistics_by_State/Nebraska/