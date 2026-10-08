# Raster interpretation for the 20261007 release

The frozen numerical exporter attached a generic `classification` text tag to
all Chapter 3 rasters. That tag applies **only** to files beginning
`profit_class_`. It does not describe monetary rasters, frequency rasters,
observation counts, common-valid support, or the six-class quartile cross-tab.
The stored pixel values, band descriptions, grid, and nodata values are unchanged.
The current exporter limits the tag to the appropriate profit-class files.

Use these definitions when reading the original, checksummed COGs:

| File family | Values and interpretation |
|---|---|
| `profit_class_*` | −1 loss, 0 exact breakeven, 1 profitable; −128 nodata |
| `profit_quartile_*` | 0 loss/nonquartile, 1 loss/quartile, 2 breakeven/nonquartile, 3 breakeven/quartile, 4 profitable/nonquartile, 5 profitable/quartile; −128 nodata |
| `profit_*`, `revenue_*`, `cash_*` monetary files | Continuous USD/acre in the basis specified by the filename and band description; −9999 nodata |
| `*_frequency_*` | Fraction of observed eligible primary seasons, 0–1; −9999 nodata; not a predictive probability |
| `observed_seasons_*` | Number of eligible observed primary seasons; −9999 where no observations exist |
| `common_valid_*` | 1 in the common-valid intersection, 0 elsewhere within observed support, −9999 outside observed support |

Experimental 2021 is excluded from primary frequency, common-support, and
transition results. The app uses explicit definitions and does not interpret
the generic TIFF text tag. Native band descriptions and nodata are authoritative;
do not reclassify continuous layers using the inherited generic text tag.
