# Historical marginality with closest rotation-matched original-year budgets

Nebraska MLRA 106 dryland corn; 20260929_rotation_priority_budget_v1. Economic and quartile marginality receive equal reporting. This release implements the researcher’s rotation-priority choice, not an assertion that no-till and conventional production are equivalent.

## Sources and eligibility

|   year |   budget_number | match_designation   | strict_eligible   | calculation_eligible   | actual_system                                                                                  | geography                                 |
|-------:|----------------:|:--------------------|:------------------|:-----------------------|:-----------------------------------------------------------------------------------------------|:------------------------------------------|
|   2001 |              15 | Approximate         | False             | True                   | Corn, Dryland, No-Till, After Soybean                                                          | Geography not explicitly Eastern Nebraska |
|   2003 |             nan | Unavailable         | False             | False                  | nan                                                                                            | nan                                       |
|   2005 |             nan | Unavailable         | False             | False                  | nan                                                                                            | nan                                       |
|   2007 |             nan | Unavailable         | False             | False                  | nan                                                                                            | nan                                       |
|   2009 |              13 | Approximate         | False             | True                   | Corn, Rainfed, No-Till, Bt ECB After Soybean                                                   | State/rainfed                             |
|   2011 |              11 | Approximate         | False             | True                   | Corn, No-Till, Bt ECB After Soybean, Rainfed                                                   | State/rainfed                             |
|   2013 |              11 | Approximate         | False             | True                   | Corn, No-Till, Bt ECB After Soybean, Dryland                                                   | Dryland (State)                           |
|   2015 |              18 | Approximate         | False             | True                   | Corn, No-Till, Bt ECB After Soybean, Dryland                                                   | Dryland (State)                           |
|   2017 |              22 | Approximate         | False             | True                   | Corn, Eastern Nebraska No-Till, Bt & ECB, after Soybeans, Dryland                              | Eastern Nebraska                          |
|   2019 |              18 | Exact               | True              | True                   | 2019 Budget 18 Corn, Eastern Nebraska, Conventional Tillage, in Corn/Soybean Rotation, Dryland | Eastern Nebraska                          |
|   2021 |              18 | Exact               | True              | True                   | 2021 Budget 18 Corn, Eastern Nebraska, Conventional Tillage, in Corn/Soybean Rotation, Dryland | Eastern Nebraska                          |

Exact mode retains only 2019 and experimental 2021. Closest mode permits the verified original-year 2001/2009/2011/2013/2015/2017 candidates. 2003/2005/2007 remain unavailable across all economic sources; their yield quartiles remain available. No neighboring year is substituted.

The 2009 UNL page publishes field/material costs but leaves required additional costs unfilled. Its partial cost is preserved and never represented as full economic return. ERS and usable FINBIN 2009 scenarios are separately labeled. In 2001, combined opportunity/tax accounts prevent a defensible cash-cost separation; full economic cost is published, but cash margin is unavailable. Published rounding and 2011 material residuals are documented in the reconciliation sheet.

## Methods

The latest verified yield, mask, patch and NCCPI inputs were checked by checksum and spatial comparisons. The 22 modeled surfaces, yield equations and 30 m EPSG:5070 grid are unchanged. Budget assumed yields document the source system; calculations apply actual modeled pixel yields. Unchanged 2019 and experimental 2021 values are retained and independently checked. Native pixels represent 0.09 hectares.

Revenue = modeled yield in Mg/ha divided by the documented Mg/ha-per-bu/acre conversion, multiplied by finalized Nebraska crop-year marketing-year price, price factor and FINBIN operator share when applicable. Economic return subtracts source total per-acre cost multiplied by cost factor. Cash margin subtracts only an established cash-cost account. Sources retain their own geography and accounting. ERS Heartland planted-acre costs and FINBIN participant accounts do not establish producer profitability. Land, labor, machinery and overhead are counted once within each source account.

Economic marginality is return strictly below zero. Quartile marginality is yield at or below the annual regional 25th percentile, retaining ties. Source comparisons use the same source-valid support; missing yield and source exclusions retain explicit denominators. Nine combinations vary price and cost independently by −15%, baseline and +15%. Annual CPI-U ratios convert all monetary rates and sums into constant 2021 dollars without changing classifications. Histogram tails are retained.

County–AOI and crop-patch summaries sum native areas and acreage-weighted returns to the regional valid domain. Patches are annual mapped crop units, not persistent farms. Temporal results distinguish changing annual footprints from common-valid pixels. Biennial transitions are calculated only for adjacent available odd years; gaps are recorded, not bridged. Persistence uses available source-valid observation counts. Budget/tillage changes and the 2019 crop-mask source change limit interpretation of trends. Experimental 2021 is outside primary temporal summaries.

Baseline NCCPI associations use 10 km spatial blocks, 1,999 replicates, fixed seed 20260928; 5 km and 20 km checks accompany the primary results. The sample size counts pixels, while uncertainty resamples spatial blocks. Associations do not independently validate modeled profitability.

## Baseline results

|   year | scenario          | source        | match_designation   |   valid_ha |   mean_return_2021usd_ac |    loss_ha |   loss_share_percent |   quartile_ha |   both_ha |   disagree_ha |
|-------:|:------------------|:--------------|:--------------------|-----------:|-------------------------:|-----------:|---------------------:|--------------:|----------:|--------------:|
|   2019 | M1_fixed          | UNL           | Exact               | 352962.180 |                   -0.724 | 144884.160 |               41.048 |     88240.590 | 88240.590 |     56643.570 |
|   2019 | M1_fixed          | ERS_Heartland | Exact               | 352962.180 |                 -169.534 | 351499.410 |               99.586 |     88240.590 | 88240.590 |    263258.820 |
|   2019 | M1_fixed          | FINBIN_county | Exact               | 146321.730 |                  -32.556 | 104890.140 |               71.685 |     43003.080 | 43003.080 |     61887.060 |
|   2019 | M1_fixed          | FINBIN_state  | Exact               | 352962.180 |                 -146.277 | 350994.510 |               99.443 |     88240.590 | 88240.590 |    262753.920 |
|   2019 | M2_HI_sensitivity | UNL           | Exact               | 352962.180 |                  -22.465 | 235025.010 |               66.586 |     88240.590 | 88240.590 |    146784.420 |
|   2019 | M2_HI_sensitivity | ERS_Heartland | Exact               | 352962.180 |                 -191.275 | 352382.580 |               99.836 |     88240.590 | 88240.590 |    264141.990 |
|   2019 | M2_HI_sensitivity | FINBIN_county | Exact               | 146321.730 |                  -52.601 | 125321.040 |               85.648 |     43003.080 | 43003.080 |     82317.960 |
|   2019 | M2_HI_sensitivity | FINBIN_state  | Exact               | 352962.180 |                 -166.094 | 352180.980 |               99.779 |     88240.590 | 88240.590 |    263940.390 |
|   2021 | M1_fixed          | UNL           | Exact               | 175770.990 |                  523.849 |      2.160 |                0.001 |     43942.770 |     2.160 |     43940.610 |
|   2021 | M1_fixed          | ERS_Heartland | Exact               | 175770.990 |                  312.439 |     30.600 |                0.017 |     43942.770 |    30.600 |     43912.170 |
|   2021 | M1_fixed          | FINBIN_state  | Exact               | 175770.990 |                  279.354 |     34.290 |                0.020 |     43942.770 |    34.290 |     43908.480 |
|   2021 | M2_HI_sensitivity | UNL           | Exact               | 175770.990 |                  523.849 |      2.160 |                0.001 |     43942.770 |     2.160 |     43940.610 |
|   2021 | M2_HI_sensitivity | ERS_Heartland | Exact               | 175770.990 |                  312.439 |     30.600 |                0.017 |     43942.770 |    30.600 |     43912.170 |
|   2021 | M2_HI_sensitivity | FINBIN_state  | Exact               | 175770.990 |                  279.354 |     34.290 |                0.020 |     43942.770 |    34.290 |     43908.480 |
|   2001 | M1_fixed          | UNL           | Approximate         | 317267.640 |                   11.228 |  68255.370 |               21.513 |     79316.910 | 68255.370 |     11061.540 |
|   2001 | M1_fixed          | ERS_Heartland | Approximate         | 317267.640 |                 -161.605 | 317243.610 |               99.992 |     79316.910 | 79316.910 |    237926.700 |
|   2001 | M1_fixed          | FINBIN_county | Approximate         | 122084.100 |                  -31.426 |  92747.610 |               75.970 |     34310.790 | 34310.790 |     58436.820 |
|   2001 | M1_fixed          | FINBIN_state  | Approximate         | 317267.640 |                  -65.477 | 309786.660 |               97.642 |     79316.910 | 79316.910 |    230469.750 |
|   2001 | M2_HI_sensitivity | UNL           | Approximate         | 317267.640 |                   11.228 |  68255.370 |               21.513 |     79316.910 | 68255.370 |     11061.540 |
|   2001 | M2_HI_sensitivity | ERS_Heartland | Approximate         | 317267.640 |                 -161.605 | 317243.610 |               99.992 |     79316.910 | 79316.910 |    237926.700 |
|   2001 | M2_HI_sensitivity | FINBIN_county | Approximate         | 122084.100 |                  -31.426 |  92747.610 |               75.970 |     34310.790 | 34310.790 |     58436.820 |
|   2001 | M2_HI_sensitivity | FINBIN_state  | Approximate         | 317267.640 |                  -65.477 | 309786.660 |               97.642 |     79316.910 | 79316.910 |    230469.750 |
|   2009 | M1_fixed          | ERS_Heartland | Approximate         | 257156.190 |                  -48.174 | 160173.000 |               62.286 |     64289.160 | 64289.160 |     95883.840 |
|   2009 | M1_fixed          | FINBIN_county | Approximate         |  91253.700 |                   38.520 |  15038.190 |               16.480 |     31555.710 | 15038.190 |     16517.520 |
|   2009 | M1_fixed          | FINBIN_state  | Approximate         | 257156.190 |                   17.092 |  57344.040 |               22.299 |     64289.160 | 57344.040 |      6945.120 |
|   2009 | M2_HI_sensitivity | ERS_Heartland | Approximate         | 257156.190 |                  -48.174 | 160173.000 |               62.286 |     64289.160 | 64289.160 |     95883.840 |
|   2009 | M2_HI_sensitivity | FINBIN_county | Approximate         |  91253.700 |                   38.520 |  15038.190 |               16.480 |     31555.710 | 15038.190 |     16517.520 |
|   2009 | M2_HI_sensitivity | FINBIN_state  | Approximate         | 257156.190 |                   17.092 |  57344.040 |               22.299 |     64289.160 | 57344.040 |      6945.120 |
|   2011 | M1_fixed          | UNL           | Approximate         | 336546.990 |                  126.192 |  49201.830 |               14.620 |     84136.770 | 49201.830 |     34934.940 |
|   2011 | M1_fixed          | ERS_Heartland | Approximate         | 336546.990 |                 -223.177 | 327364.920 |               97.272 |     84136.770 | 84136.770 |    243228.150 |
|   2011 | M1_fixed          | FINBIN_county | Approximate         | 140630.580 |                  -75.796 | 105227.730 |               74.826 |     44497.350 | 44497.350 |     60730.380 |
|   2011 | M1_fixed          | FINBIN_state  | Approximate         | 336546.990 |                 -117.698 | 306242.100 |               90.995 |     84136.770 | 84136.770 |    222105.330 |
|   2011 | M2_HI_sensitivity | UNL           | Approximate         | 336546.990 |                  118.673 |  49231.980 |               14.629 |     84136.770 | 49231.980 |     34904.790 |
|   2011 | M2_HI_sensitivity | ERS_Heartland | Approximate         | 336546.990 |                 -230.696 | 328825.440 |               97.706 |     84136.770 | 84136.770 |    244688.670 |
|   2011 | M2_HI_sensitivity | FINBIN_county | Approximate         | 140630.580 |                  -81.825 | 110235.690 |               78.387 |     44497.350 | 44497.350 |     65738.340 |
|   2011 | M2_HI_sensitivity | FINBIN_state  | Approximate         | 336546.990 |                 -123.850 | 310249.710 |               92.186 |     84136.770 | 84136.770 |    226112.940 |
|   2013 | M1_fixed          | UNL           | Approximate         | 301600.890 |                  -99.616 | 271702.890 |               90.087 |     75400.290 | 75400.290 |    196302.600 |
|   2013 | M1_fixed          | ERS_Heartland | Approximate         | 301600.890 |                 -400.495 | 301600.890 |              100.000 |     75400.290 | 75400.290 |    226200.600 |
|   2013 | M1_fixed          | FINBIN_county | Approximate         | 120834.000 |                 -245.906 | 120810.600 |               99.981 |     39791.790 | 39791.790 |     81018.810 |
|   2013 | M1_fixed          | FINBIN_state  | Approximate         | 301600.890 |                 -324.769 | 301600.800 |              100.000 |     75400.290 | 75400.290 |    226200.510 |
|   2013 | M2_HI_sensitivity | UNL           | Approximate         | 301600.890 |                  -51.230 | 188941.860 |               62.646 |     75400.290 | 75400.290 |    113541.570 |
|   2013 | M2_HI_sensitivity | ERS_Heartland | Approximate         | 301600.890 |                 -352.109 | 301592.160 |               99.997 |     75400.290 | 75400.290 |    226191.870 |
|   2013 | M2_HI_sensitivity | FINBIN_county | Approximate         | 120834.000 |                 -205.446 | 120243.060 |               99.511 |     39791.790 | 39791.790 |     80451.270 |
|   2013 | M2_HI_sensitivity | FINBIN_state  | Approximate         | 301600.890 |                 -283.839 | 301578.840 |               99.993 |     75400.290 | 75400.290 |    226178.550 |
|   2015 | M1_fixed          | UNL           | Approximate         | 306756.720 |                   31.192 |  53779.590 |               17.532 |     76689.180 | 53779.590 |     22909.590 |
|   2015 | M1_fixed          | ERS_Heartland | Approximate         | 306756.720 |                 -232.202 | 305849.070 |               99.704 |     76689.180 | 76689.180 |    229159.890 |
|   2015 | M1_fixed          | FINBIN_county | Approximate         | 128283.480 |                  -77.215 |  97117.650 |               75.706 |     41447.340 | 41447.340 |     55670.310 |
|   2015 | M1_fixed          | FINBIN_state  | Approximate         | 306756.720 |                 -173.986 | 303984.270 |               99.096 |     76689.180 | 76689.180 |    227295.090 |
|   2015 | M2_HI_sensitivity | UNL           | Approximate         | 306756.720 |                  103.086 |  47396.070 |               15.451 |     76689.180 | 47396.070 |     29293.110 |
|   2015 | M2_HI_sensitivity | ERS_Heartland | Approximate         | 306756.720 |                 -160.307 | 293999.310 |               95.841 |     76689.180 | 76689.180 |    217310.130 |
|   2015 | M2_HI_sensitivity | FINBIN_county | Approximate         | 128283.480 |                  -15.113 |  32204.970 |               25.105 |     41447.340 | 32204.970 |      9242.370 |
|   2015 | M2_HI_sensitivity | FINBIN_state  | Approximate         | 306756.720 |                 -111.453 | 281035.080 |               91.615 |     76689.180 | 76689.180 |    204345.900 |
|   2017 | M1_fixed          | UNL           | Approximate         | 314033.940 |                 -237.833 | 314028.810 |               99.998 |     78508.530 | 78508.530 |    235520.280 |
|   2017 | M1_fixed          | ERS_Heartland | Approximate         | 314033.940 |                 -286.849 | 314033.940 |              100.000 |     78508.530 | 78508.530 |    235525.410 |
|   2017 | M1_fixed          | FINBIN_state  | Approximate         | 314033.940 |                 -235.516 | 314033.850 |              100.000 |     78508.530 | 78508.530 |    235525.320 |
|   2017 | M2_HI_sensitivity | UNL           | Approximate         | 314033.940 |                 -206.484 | 313786.170 |               99.921 |     78508.530 | 78508.530 |    235277.640 |
|   2017 | M2_HI_sensitivity | ERS_Heartland | Approximate         | 314033.940 |                 -255.500 | 314029.350 |               99.999 |     78508.530 | 78508.530 |    235520.820 |
|   2017 | M2_HI_sensitivity | FINBIN_state  | Approximate         | 314033.940 |                 -207.628 | 314004.060 |               99.990 |     78508.530 | 78508.530 |    235495.530 |

## Verification and limitations

Source totals, year alignment, exact/approximate policy gates, annual prices, CPI factors, missing values, quartile ties, sensitivity monotonicity and spatial sums are tested. Reused numeric records are checked exactly. Floating point COG monetary storage is float32; authoritative monetary totals and JSON evidence use full precision. Common-domain return summaries derived from COGs therefore retain that documented storage precision.

## References



UNL originals: https://cap.unl.edu/cropbudgets/archive/ and https://digitalcommons.unl.edu/extensionhist/2024/ . Original bytes, SHA-256, selected PDF/printed pages and transcription evidence accompany this release. Repository identifier 2024 is not the production year of the 2001 publication.



USDA NASS Crop Values annual summaries: https://esmis.nal.usda.gov/publication/crop-values-annual-summary . Finalized Nebraska marketing-year corn prices are linked to production year separately from report publication year. USDA ERS Commodity Costs and Returns: https://www.ers.usda.gov/data-products/commodity-costs-and-returns . FINBIN: https://finbin.umn.edu/ . BLS annual CPI-U: https://www.bls.gov/cpi/tables/supplemental-files/historical-cpi-u-202106.pdf and https://www.bls.gov/regions/mid-atlantic/data/consumerpriceindexannualandsemiannual_table.htm .



Literature identified through SciSpace supports treating rotation and tillage as distinct factors: Wilhelm and Wortmann (2004), Tillage and Rotation Interactions for Corn and Soybean Grain Yield as Affected by Precipitation and Air Temperature, doi:10.2134/agronj2004.0425, https://digitalcommons.unl.edu/usdaarsfacpub/66/ ; Rathke, Wienhold, Wilhelm and Diepenbrock (2007), Tillage and rotation effect on corn–soybean energy balances in eastern Nebraska, doi:10.1016/j.still.2007.08.008, https://digitalcommons.unl.edu/usdaarsfacpub/109/ . These references motivate explicit mismatch reporting; they do not justify applying invented yield or cost adjustments.

