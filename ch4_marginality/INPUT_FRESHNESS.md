# Input freshness audit: September 28 core-filter update

The initial CH4 run `20260928_exact_year_v1` used earlier 2019 and 2021 crop masks and fields. The original source folders now mark those products superseded. The current run `20260928_corefilter_exact_year_v2` reads the verified `extension_2019_2021/20260928_corefilter_remask_v1` products instead. It does not change the yield equations.

| Year | Input family | Initial CH4 record | Current product | Result |
| --- | --- | --- | --- | --- |
| 2001–2017 | 18 yield rasters, nine masks, nine patch indexes | SHA-256 inventory | Current Drive files | Every checksum identical |
| 2019 | M1/M2 yields, clean mask, patch index | Earlier published run | Core-filter remask run | All changed |
| 2021 experimental | M1/M2 yields, clean mask, patch index | Earlier LGRIP proxy run | Core-filter remask run | All changed |
| All years | NCCPI and MLRA boundary | Original CH4 manifest | Current Drive files | Checksums identical |

The new source manifest reports 3,921,802 valid pixels per 2019 scenario, down from 3,984,791, and 1,953,011 per experimental 2021 scenario, down from 1,999,840. It confirms that retained yield pixels are identical to the old products within the revised masks. The current field audit reports no unindexed crop pixels. The current 2019 yield hashes are `af1a6223d6a74b1d792e9640e95e50e4ba106c98a56c764047efd33d284a877b` (M1) and `a1c4ca465fa7294e201a60b858cf9dc97f8447a88dfd22f87447a3fc44e87dad` (M2). Experimental 2021 hashes are `a2a4741e965e38ab561192db9570128e16830758b0cf51883d371c7853c58271` (M1) and `b2cfd5650bec05ff383a49dd8750ae6e592888c9f894329aace66a66aa71e643` (M2).

The [full inventory](outputs/tables/input_inventory.csv) in the versioned Drive run records paths and SHA-256 hashes for every analyzed raster, mask, and patch index. GitHub main `c432832` was merged into the CH4 branch so the additive app view builds on the newest base app. The 2021 experimental caveat and exact-year UNL budget eligibility gate remain in force.
