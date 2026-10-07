
/**
 * =========================================================================================
 * GOOGLE EARTH ENGINE APPLICATION: DISSERTATION CHAPTER 2
 * Production-Efficiency Maize Yield Modeling & Statistical Analytics
 * MLRA 106 (Nebraska) · Available Odd Years 2001–2021
 *
 * Focal Research Station: US-Ne3 / CSP3 AmeriFlux Site (Mead, NE)
 *
 * Model Equations (PEMOC Sequence):
 *   NPP_season(i,y) = NPP_annual(i,y) * [ sum_season(GPP) / sum_calendar(GPP) ]
 *   Biomass(i,y)    = 2.5 * NPP_season(i,y)
 *   AGB(i,y)        = Biomass(i,y) / (1 + RS),  RS = 0.18
 *   Yield(i,y)      = AGB(i,y) * HI(y) / (1 - MC) * 10 [Mg ha-1],  MC = 0.155
 *
 * Features:
 *   - Full Official MLRA 106 Nebraska AOI Boundary Polygon (194 vertices)
 *   - CSP3 AmeriFlux Tower (US-Ne3: Lat 41.1797° N, Lon -96.4397° W)
 *   - CSP3 Research Field Footprint (Field 1793, ~65 ha / 160 ac quarter section)
 *   - Historical CSP3 Management Data (hybrids, seeding rates, harvest moisture, combine yield)
 *   - Section 9 Colab Statistical Visualizations (Yield, GPP, NPP, Field Segmentation)
 *   - S8 Tower Ground-Truth Validation & IndigoAg Commercial Field Benchmarks
 *   - Interactive Navigation: Quick-zoom buttons, layer opacity slider, and point inspector
 *
 * Author: N. Berkowitz (University of Nebraska-Lincoln)
 * Repository / Project: ee-njberkowitz95
 * =========================================================================================
 */

// -----------------------------------------------------------------------------------------
// 1. DATA DICTIONARIES: STATS & OUTPUTS FROM GOOGLE COLAB & CSP3 WORKBOOKS
// -----------------------------------------------------------------------------------------

// Cleaned non-irrigated corn mask (11 bands, 2001–2021, 30 m, EPSG:5070), uploaded from
// non_irrigated_corn/clean via CSP3_GPP_outputs/gee_assets/non_irrigated_corn_clean_2001_2021.tif.
// Bands 0–8 = 2001–2017 (used by the live model below). Bands 9–10 = 2019 and 2021 (2021 is the
// LGRIP2020 proxy); those years are drawn from their own published extension layers.
var CLEAN_MASK_IMG = ee.Image('projects/ee-njberkowitz95/assets/non_irrigated_corn_clean_2001_2021');
var CLEAN_MASK_YEARS = [2001, 2003, 2005, 2007, 2009, 2011, 2013, 2015, 2017];

var COLAB_STATS = {
  years: [2001, 2003, 2005, 2007, 2009, 2011, 2013, 2015, 2017],

  // Section 9 Verified Annual Yield Statistics across MLRA 106
  yield: {
    2001: {
      M1_fixed: {mean: 7.743, sd: 1.401, min: 1.463, max: 11.932, valid_ha: 317267.6, crop_ha: 326203.7, prod_Mg: 2456507, hi: 0.5000, hi_type: "Fixed Fill (0.50)"},
      M2_HI_sensitivity: {mean: 7.743, sd: 1.401, min: 1.463, max: 11.932, valid_ha: 317267.6, crop_ha: 326203.7, prod_Mg: 2456507, hi: 0.5000, hi_type: "Fixed Fill (0.50)"}
    },
    2003: {
      M1_fixed: {mean: 7.301, sd: 1.327, min: 1.122, max: 11.649, valid_ha: 282064.2, crop_ha: 289853.7, prod_Mg: 2059295, hi: 0.5000, hi_type: "Fixed Fill (0.50)"},
      M2_HI_sensitivity: {mean: 7.301, sd: 1.327, min: 1.122, max: 11.649, valid_ha: 282064.2, crop_ha: 289853.7, prod_Mg: 2059295, hi: 0.5000, hi_type: "Fixed Fill (0.50)"}
    },
    2005: {
      M1_fixed: {mean: 7.671, sd: 1.466, min: 1.082, max: 13.059, valid_ha: 307240.7, crop_ha: 316100.7, prod_Mg: 2356791, hi: 0.5000, hi_type: "Fixed Fill (0.50)"},
      M2_HI_sensitivity: {mean: 6.645, sd: 1.270, min: 0.938, max: 11.312, valid_ha: 307240.7, crop_ha: 316100.7, prod_Mg: 2041492, hi: 0.4331, hi_type: "Field Yield / Biomass R6"}
    },
    2007: {
      M1_fixed: {mean: 8.395, sd: 1.619, min: 1.620, max: 13.849, valid_ha: 312313.7, crop_ha: 321235.5, prod_Mg: 2621882, hi: 0.5000, hi_type: "Fixed Fill (0.50)"},
      M2_HI_sensitivity: {mean: 7.827, sd: 1.509, min: 1.510, max: 12.911, valid_ha: 312313.7, crop_ha: 321235.5, prod_Mg: 2444368, hi: 0.4661, hi_type: "Field Yield / Biomass R6"}
    },
    2009: {
      M1_fixed: {mean: 9.164, sd: 1.756, min: 0.492, max: 14.514, valid_ha: 257156.2, crop_ha: 265079.9, prod_Mg: 2356460, hi: 0.5000, hi_type: "Fixed Fill (0.50)"},
      M2_HI_sensitivity: {mean: 9.164, sd: 1.756, min: 0.492, max: 14.514, valid_ha: 257156.2, crop_ha: 265079.9, prod_Mg: 2356460, hi: 0.5000, hi_type: "Fixed Fill (0.50)"}
    },
    2011: {
      M1_fixed: {mean: 4.650, sd: 1.263, min: 0.000, max: 9.561, valid_ha: 336547.0, crop_ha: 346792.8, prod_Mg: 1564906, hi: 0.5000, hi_type: "Fixed Fill (0.50)"},
      M2_HI_sensitivity: {mean: 4.586, sd: 1.246, min: 0.000, max: 9.430, valid_ha: 336547.0, crop_ha: 346792.8, prod_Mg: 1543327, hi: 0.4931, hi_type: "Field Yield / Biomass R6"}
    },
    2013: {
      M1_fixed: {mean: 5.119, sd: 1.382, min: 0.000, max: 9.797, valid_ha: 301600.9, crop_ha: 310377.1, prod_Mg: 1543889, hi: 0.5000, hi_type: "Fixed Fill (0.50)"},
      M2_HI_sensitivity: {mean: 5.703, sd: 1.540, min: 0.000, max: 10.915, valid_ha: 301600.9, crop_ha: 310377.1, prod_Mg: 1720061, hi: 0.5571, hi_type: "Kernel Partition R6"}
    },
    2015: {
      M1_fixed: {mean: 8.884, sd: 2.107, min: 1.159, max: 14.236, valid_ha: 306756.7, crop_ha: 315754.7, prod_Mg: 2725245, hi: 0.5000, hi_type: "Fixed Fill (0.50)"},
      M2_HI_sensitivity: {mean: 9.990, sd: 2.369, min: 1.303, max: 16.007, valid_ha: 306756.7, crop_ha: 315754.7, prod_Mg: 3064413, hi: 0.5622, hi_type: "Provisional Mixed R5"}
    },
    2017: {
      M1_fixed: {mean: 8.232, sd: 2.081, min: 0.972, max: 12.809, valid_ha: 314033.9, crop_ha: 323178.2, prod_Mg: 2585079, hi: 0.5000, hi_type: "Fixed Fill (0.50)"},
      M2_HI_sensitivity: {mean: 8.763, sd: 2.216, min: 1.035, max: 13.636, valid_ha: 314033.9, crop_ha: 323178.2, prod_Mg: 2751940, hi: 0.5323, hi_type: "Provisional Partition R5"}
    }
  },

  // Field Patch & Landscape Statistics across MLRA 106
  patches: {
    2001: {n_patches: 10894, median_ha: 14.94, mean_ha: 29.94, max_ha: 660.8},
    2003: {n_patches: 9526, median_ha: 13.68, mean_ha: 30.43, max_ha: 522.9},
    2005: {n_patches: 10183, median_ha: 15.39, mean_ha: 31.04, max_ha: 652.6},
    2007: {n_patches: 10065, median_ha: 15.39, mean_ha: 31.92, max_ha: 618.7},
    2009: {n_patches: 10674, median_ha: 12.96, mean_ha: 24.83, max_ha: 567.4},
    2011: {n_patches: 9436, median_ha: 17.46, mean_ha: 36.75, max_ha: 627.9},
    2013: {n_patches: 9951, median_ha: 15.21, mean_ha: 31.19, max_ha: 473.3},
    2015: {n_patches: 9807, median_ha: 16.02, mean_ha: 32.20, max_ha: 643.7},
    2017: {n_patches: 9629, median_ha: 15.30, mean_ha: 33.56, max_ha: 638.1}
  },

  // GPP & NPP Intermediate Regional Means (kg C / m²)
  production_bands: {
    2001: {gpp_calendar: 1.121, gpp_season: 1.018, npp_annual: 0.680, npp_season: 0.618, frac: 0.907},
    2003: {gpp_calendar: 1.074, gpp_season: 0.972, npp_annual: 0.644, npp_season: 0.582, frac: 0.904},
    2005: {gpp_calendar: 1.101, gpp_season: 1.044, npp_annual: 0.645, npp_season: 0.612, frac: 0.948},
    2007: {gpp_calendar: 1.041, gpp_season: 0.991, npp_annual: 0.703, npp_season: 0.670, frac: 0.952},
    2009: {gpp_calendar: 1.060, gpp_season: 1.019, npp_annual: 0.761, npp_season: 0.731, frac: 0.960},
    2011: {gpp_calendar: 0.869, gpp_season: 0.811, npp_annual: 0.398, npp_season: 0.371, frac: 0.931},
    2013: {gpp_calendar: 0.820, gpp_season: 0.758, npp_annual: 0.444, npp_season: 0.408, frac: 0.920},
    2015: {gpp_calendar: 1.176, gpp_season: 1.098, npp_annual: 0.760, npp_season: 0.709, frac: 0.931},
    2017: {gpp_calendar: 1.264, gpp_season: 1.142, npp_annual: 0.728, npp_season: 0.657, frac: 0.902}
  },

  // Comprehensive CSP3 Site Profile & Ground Truth Records from PHD Folder
  csp3_site_records: {
    site_name: "US-Ne3 / CSP3 (UNL ENREEC, Mead, NE)",
    system: "Rainfed / Dryland No-Till Maize-Soybean Rotation",
    area_ac: 160.0,
    area_ha: 64.75,
    history: {
      2001: {plant: "2001-05-14", harvest: "2001-10-29", hybrid: "Pioneer 33B51 BT Gaucho", pop: "25,187 seed/ac", obs_mgha: 8.57, obs_sd: 0.95, n_pts: 7432, field_harvest: "139 bu/ac @ 16.9% MC", m1_pred: 7.42, m2_pred: 7.42},
      2003: {plant: "2003-05-13", harvest: "2003-10-16", hybrid: "Pioneer 33B51 BT Gaucho", pop: "26,019 seed/ac", obs_mgha: 7.44, obs_sd: 0.86, n_pts: 7453, field_harvest: "123 bu/ac @ 16.9% MC", m1_pred: 7.42, m2_pred: 7.42},
      2005: {plant: "2005-04-26", harvest: "2005-10-18", hybrid: "Pioneer 33G66 BT Poncho250", pop: "23,952 seed/ac", obs_mgha: 8.96, obs_sd: 0.64, n_pts: 7506, field_harvest: "145 bu/ac @ 15.7% MC", m1_pred: 7.87, m2_pred: 6.82},
      2007: {plant: "2007-05-02", harvest: "2007-11-01", hybrid: "Pioneer 33H26 HX Poncho250", pop: "25,127 seed/ac", obs_mgha: 9.93, obs_sd: 0.75, n_pts: 7463, field_harvest: "162.9 bu/ac @ 14.3% MC", m1_pred: 8.58, m2_pred: 8.00},
      2009: {plant: "2009-04-22", harvest: "2009-11-11", hybrid: "Pioneer 33T57", pop: "25,000 seed/ac", obs_mgha: 12.00, obs_sd: 0.00, n_pts: 0, field_harvest: "191.2 bu/ac @ 15.8% MC", m1_pred: 9.14, m2_pred: 9.14},
      2011: {plant: "2011-05-02", harvest: "2011-10-18", hybrid: "DeKalb 61-69VT3 / 61-72RR", pop: "23,000 seed/ac", obs_mgha: 9.48, obs_sd: 0.82, n_pts: 7492, field_harvest: "155.0 bu/ac @ 14.0% MC", m1_pred: 5.16, m2_pred: 5.09},
      2013: {plant: "2013-05-13", harvest: "2013-10-22", hybrid: "DeKalb 62-98RIB", pop: "25,519 seed/ac", obs_mgha: 10.51, obs_sd: 0.67, n_pts: 7517, field_harvest: "168.0 bu/ac @ 16.6% MC", m1_pred: 9.80, m2_pred: 10.54},
      2015: {plant: "2015-04-30", harvest: "2015-10-29", hybrid: "Pioneer P1498", pop: "26,000 seed/ac", obs_mgha: 11.49, obs_sd: 0.85, n_pts: 7517, field_harvest: "186.0 bu/ac @ 14.2% MC", m1_pred: 9.64, m2_pred: 10.84},
      2017: {plant: "2017-05-08", harvest: "2017-11-02", hybrid: "Pioneer 1498AM", pop: "28,500 seed/ac", obs_mgha: 11.92, obs_sd: 1.17, n_pts: 7513, field_harvest: "189.0 bu/ac @ 15.5% MC", m1_pred: 8.77, m2_pred: 9.34}
    }
  },

  // IndigoAg Validation Metrics (n = 42 field-years across 28 commercial fields)
  indigo: {
    pooled: {
      M1_fixed: {rmse: 2.461, mae: 2.075, bias: -1.720, r: 0.162, r2: 0.026},
      M2_HI_sensitivity: {rmse: 2.055, mae: 1.445, bias: -0.959, r: 0.199, r2: 0.039}
    },
    annual_2015: {
      M1_fixed: {rmse: 1.837, mae: 1.795, bias: -1.795, r: 0.466, r2: 0.217},
      M2_HI_sensitivity: {rmse: 0.750, mae: 0.632, bias: -0.632, r: 0.466, r2: 0.217}
    },
    annual_2017: {
      M1_fixed: {rmse: 2.719, mae: 2.215, bias: -1.683, r: 0.095, r2: 0.009},
      M2_HI_sensitivity: {rmse: 2.460, mae: 1.851, bias: -1.123, r: 0.095, r2: 0.009}
    }
  },

  // NCCPI Corn v3 comparison (CSP3_NCCPI_Corn_V3_Slope_Comparison.ipynb, run 20260927_nccpi_slope_corefilter)
  // NCCPI is a unitless soil productivity index (0–1), not measured yield: correlations show spatial agreement only.
  nccpi: {
    source: 'NCCPI Corn v3, USA Soils Map Units (Dec 2025 release)',
    common: {pixels: 339369, ha: 30543.2, nccpi_mean: 0.621},
    // Pearson r per season (all rainfed-corn pixels), 5 km block-bootstrap 95% CI, spatially adjusted q-value.
    // Identical for both harvest-index scenarios (a season-wide HI rescales yield without changing rank).
    annual: {
      2001: {r: 0.163, rho: 0.169, lo: 0.151, hi: 0.175, nccpi: 0.616, ha: 317072, q: 8.1e-16},
      2003: {r: 0.107, rho: 0.080, lo: 0.097, hi: 0.116, nccpi: 0.609, ha: 281917, q: 3.6e-9},
      2005: {r: 0.152, rho: 0.191, lo: 0.141, hi: 0.163, nccpi: 0.617, ha: 307035, q: 1.7e-14},
      2007: {r: 0.128, rho: 0.135, lo: 0.119, hi: 0.138, nccpi: 0.617, ha: 312067, q: 3.9e-9},
      2009: {r: 0.141, rho: 0.140, lo: 0.129, hi: 0.153, nccpi: 0.617, ha: 256966, q: 7.4e-8},
      2011: {r: 0.111, rho: 0.123, lo: 0.098, hi: 0.124, nccpi: 0.613, ha: 336281, q: 0.001},
      2013: {r: 0.134, rho: 0.144, lo: 0.118, hi: 0.148, nccpi: 0.611, ha: 301372, q: 1.4e-5},
      2015: {r: 0.201, rho: 0.249, lo: 0.188, hi: 0.214, nccpi: 0.611, ha: 306522, q: 8.1e-11},
      2017: {r: 0.212, rho: 0.253, lo: 0.197, hi: 0.226, nccpi: 0.605, ha: 313820, q: 4.4e-9}
    },
    // Strict common domain: pixels that were valid rainfed corn in all nine seasons.
    domain: {
      M1_fixed: {r2015: 0.147, rho2015: 0.269, ci2015: [0.130, 0.165], rMean: 0.128, rhoMean: 0.238, ciMean: [0.112, 0.143],
                 delta: -0.019, deltaCi: [-0.027, -0.012], yieldMean: 7.73, yield2015: 9.44},
      M2_HI_sensitivity: {r2015: 0.147, rho2015: 0.269, ci2015: [0.130, 0.165], rMean: 0.127, rhoMean: 0.240, ciMean: [0.111, 0.143],
                 delta: -0.020, deltaCi: [-0.027, -0.013], yieldMean: 7.81, yield2015: 10.62}
    },
    // Latitude bands (CH2V6 boundaries), strict common domain, nine-season mean yield.
    zones: [
      {zone: 'North', ha: 5475, nccpi: 0.641, r: 0.140, M1_fixed: 7.77, M2_HI_sensitivity: 7.85},
      {zone: 'Central', ha: 18458, nccpi: 0.608, r: 0.120, M1_fixed: 7.73, M2_HI_sensitivity: 7.81},
      {zone: 'South', ha: 6610, nccpi: 0.640, r: 0.146, M1_fixed: 7.70, M2_HI_sensitivity: 7.77}
    ],
    // Slope classes (% rise, Horn 3x3 on USGS 3DEP, 30 m), strict common domain.
    slope: [
      ['0–1', 2909, 0.685, 7.87, 7.94], ['1–2', 2732, 0.695, 7.86, 7.93], ['2–3', 3250, 0.657, 7.79, 7.87],
      ['3–4', 3923, 0.627, 7.72, 7.79], ['4–6', 9083, 0.594, 7.67, 7.75], ['6–8', 6148, 0.586, 7.70, 7.78],
      ['8–10', 1991, 0.593, 7.75, 7.82], ['10–12', 417, 0.575, 7.58, 7.66], ['12–15', 82, 0.551, 7.31, 7.39],
      ['>15', 10, 0.565, 7.08, 7.14]
    ],
    // Descriptive regressions on slope (per 1 % slope), 5 km block CI.
    slopeFit: {nccpi: {b: -0.0142, lo: -0.0161, hi: -0.0123, r2: 0.063},
               M1_fixed: {b: -0.023, lo: -0.032, hi: -0.015, r2: 0.002},
               M2_HI_sensitivity: {b: -0.023, lo: -0.032, hi: -0.015, r2: 0.002}}
  },

  // Field-level validation detail (CSP3_IndigoAg_Field_Yield_Validation.ipynb, indexed run 20260915)
  fieldCheck: {
    eligibility: [
      {year: 2013, candidates: 10, supported: 0, primary: 0},
      {year: 2015, candidates: 98, supported: 40, primary: 14},
      {year: 2017, candidates: 273, supported: 83, primary: 28}
    ],
    predictiveR2: {M1_fixed: -1.70, M2_HI_sensitivity: -0.88},
    zones: {
      North: {n: 9, M1_fixed: {rmse: 3.26, bias: -1.50}, M2_HI_sensitivity: {rmse: 3.06, bias: -0.87}},
      Central: {n: 29, M1_fixed: {rmse: 2.33, bias: -2.08}, M2_HI_sensitivity: {rmse: 1.75, bias: -1.25}},
      South: {n: 4, M1_fixed: {rmse: 0.57, bias: 0.41}, M2_HI_sensitivity: {rmse: 1.03, bias: 0.95}}
    },
    // Fields observed in both 2015 and 2017: mean observed vs mean modeled (Mg/ha).
    multiyear: [
      [12.09, 9.80, 10.73], [11.09, 9.41, 10.30], [11.09, 9.41, 10.30], [11.37, 8.85, 9.69],
      [11.06, 9.11, 9.97], [11.10, 9.04, 9.90], [11.09, 9.50, 10.40], [11.03, 9.27, 10.15],
      [11.06, 8.89, 9.73], [11.06, 9.54, 10.44], [11.25, 9.51, 10.42], [11.22, 9.03, 9.88],
      [11.09, 8.97, 9.83], [11.06, 9.34, 10.22]
    ]
  },

  // Operations Windows with +/- 14-day buffers
  operations: {
    2001: {plant: "2001-05-14", harvest: "2001-10-29", buf_start: "2001-04-30", buf_end: "2001-11-12"},
    2003: {plant: "2003-05-13", harvest: "2003-10-16", buf_start: "2003-04-29", buf_end: "2003-10-30"},
    2005: {plant: "2005-04-26", harvest: "2005-10-18", buf_start: "2005-04-12", buf_end: "2005-11-01"},
    2007: {plant: "2007-05-10", harvest: "2007-10-17", buf_start: "2007-04-26", buf_end: "2007-10-31"},
    2009: {plant: "2009-05-18", harvest: "2009-11-04", buf_start: "2009-05-04", buf_end: "2009-11-18"},
    2011: {plant: "2011-05-11", harvest: "2011-10-25", buf_start: "2011-04-27", buf_end: "2011-11-08"},
    2013: {plant: "2013-05-13", harvest: "2013-09-25", buf_start: "2013-04-29", buf_end: "2013-10-09"},
    2015: {plant: "2015-05-07", harvest: "2015-10-15", buf_start: "2015-04-23", buf_end: "2015-10-29"},
    2017: {plant: "2017-05-08", harvest: "2017-09-18", buf_start: "2017-04-24", buf_end: "2017-10-02"}
  }
};

// -----------------------------------------------------------------------------------------
// 2. SPATIAL BOUNDS & SITE DEFINITIONS: OFFICIAL MLRA 106 & CSP3 FIELD
// -----------------------------------------------------------------------------------------

// Official MLRA 106 Boundary Polygon (194 vertices from mlra106_nebraska.gpkg)
var MLRA106_COORDS = [
  [-96.21794, 40.968401], [-96.188814, 40.966979], [-96.159804, 40.969499], [-96.105759, 40.979148],
  [-96.081357, 40.979583], [-96.066366, 40.976952], [-96.054499, 40.972332], [-96.03343, 40.95449],
  [-95.938474, 40.807224], [-95.92668, 40.771082], [-95.914895, 40.705461], [-95.892387, 40.664278],
  [-95.861935, 40.589997], [-95.846513, 40.560271], [-95.800538, 40.490787], [-95.723988, 40.400436],
  [-95.697517, 40.354392], [-95.638077, 40.266664], [-95.592923, 40.208597], [-95.528941, 40.113938],
  [-95.48992, 40.069242], [-95.46938, 40.05266], [-95.431115, 40.028315], [-95.376722, 39.999943],
  [-95.393382, 39.999935], [-95.405803, 39.999936], [-95.463783, 39.999977], [-95.473371, 40.00005],
  [-95.482749, 40.000084], [-95.490115, 40.000113], [-95.501576, 40.000118], [-95.520455, 40.000146],
  [-95.539326, 40.000182], [-95.55819, 40.000207], [-95.577052, 40.000224], [-95.595886, 40.000245],
  [-95.614791, 40.000287], [-95.633625, 40.0003], [-95.652375, 40.00031], [-95.671383, 40.000319],
  [-95.690155, 40.000355], [-95.708975, 40.000398], [-95.727955, 40.000441], [-95.74683, 40.000459],
  [-95.765638, 40.000441], [-95.784506, 40.000443], [-95.798321, 40.000469], [-95.822172, 40.000519],
  [-95.841182, 40.000549], [-95.882962, 40.00061], [-95.935444, 40.000578], [-95.956926, 40.000595],
  [-95.973005, 40.000602], [-95.977089, 40.000588], [-95.991859, 40.000638], [-95.996031, 40.000657],
  [-96.010688, 40.000669], [-96.029502, 40.000718], [-96.049749, 40.000725], [-96.067364, 40.000799],
  [-96.086168, 40.000744], [-96.105118, 40.000743], [-96.123962, 40.000756], [-96.163137, 40.000756],
  [-96.174062, 40.00082], [-96.180577, 40.000813], [-96.19942, 40.000848], [-96.218244, 40.000846],
  [-96.237215, 40.000922], [-96.240604, 40.000878], [-96.244476, 40.000893], [-96.256207, 40.000893],
  [-96.263854, 40.00087], [-96.277052, 40.000877], [-96.293781, 40.000879], [-96.314812, 40.000896],
  [-96.332357, 40.000927], [-96.350752, 40.000959], [-96.369323, 40.000987], [-96.38818, 40.000998],
  [-96.407072, 40.000996], [-96.425964, 40.000998], [-96.445128, 40.001005], [-96.463733, 40.001009],
  [-96.482603, 40.000991], [-96.50145, 40.00103], [-96.520358, 40.001044], [-96.539139, 40.001111],
  [-96.557466, 40.001123], [-96.576805, 40.001145], [-96.595638, 40.00114], [-96.61969, 40.00126],
  [-96.63364, 40.001263], [-96.63865, 40.001299], [-96.654885, 40.001315], [-96.671136, 40.001342],
  [-96.689997, 40.001329], [-96.709391, 40.001502], [-96.712333, 40.001539], [-96.717819, 40.00152],
  [-96.727705, 40.00145], [-96.746581, 40.00142], [-96.765636, 40.001418], [-96.779994, 40.001428],
  [-96.784298, 40.001456], [-96.787324, 40.001458], [-96.803228, 40.001462], [-96.80581, 40.001484],
  [-96.822028, 40.001511], [-96.843532, 40.001551], [-96.862267, 40.001494], [-96.877863, 40.001508],
  [-96.881002, 40.001517], [-96.89758, 40.001474], [-96.916425, 40.001511], [-96.936347, 40.001499],
  [-96.954228, 40.001511], [-96.972743, 40.001525], [-96.974923, 40.00154], [-96.991488, 40.001532],
  [-96.990133, 40.017284], [-96.993566, 40.042387], [-97.011662, 40.052585], [-97.078807, 40.076693],
  [-97.175712, 40.176713], [-97.222927, 40.238826], [-97.301092, 40.35706], [-97.315499, 40.390507],
  [-97.322485, 40.426535], [-97.320074, 40.465316], [-97.315977, 40.478408], [-97.306609, 40.494736],
  [-97.29546, 40.506383], [-97.28075, 40.515713], [-97.26546, 40.52068], [-97.246954, 40.522239],
  [-97.215585, 40.516471], [-97.188899, 40.507157], [-97.174618, 40.499502], [-97.154734, 40.481026],
  [-97.127761, 40.439306], [-97.110466, 40.420118], [-97.085939, 40.402397], [-97.060697, 40.391689],
  [-97.040507, 40.38707], [-97.012715, 40.3848], [-96.977654, 40.385347], [-96.950886, 40.388586],
  [-96.932314, 40.396236], [-96.924678, 40.406923], [-96.921612, 40.421284], [-96.929478, 40.510883],
  [-96.945214, 40.630122], [-96.968531, 40.705815], [-96.988017, 40.786244], [-96.995674, 40.831594],
  [-97.003909, 40.952136], [-97.013544, 41.027141], [-97.011145, 41.131266], [-97.018313, 41.179345],
  [-97.025598, 41.196915], [-97.037179, 41.215489], [-97.07185, 41.251578], [-97.092068, 41.267017],
  [-97.116028, 41.281466], [-97.143672, 41.29424], [-97.162287, 41.299521], [-97.151313, 41.314419],
  [-97.127504, 41.32449], [-97.115951, 41.326392], [-97.090816, 41.335701], [-96.999715, 41.377918],
  [-96.956798, 41.395178], [-96.896579, 41.412749], [-96.847357, 41.42273], [-96.784265, 41.42837],
  [-96.610403, 41.423122], [-96.580799, 41.420606], [-96.543754, 41.411165], [-96.494492, 41.387433],
  [-96.453012, 41.357173], [-96.423998, 41.326376], [-96.396023, 41.285319], [-96.352864, 41.208262],
  [-96.337266, 41.169404], [-96.330079, 41.129522], [-96.329967, 41.059752], [-96.327427, 41.047884],
  [-96.332253, 41.023763], [-96.334191, 41.017876], [-96.332528, 41.012937], [-96.306285, 40.997193],
  [-96.250289, 40.975657], [-96.21794, 40.968401]
];
var mlra106 = ee.Geometry.Polygon(MLRA106_COORDS);

// Full 30-m analysis grid extent (EPSG:5070 bounds: -111285 to 52785, 1886985 to 2047275)
var aoiGrid = ee.Geometry.Rectangle([-97.3225, 39.9932, -95.3636, 41.4297]);

// US-Ne3 / CSP3 AmeriFlux Research Tower (Mead, NE)
var csp3Tower = ee.Geometry.Point([-96.4397, 41.1797]);

// Exact CSP3 Field Footprint (Field 1793, ~65 ha / 160 acres quarter section from post-calibrated harvest shapefiles)
var CSP3_FIELD_COORDS = [
  [-96.435005, 41.175847], [-96.444136, 41.175895], [-96.444649, 41.176279],
  [-96.444691, 41.176447], [-96.444766, 41.176910], [-96.444792, 41.178964],
  [-96.444812, 41.180954], [-96.444803, 41.181401], [-96.444747, 41.182544],
  [-96.444591, 41.183032], [-96.434867, 41.183031], [-96.434798, 41.182765],
  [-96.434752, 41.181482], [-96.434766, 41.178978], [-96.434825, 41.176410],
  [-96.434889, 41.175902], [-96.435005, 41.175847]
];
var csp3Field = ee.Geometry.Polygon(CSP3_FIELD_COORDS);

// -----------------------------------------------------------------------------------------
// 3. EARTH ENGINE PRODUCTION-EFFICIENCY MODEL COMPUTATION
// -----------------------------------------------------------------------------------------

var GPP_COLLECTION = 'UMT/NTSG/v2/LANDSAT/GPP';
var NPP_COLLECTION = 'UMT/NTSG/v2/LANDSAT/NPP';
var GPP_SCALE = 0.0001;
var NPP_SCALE = 0.0001;
var CARBON_TO_DRY_BIOMASS = 2.5;
var ROOT_SHOOT_RATIO = 0.18;
var FIXED_MC_GRAIN = 0.155;

/**
 * Filter and scale Landsat GPP images using clear QC flags (10, 11)
 */
function cleanGpp(img) {
  var qc = img.select('QC');
  var clear = qc.eq(10).or(qc.eq(11));
  return img.select('GPP')
    .multiply(GPP_SCALE)
    .updateMask(clear)
    .copyProperties(img, ['system:time_start']);
}

/**
 * Live computation of CH2V6 PEMOC yield & intermediate rasters over full MLRA 106
 */
function computeLiveModel(year, scenario, applyCornMask) {
  var yearInt = parseInt(year, 10);
  var ops = COLAB_STATS.operations[yearInt];
  var hiVal = COLAB_STATS.yield[yearInt][scenario].hi;

  // Calendar year date window
  var yearStart = ee.Date.fromYMD(yearInt, 1, 1);
  var yearEnd = ee.Date.fromYMD(yearInt + 1, 1, 1);

  // 1. Full Calendar Year GPP (clipped to complete MLRA 106 boundary)
  var gppCalendarCol = ee.ImageCollection(GPP_COLLECTION)
    .filterDate(yearStart, yearEnd)
    .map(cleanGpp);
  var gppCalendar = gppCalendarCol.sum().clip(mlra106).rename('gpp_calendar');

  // 2. Buffered Growing Season GPP
  var gppSeasonCol = ee.ImageCollection(GPP_COLLECTION)
    .filterDate(ops.buf_start, ops.buf_end)
    .map(cleanGpp);
  var gppSeason = gppSeasonCol.sum().clip(mlra106).rename('gpp_season');

  // 3. Seasonal Allocation Fraction
  var gppFraction = gppSeason.divide(gppCalendar.max(0.000001))
    .clamp(0.0, 1.0)
    .clip(mlra106)
    .rename('gpp_fraction');

  // 4. Annual NPP (QC <= 20% gap-filled, exclude 255)
  var nppCol = ee.ImageCollection(NPP_COLLECTION).filterDate(yearStart, yearEnd);
  var nppImg = ee.Image(nppCol.first());
  var nppQc = nppImg.select('QC');
  var validNpp = nppQc.neq(255).and(nppQc.lte(20));
  var nppAnnual = nppImg.select('annualNPP')
    .multiply(NPP_SCALE)
    .updateMask(validNpp)
    .clip(mlra106)
    .rename('npp_annual');

  // 5. Allocated Seasonal NPP
  var nppSeason = nppAnnual.multiply(gppFraction).clip(mlra106).rename('npp_season');

  // 6. Rainfed Corn Mask: cleaned non-irrigated corn fields (non_irrigated_corn/clean, 2001–2017).
  // The same mask the Colab statistics use: LANID rainfed ∩ corn, minus fields < 2 ha, fields with
  // no core pixel, and thin ribbons (axis ratio > 6 and core fraction < 0.40). One band per season;
  // uploaded GeoTIFF bands arrive as b1..b11, so select by position (2001 = 0 … 2017 = 8).
  var cleanIdx = CLEAN_MASK_YEARS.indexOf(yearInt);
  var cdl;
  if (cleanIdx >= 0) {
    cdl = CLEAN_MASK_IMG.select([cleanIdx]).unmask(0).eq(1).clip(mlra106);
  } else {
    // Fallback outside the cleaned archive: USDA NASS CDL corn (class 1).
    var cdlYear = yearInt >= 2008 ? yearInt : 2008;
    cdl = ee.ImageCollection('USDA/NASS/CDL')
      .filterDate(cdlYear + '-01-01', cdlYear + '-12-31')
      .first()
      .select('cropland')
      .eq(1)
      .clip(mlra106);
  }

  // 7. Biomass, Aboveground Biomass (AGB), and Grain Yield
  var scalar = (CARBON_TO_DRY_BIOMASS / (1.0 + ROOT_SHOOT_RATIO)) * (hiVal / (1.0 - FIXED_MC_GRAIN)) * 10.0;
  var yieldImg = nppSeason.multiply(scalar).clip(mlra106).rename('yield_Mg_ha');

  // Apply optional rainfed-corn field mask
  if (applyCornMask) {
    yieldImg = yieldImg.updateMask(cdl);
    nppSeason = nppSeason.updateMask(cdl);
  }

  return {
    yield: yieldImg,
    nppSeason: nppSeason,
    nppAnnual: nppAnnual,
    gppSeason: gppSeason,
    gppCalendar: gppCalendar,
    fraction: gppFraction,
    cdlCorn: cdl
  };
}

// -----------------------------------------------------------------------------------------
// 4. COLOR PALETTES & VISUALIZATION PARAMETERS
// -----------------------------------------------------------------------------------------

var YIELD_VIS = {
  // Fixed across all mapped years so a color means the same yield in every season.
  min: 0.0,
  max: 20.0,
  palette: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725']
};

var NPP_VIS = {
  min: 0.2,
  max: 0.8,
  palette: ['#f7fcb9', '#addd8e', '#31a354', '#006837']
};

var GPP_VIS = {
  min: 0.4,
  max: 1.4,
  palette: ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837']
};

var FRAC_VIS = {
  min: 0.85,
  max: 1.0,
  palette: ['#fee8c8', '#fdbb84', '#e34a33']
};

// NCCPI Corn v3 (USDA-NRCS soil productivity index, 0–1), 30 m, EPSG:5070.
// Uploaded from CSP3_GPP_outputs/NCCPI_comparison/20260913_nccpi_slope_v1/rasters/nccpi_corn_v3.tif
var NCCPI_IMG = ee.Image('projects/ee-njberkowitz95/assets/nccpi_corn_v3').select(0).rename('nccpi');
NCCPI_IMG = NCCPI_IMG.updateMask(NCCPI_IMG.gte(0).and(NCCPI_IMG.lte(1)));
var NCCPI_VIS = {
  min: 0.3,
  max: 0.9,
  palette: ['#f6eedf', '#e6cba2', '#cf9f63', '#a86f33', '#744717', '#3f250c']
};

// -----------------------------------------------------------------------------------------
// 5. APPLICATION USER INTERFACE (UI) SETUP
// -----------------------------------------------------------------------------------------

ui.root.clear();

// App palette: field greens, loess soil neutrals and husk gold, keyed to the viridis yield ramp.
var THEME = {
  ink: '#1e2a22', body: '#46524a', muted: '#6a7468', line: '#e2e0d4',
  pale: '#f7f5ee', white: '#ffffff', primary: '#1f7f79', m1: '#b7791f',
  header: '#1e3a2f', headerText: '#f4f1e6', headerSub: '#c9d8c5',
  boundary: '#1e3a2f', tower: '#c0392b', field: '#d4a017', grid: '#8a8f7a',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
};
function scenarioColor(key) { return key === 'M1_fixed' ? THEME.m1 : THEME.primary; }
function kicker(text, color) {
  return ui.Label(text.toUpperCase(), {fontSize: '11px', fontWeight: 'bold', fontFamily: THEME.mono,
    color: color || THEME.primary, margin: '0 0 6px 0', backgroundColor: 'rgba(0,0,0,0)'});
}
function fieldLabel(text) {
  return ui.Label(text, {fontSize: '12px', fontWeight: 'bold', color: THEME.body, margin: '6px 0 2px 8px', backgroundColor: 'rgba(0,0,0,0)'});
}
var CARD_STYLE = {backgroundColor: THEME.white, border: '1px solid ' + THEME.line, padding: '14px 16px', margin: '0 0 14px 0'};
// Chart legend drawn as labels: the built-in chart legend loses its text in a narrow side panel.
function chartKey(items) {
  return ui.Panel(items.map(function(it) {
    return ui.Label(it[1] + ' ' + it[2], {fontSize: '11px', color: it[0], fontWeight: 'bold', margin: '0 12px 0 0', backgroundColor: 'rgba(0,0,0,0)'});
  }), ui.Panel.Layout.flow('horizontal', true), {margin: '0 0 8px 8px', backgroundColor: 'rgba(0,0,0,0)'});
}

// Muted 'Fields' basemap so the yield ramp carries the colour; satellite stays one click away.
var LIGHT_BASEMAP = [
  {elementType: 'geometry', stylers: [{color: '#efede4'}]},
  {elementType: 'labels.icon', stylers: [{visibility: 'off'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#5f6a5c'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#ffffff'}]},
  {featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{color: '#c8c4b2'}]},
  {featureType: 'landscape', elementType: 'geometry', stylers: [{color: '#efede4'}]},
  {featureType: 'poi', stylers: [{visibility: 'off'}]},
  {featureType: 'road', elementType: 'geometry', stylers: [{color: '#fbfaf5'}]},
  {featureType: 'road.highway', elementType: 'geometry', stylers: [{color: '#e4dfcc'}]},
  {featureType: 'transit', stylers: [{visibility: 'off'}]},
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#c9dbe0'}]}
];

var map = ui.Map();
map.setOptions('Fields', {Fields: LIGHT_BASEMAP}, ['Fields', 'HYBRID']);
map.centerObject(mlra106, 8);
map.style().set('cursor', 'crosshair');

// Plain-language labels shown in the interface. Internal keys stay unchanged.
var SCENARIO_LABELS = {
  M2_HI_sensitivity: 'HI sensitivity (M2)',
  M1_fixed: 'Fixed harvest index, 0.50 (M1)'
};
var HI_SOURCE_LABELS = {
  'Fixed Fill (0.50)': 'fixed at 0.50',
  'Field Yield / Biomass R6': 'field yield ÷ biomass at maturity, R6',
  'Kernel Partition R6': 'kernel partitioning at maturity, R6',
  'Provisional Mixed R5': 'provisional, mixed sources, R5',
  'Provisional Partition R5': 'provisional partitioning, R5'
};
var LAYER_LABELS = {
  yield: 'Modeled yield',
  npp_season: 'Allocated seasonal NPP',
  gpp_season: 'Growing-season GPP',
  gpp_calendar: 'Calendar-year GPP',
  fraction: 'Share of GPP in the growing season',
  cdl: 'Rainfed corn fields (cleaned mask)',
  nccpi: 'Soil productivity, NCCPI Corn v3'
};
function scenarioLabel(key) { return SCENARIO_LABELS[key] || key; }
function hiSourceLabel(key) { return HI_SOURCE_LABELS[key] || key; }
function fmtInt(x) { return Math.round(x).toLocaleString('en-US'); }

var panel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    width: '420px',
    padding: '18px 18px 8px 18px',
    backgroundColor: THEME.pale
  }
});

ui.root.add(panel);
ui.root.add(map);

// -----------------------------------------------------------------------------------------
// 6. UI COMPONENTS: MASTHEAD & DESCRIPTION
// -----------------------------------------------------------------------------------------

var eyebrow = ui.Label({
  value: 'DISSERTATION CHAPTER 2 · MLRA 106, EASTERN NEBRASKA',
  style: {fontSize: '11px', fontWeight: 'bold', fontFamily: THEME.mono, color: THEME.primary, margin: '0 0 6px 0', backgroundColor: 'rgba(0,0,0,0)'}
});

var appTitle = ui.Label({
  value: 'Sub-field rainfed maize yield, 2001–2021',
  style: {fontSize: '24px', fontWeight: 'bold', color: THEME.ink, margin: '0 0 8px 0', backgroundColor: 'rgba(0,0,0,0)'}
});

var appDesc = ui.Label({
  value: 'Rainfed maize yield at 30 m. Historical 2001–2017, published-input 2019, and experimental 2021 proxy are identified separately below.',
  style: {fontSize: '13px', color: THEME.body, margin: '0 0 14px 0', backgroundColor: 'rgba(0,0,0,0)'}
});

eyebrow.style().set({color: THEME.headerSub, margin: '0 0 6px 0'});
appTitle.style().set({color: THEME.headerText, margin: '0 0 8px 0'});
appDesc.style().set({color: THEME.headerSub, margin: '0 0 12px 0'});
var viridisStrip = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: {bbox: [0, 0, 1, 0.1], dimensions: '380x8', format: 'png', min: 0, max: 1, palette: YIELD_VIS.palette},
  style: {stretch: 'horizontal', margin: '0', padding: '0', backgroundColor: THEME.header}
});
var header = ui.Panel([eyebrow, appTitle, appDesc, viridisStrip], ui.Panel.Layout.flow('vertical'),
  {backgroundColor: THEME.header, padding: '16px 16px 14px 16px', margin: '0 0 14px 0'});
panel.add(header);

// Quick Navigation Button Bar
var navBar = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {margin: '0 0 10px 0'}
});

var btnZoomCsp3 = ui.Button({
  label: 'Zoom to CSP3 site',
  onClick: function() {
    map.centerObject(csp3Field, 15);
  },
  style: {margin: '0 6px 0 0', fontSize: '11px'}
});

var btnZoomMlra = ui.Button({
  label: 'Zoom to MLRA 106',
  onClick: function() {
    map.centerObject(mlra106, 8);
  },
  style: {margin: '0 6px 0 0', fontSize: '11px'}
});

var btnQueryCsp3 = ui.Button({
  label: 'Query CSP3 tower',
  onClick: function() {
    querySelectedLocation({lon: -96.4397, lat: 41.1797});
  },
  style: {margin: '0', fontSize: '11px'}
});

navBar.add(btnZoomCsp3);
navBar.add(btnZoomMlra);
navBar.add(btnQueryCsp3);
panel.add(navBar);

panel.add(ui.Panel({style: {height: '1px', backgroundColor: THEME.line, margin: '6px 0 14px 0'}}));

// -----------------------------------------------------------------------------------------
// 7. DASHBOARD VIEW SELECTOR (TABBED NAVIGATION)
// -----------------------------------------------------------------------------------------

var viewSelect = ui.Select({
  items: [
    {label: 'Map and yield model', value: 'map_view'},
    {label: 'CSP3 research site', value: 'csp3_view'},
    {label: 'Results across seasons', value: 'charts_view'},
    {label: 'Yield vs soil productivity (NCCPI)', value: 'nccpi_view'}
  ],
  value: 'map_view',
  onChange: function(v) { switchView(v); },
  style: {width: '100%', margin: '0 0 12px 0', fontWeight: 'bold'}
});
panel.add(fieldLabel('View'));
panel.add(viewSelect);

// Containers for views
var mapViewContainer = ui.Panel({style: {margin: '0'}});
var csp3ViewContainer = ui.Panel({style: {margin: '0', shown: false}});
var chartsViewContainer = ui.Panel({style: {margin: '0', shown: false}});
var nccpiViewContainer = ui.Panel({style: {margin: '0', shown: false}});

panel.add(mapViewContainer);
panel.add(csp3ViewContainer);
panel.add(chartsViewContainer);
panel.add(nccpiViewContainer);

function switchView(viewKey) {
  mapViewContainer.style().set('shown', viewKey === 'map_view');
  csp3ViewContainer.style().set('shown', viewKey === 'csp3_view');
  chartsViewContainer.style().set('shown', viewKey === 'charts_view');
  nccpiViewContainer.style().set('shown', viewKey === 'nccpi_view');
}

// -----------------------------------------------------------------------------------------
// 8. VIEW 1: SPATIAL CONTROLS & DYNAMIC OUTPUTS
// -----------------------------------------------------------------------------------------

// Season outputs come first, so the answer appears before the settings.
var statsCard = ui.Panel({style: CARD_STYLE});
mapViewContainer.add(statsCard);

var controlsHeading = kicker('Model settings', THEME.muted);
mapViewContainer.add(controlsHeading);

var yearSelect = ui.Select({
  items: ['2001', '2003', '2005', '2007', '2009', '2011', '2013', '2015', '2017',
    {label: '2019 · published inputs', value: '2019'},
    {label: '2021 · EXPERIMENTAL proxy', value: '2021'}],
  value: '2017',
  onChange: function() { updateApp(); },
  style: {width: '100%', margin: '0 0 8px 0'}
});

var scenarioSelect = ui.Select({
  items: [
    {label: SCENARIO_LABELS.M2_HI_sensitivity, value: 'M2_HI_sensitivity'},
    {label: SCENARIO_LABELS.M1_fixed, value: 'M1_fixed'}
  ],
  value: 'M2_HI_sensitivity',
  onChange: function() { updateApp(); },
  style: {width: '100%', margin: '0 0 8px 0'}
});

var layerSelect = ui.Select({
  items: [
    {label: 'Modeled yield (Mg ha⁻¹)', value: 'yield'},
    {label: 'Allocated seasonal NPP (kg C m⁻²)', value: 'npp_season'},
    {label: 'Growing-season GPP, buffered (kg C m⁻²)', value: 'gpp_season'},
    {label: 'Calendar-year GPP (kg C m⁻²)', value: 'gpp_calendar'},
    {label: 'Share of GPP in the growing season', value: 'fraction'},
    {label: 'Soil productivity, NCCPI Corn v3 (0–1)', value: 'nccpi'},
    {label: 'Rainfed corn fields (cleaned mask)', value: 'cdl'}
  ],
  value: 'yield',
  onChange: function() { updateApp(); },
  style: {width: '100%', margin: '0 0 8px 0'}
});

var maskCheckbox = ui.Checkbox({
  label: 'Show corn fields only (uncheck for the full landscape)',
  value: true,
  onChange: function() { updateApp(); },
  style: {fontSize: '12px', color: THEME.ink, margin: '4px 0 8px 8px', backgroundColor: 'rgba(0,0,0,0)'}
});

// Layer Opacity Slider
var opacitySlider = ui.Slider({
  min: 0,
  max: 100,
  value: 95,
  step: 5,
  onChange: function(val) {
    if (map.layers().length() > 2) {
      map.layers().get(2).setOpacity(val / 100);
    }
  },
  style: {width: '100%', margin: '0 0 10px 0'}
});

mapViewContainer.add(fieldLabel('Season'));
mapViewContainer.add(yearSelect);
mapViewContainer.add(fieldLabel('Harvest index'));
mapViewContainer.add(scenarioSelect);
var sourceBadge = ui.Label('Historical 2001–2017 production-efficiency model.', {
  fontSize: '11px', color: THEME.muted, whiteSpace: 'pre-wrap',
  padding: '8px 10px', margin: '2px 0 8px 0',
  backgroundColor: THEME.white, border: '1px solid ' + THEME.line
});
mapViewContainer.add(sourceBadge);
mapViewContainer.add(ui.Label({
  value: 'Methods, caveats, and checksums ↗',
  targetUrl: 'https://github.com/njberkowitz95/Yields-and-Fields-CH1/blob/main/csp3_maize_gpp/outputs/extension_2019_2021_delivery.md',
  style: {fontSize: '11px', color: THEME.primary, margin: '0 0 8px 8px'}
}));
mapViewContainer.add(fieldLabel('Map layer'));
mapViewContainer.add(layerSelect);
mapViewContainer.add(maskCheckbox);
mapViewContainer.add(fieldLabel('Layer opacity (%)'));
mapViewContainer.add(opacitySlider);


// Point Inspector Panel
var inspectorPanel = ui.Panel({style: CARD_STYLE});
inspectorPanel.add(kicker('Point inspector'));
var inspectorLabel = ui.Label('Click the map inside MLRA 106, or use "Query CSP3 tower" above, to read any 30 m pixel.', {
  fontSize: '12px', color: THEME.body, margin: '0', whiteSpace: 'pre-wrap', backgroundColor: 'rgba(0,0,0,0)'
});
inspectorPanel.add(inspectorLabel);
mapViewContainer.add(inspectorPanel);

// -----------------------------------------------------------------------------------------
// 9. VIEW 2: CSP3 RESEARCH SITE PROFILE & GROUND TRUTH
// -----------------------------------------------------------------------------------------

var csp3ProfileHeading = kicker('CSP3 research site, Mead (AmeriFlux US-Ne3)');
csp3ViewContainer.add(csp3ProfileHeading);

var csp3MetaPanel = ui.Panel({
  style: CARD_STYLE
});
csp3MetaPanel.add(ui.Label('• Site: UNL Carbon Sequestration Program Site 3 (AmeriFlux US-Ne3)', {fontSize: '11.5px', fontWeight: 'bold', color: THEME.ink}));
csp3MetaPanel.add(ui.Label('• Location: ENREEC, Mead, NE (41.1797° N, 96.4397° W)', {fontSize: '11px', color: THEME.body}));
csp3MetaPanel.add(ui.Label('• Management: no-till rainfed maize–soybean rotation', {fontSize: '11px', color: THEME.body}));
csp3MetaPanel.add(ui.Label('• Field area: about 65 ha (160 acres, a quarter section)', {fontSize: '11px', color: THEME.body}));
csp3MetaPanel.add(ui.Label('• Observed yield: about 7,500 corrected combine yield-monitor points per year', {fontSize: '11px', color: THEME.ink, fontWeight: 'bold'}));
csp3ViewContainer.add(csp3MetaPanel);

var csp3HistoryCard = ui.Panel({
  style: CARD_STYLE
});
csp3ViewContainer.add(csp3HistoryCard);

function updateCsp3HistoryCard(year) {
  csp3HistoryCard.clear();
  var rec = COLAB_STATS.csp3_site_records.history[year];
  csp3HistoryCard.add(ui.Label('CSP3 record, ' + year + ' season', {
    fontSize: '13px', fontWeight: 'bold', color: THEME.ink, margin: '0 0 6px 0'
  }));
  csp3HistoryCard.add(ui.Label('• Planted ' + rec.plant + ' · harvested ' + rec.harvest, {fontSize: '11px', color: THEME.body}));
  csp3HistoryCard.add(ui.Label('• Hybrid: ' + rec.hybrid, {fontSize: '11px', color: THEME.ink, fontWeight: 'bold'}));
  csp3HistoryCard.add(ui.Label('• Seeding rate: ' + rec.pop, {fontSize: '11px', color: THEME.body}));
  csp3HistoryCard.add(ui.Label('• Reported field harvest: ' + rec.field_harvest, {fontSize: '11px', color: THEME.body}));
  csp3HistoryCard.add(ui.Label('• Observed yield (combine monitor): ' + rec.obs_mgha.toFixed(2) + (rec.obs_sd > 0 ? ' ± ' + rec.obs_sd.toFixed(2) : '') + ' Mg ha⁻¹ (' + fmtInt(rec.n_pts) + ' points)', {fontSize: '11.5px', color: THEME.ink, fontWeight: 'bold'}));
  csp3HistoryCard.add(ui.Label('• Modeled, ' + SCENARIO_LABELS.M1_fixed + ': ' + rec.m1_pred.toFixed(2) + ' Mg ha⁻¹ (bias ' + (rec.m1_pred - rec.obs_mgha).toFixed(2) + ')', {fontSize: '11px', color: THEME.m1}));
  csp3HistoryCard.add(ui.Label('• Modeled, ' + SCENARIO_LABELS.M2_HI_sensitivity + ': ' + rec.m2_pred.toFixed(2) + ' Mg ha⁻¹ (bias ' + (rec.m2_pred - rec.obs_mgha).toFixed(2) + ')', {fontSize: '11px', color: THEME.primary, fontWeight: 'bold'}));
}

// -----------------------------------------------------------------------------------------
// 10. VIEW 3: DISSERTATION CHARTS & VALIDATION ANALYTICS
// -----------------------------------------------------------------------------------------

var chartsHeading = kicker('Results across seasons, 2001–2017');
chartsViewContainer.add(chartsHeading);

var chartsSubContainer = ui.Panel({style: {margin: '0 0 10px 0'}});
chartsViewContainer.add(chartsSubContainer);

// Validation Card
var auditCard = ui.Panel({
  style: CARD_STYLE
});
chartsViewContainer.add(auditCard);

function buildColabCharts() {
  chartsSubContainer.clear();

  // 1. Yield Comparison: M1 vs M2 vs CSP3 Ground Truth
  var yieldDataTable = [
    [{label: 'Season', type: 'string'}, {label: 'Fixed HI 0.50 (M1)', type: 'number'}, {label: 'Annual HI (M2)', type: 'number'}, {label: 'CSP3 observed', type: 'number'}],
    ['2001', 7.743, 7.743, 8.570],
    ['2003', 7.301, 7.301, 7.435],
    ['2005', 7.671, 6.645, 8.962],
    ['2007', 8.395, 7.827, 9.927],
    ['2009', 9.164, 9.164, 12.000],
    ['2011', 4.650, 4.586, 9.478],
    ['2013', 5.119, 5.703, 10.515],
    ['2015', 8.884, 9.990, 11.494],
    ['2017', 8.232, 8.763, 11.919]
  ];

  var yieldChart = ui.Chart(yieldDataTable)
    .setChartType('LineChart')
    .setOptions({
      title: 'Modeled yield vs CSP3 observed, 2001–2017',
      hAxis: {title: 'Season'},
      vAxis: {title: 'Yield (Mg ha⁻¹)', viewWindow: {min: 4.0, max: 13.0}},
      colors: [THEME.m1, THEME.primary, THEME.ink],
      pointSize: 5,
      lineWidth: 2.2,
      legend: {position: 'none'},
      chartArea: {left: 45, top: 35, width: '85%', height: '65%'}
    });
  chartsSubContainer.add(yieldChart);
  chartsSubContainer.add(chartKey([[THEME.m1, '●', 'Fixed HI (M1)'], [THEME.primary, '●', 'Annual HI (M2)'], [THEME.ink, '●', 'CSP3 observed']]));

  // 2. GPP & NPP Dynamics
  var fluxDataTable = [
    [{label: 'Season', type: 'string'}, {label: 'Calendar-year GPP', type: 'number'}, {label: 'Growing-season GPP', type: 'number'}, {label: 'Allocated NPP', type: 'number'}],
    ['2001', 1.121, 1.018, 0.618],
    ['2003', 1.074, 0.972, 0.582],
    ['2005', 1.101, 1.044, 0.612],
    ['2007', 1.041, 0.991, 0.670],
    ['2009', 1.060, 1.019, 0.731],
    ['2011', 0.869, 0.811, 0.371],
    ['2013', 0.820, 0.758, 0.408],
    ['2015', 1.176, 1.098, 0.709],
    ['2017', 1.264, 1.142, 0.657]
  ];

  var prodChart = ui.Chart(fluxDataTable)
    .setChartType('ColumnChart')
    .setOptions({
      title: 'Regional carbon fluxes (kg C m⁻²)',
      hAxis: {title: 'Season'},
      vAxis: {title: 'Flux (kg C m⁻²)'},
      colors: ['#31688e', '#35b779', '#b5de2b'],
      legend: {position: 'none'},
      chartArea: {left: 45, top: 35, width: '85%', height: '65%'}
    });
  chartsSubContainer.add(prodChart);
  chartsSubContainer.add(chartKey([['#31688e', '■', 'Calendar-year GPP'], ['#35b779', '■', 'Growing-season GPP'], ['#b5de2b', '■', 'Allocated NPP']]));

  // Update Validation Summary Card
  auditCard.clear();
  auditCard.add(kicker('How the model compares with observations'));
  auditCard.add(ui.Label(
    '• Commercial field records (42 field-seasons, 28 fields):\n' +
    '   - Fixed HI (M1): RMSE 2.46 Mg ha⁻¹, bias −1.72, r = 0.16\n' +
    '   - Annual HI (M2): RMSE 2.05 Mg ha⁻¹, bias −0.96, r = 0.20\n' +
    '   - 2015 fields only: M2 RMSE 0.75 Mg ha⁻¹, bias −0.63\n\n' +
    '• CSP3 flux site (US-Ne3), observed vs modeled:\n' +
    '   - 2003: observed 7.44, modeled 7.42 (bias −0.02 Mg ha⁻¹)\n' +
    '   - 2015: observed 11.49, modeled M2 10.84 (bias −0.65 Mg ha⁻¹)\n' +
    '   - 2011: drought season, under review (observed 9.48, modeled 4.59 Mg ha⁻¹)\n\n' +
    '• Pixels that were rainfed maize in all nine seasons:\n' +
    '   - 339,532 pixels (about 30,600 ha)\n' +
    '   - Total production: M1 20.27 million Mg · M2 20.44 million Mg',
    {fontSize: '11px', color: THEME.body, whiteSpace: 'pre'}
  ));
}

// -----------------------------------------------------------------------------------------
// 10b. VIEW 4: SOIL PRODUCTIVITY (NCCPI) COMPARISON
// -----------------------------------------------------------------------------------------

var NC = COLAB_STATS.nccpi;
var SOIL = '#8c5a2b';  // soil-brown accent for NCCPI, distinct from both yield scenarios

nccpiViewContainer.add(kicker('Yield vs soil productivity (NCCPI)', SOIL));
nccpiViewContainer.add(ui.Label(
  'Is modeled yield higher where soils are rated more productive? NCCPI Corn v3 (USDA-NRCS) scores each soil 0–1 ' +
  'for rainfed corn. It is an index, not a yield, so this is a check of spatial agreement, not accuracy.',
  {fontSize: '12px', color: THEME.body, margin: '0 0 10px 0'}));

var nccpiHeroCard = ui.Panel({style: CARD_STYLE});
var nccpiSeasonCard = ui.Panel({style: CARD_STYLE});
var CHART_CARD_STYLE = {backgroundColor: THEME.white, border: '1px solid ' + THEME.line, padding: '10px 0', margin: '0 0 14px 0'};
var nccpiChartPanel = ui.Panel({style: CHART_CARD_STYLE});
var nccpiSlopePanel = ui.Panel({style: CHART_CARD_STYLE});
var nccpiZoneCard = ui.Panel({style: CARD_STYLE});
var nccpiNoteCard = ui.Panel({style: {backgroundColor: THEME.pale, border: '1px solid ' + THEME.line, padding: '12px 14px', margin: '0 0 14px 0'}});
nccpiViewContainer.add(ui.Button({
  label: 'Show NCCPI on the map',
  style: {stretch: 'horizontal', margin: '0 0 12px 0'},
  onClick: function() {
    layerSelect.setValue('nccpi');  // triggers updateApp()
    viewSelect.setValue('map_view');
    if (narrowLayout) { panel.style().set('shown', false); map.style().set('shown', true); }
  }
}));
nccpiViewContainer.add(nccpiHeroCard);
nccpiViewContainer.add(nccpiSeasonCard);
nccpiViewContainer.add(nccpiChartPanel);
nccpiViewContainer.add(nccpiSlopePanel);
nccpiViewContainer.add(nccpiZoneCard);
nccpiViewContainer.add(nccpiNoteCard);

function statTile(value, caption, color) {
  return ui.Panel([
    ui.Label(value, {fontSize: '22px', fontWeight: 'bold', color: color || THEME.ink, margin: '0'}),
    ui.Label(caption, {fontSize: '10.5px', color: THEME.muted, margin: '2px 0 0 0', whiteSpace: 'pre'})
  ], ui.Panel.Layout.flow('vertical'), {margin: '0 16px 0 0', backgroundColor: 'rgba(0,0,0,0)'});
}

function smallLine(text, color, bold) {
  return ui.Label(text, {fontSize: '11.5px', color: color || THEME.body, fontWeight: bold ? 'bold' : 'normal',
    margin: '2px 0', whiteSpace: 'pre-wrap', backgroundColor: 'rgba(0,0,0,0)'});
}

function fmtCi(ci) { return '[' + ci[0].toFixed(3) + ', ' + ci[1].toFixed(3) + ']'; }

// Static content: built once.
function buildNccpiStatic() {
  // Pearson r by season with 5 km block-bootstrap intervals.
  var rows = [[{label: 'Season', type: 'string'}, {label: 'Pearson r', type: 'number'},
    {type: 'number', role: 'interval'}, {type: 'number', role: 'interval'}, {label: 'Spearman ρ', type: 'number'}]];
  COLAB_STATS.years.forEach(function(y) {
    var a = NC.annual[y];
    rows.push([String(y), a.r, a.lo, a.hi, a.rho]);
  });
  nccpiChartPanel.add(ui.Chart(rows).setChartType('ColumnChart').setOptions({
    title: 'Agreement with NCCPI by season (all rainfed-corn pixels)',
    hAxis: {title: 'Season'},
    vAxis: {title: 'Correlation', viewWindow: {min: 0, max: 0.3}},
    series: {0: {type: 'bars', color: SOIL}, 1: {type: 'line', color: THEME.ink, pointSize: 5, lineWidth: 0}},
    seriesType: 'bars',
    intervals: {style: 'sticks', color: THEME.ink},
    legend: {position: 'none'},
    chartArea: {left: 45, top: 35, width: '85%', height: '65%'}
  }));
  nccpiChartPanel.add(chartKey([[SOIL, '■', 'Pearson r, bars = 95% CI'], [THEME.ink, '●', 'Spearman ρ']]));

  // Latitude bands.
  nccpiZoneCard.add(kicker('By latitude band (common domain)', THEME.muted));
  NC.zones.forEach(function(z) {
    nccpiZoneCard.add(smallLine(z.zone + ' · ' + fmtInt(z.ha) + ' ha · mean NCCPI ' + z.nccpi.toFixed(3) + ' · r = ' + z.r.toFixed(3), THEME.ink));
  });
  nccpiZoneCard.add(smallLine('Agreement is similar in all three bands, slightly strongest in the south.', THEME.muted));

  // Caveats, in plain language.
  nccpiNoteCard.add(kicker('Reading these numbers', THEME.muted));
  nccpiNoteCard.add(smallLine(
    '• Correlations are weak but consistently positive in every season; the sign holds after spatial ' +
    'adjustment (Clifford–Dutilleul modified t-test, Benjamini–Hochberg q < 0.002 for all seasons).\n' +
    '• Both harvest-index options give the same r: a season-wide HI rescales yield without changing its spatial pattern.\n' +
    '• Soil ratings come from the December 2025 soils release, not the 2001–2017 seasons.\n' +
    '• Intervals are 5 km block bootstraps (2,000 draws); no block size guarantees independence.\n' +
    '• Source: ' + NC.source + '; slope from USGS 3DEP.'));
}

// Dynamic content: follows the Season and Harvest index selectors.
function updateNccpiView(yearInt, scenario) {
  var a = NC.annual[yearInt];
  var d = NC.domain[scenario];
  var sc = scenarioColor(scenario);

  nccpiHeroCard.clear();
  nccpiHeroCard.add(kicker(yearInt + ' season · all rainfed-corn pixels', SOIL));
  nccpiHeroCard.add(ui.Panel([
    statTile('r = ' + a.r.toFixed(2), 'Pearson, yield vs NCCPI\n95% CI ' + fmtCi([a.lo, a.hi]), SOIL),
    statTile('ρ = ' + a.rho.toFixed(2), 'Spearman rank\ncorrelation'),
    statTile(a.nccpi.toFixed(3), 'mean NCCPI on\n' + fmtInt(a.ha) + ' ha')
  ], ui.Panel.Layout.flow('horizontal'), {margin: '4px 0 6px 0', backgroundColor: 'rgba(0,0,0,0)'}));
  var rank = COLAB_STATS.years.slice().sort(function(p, q) { return NC.annual[q].r - NC.annual[p].r; }).indexOf(yearInt) + 1;
  nccpiHeroCard.add(smallLine('Rank ' + rank + ' of 9 seasons for agreement. Change the season in "Map and live model".', THEME.muted));

  nccpiSeasonCard.clear();
  nccpiSeasonCard.add(kicker('Common domain · ' + scenarioLabel(scenario), sc));
  nccpiSeasonCard.add(smallLine(fmtInt(NC.common.pixels) + ' pixels (' + fmtInt(NC.common.ha) + ' ha) that were rainfed corn in all nine seasons; mean NCCPI ' + NC.common.nccpi_mean.toFixed(3) + '.'));
  nccpiSeasonCard.add(smallLine('• 2015 benchmark: r = ' + d.r2015.toFixed(3) + ' ' + fmtCi(d.ci2015) + ', ρ = ' + d.rho2015.toFixed(3) + ', mean yield ' + d.yield2015.toFixed(2) + ' Mg ha⁻¹', THEME.ink));
  nccpiSeasonCard.add(smallLine('• Nine-season mean: r = ' + d.rMean.toFixed(3) + ' ' + fmtCi(d.ciMean) + ', ρ = ' + d.rhoMean.toFixed(3) + ', mean yield ' + d.yieldMean.toFixed(2) + ' Mg ha⁻¹', THEME.ink));
  nccpiSeasonCard.add(smallLine('• Difference (mean − 2015): Δr = ' + d.delta.toFixed(3) + ' ' + fmtCi(d.deltaCi) + '. Averaging seasons slightly weakens agreement.', sc, true));

  // Slope classes: bars = nine-season mean yield (selected scenario), line = mean NCCPI.
  var rows = [[{label: 'Slope (%)', type: 'string'},
    {label: 'Mean yield, ' + scenarioLabel(scenario) + ' (Mg ha⁻¹)', type: 'number'},
    {label: 'Mean NCCPI', type: 'number'}]];
  NC.slope.forEach(function(s) { rows.push([s[0], scenario === 'M1_fixed' ? s[3] : s[4], s[2]]); });
  var f = NC.slopeFit;
  nccpiSlopePanel.clear();
  nccpiSlopePanel.add(ui.Chart(rows).setChartType('ComboChart').setOptions({
    title: 'Slope, soil rating and yield (common domain)',
    hAxis: {title: 'Slope class (% rise)'},
    seriesType: 'bars',
    series: {0: {targetAxisIndex: 0, color: sc}, 1: {type: 'line', targetAxisIndex: 1, color: SOIL, pointSize: 5, lineWidth: 2}},
    vAxes: {0: {title: 'Yield (Mg ha⁻¹)', viewWindow: {min: 7, max: 8.1}}, 1: {title: 'NCCPI', viewWindow: {min: 0.5, max: 0.72}}},
    legend: {position: 'none'},
    chartArea: {left: 45, top: 35, width: '76%', height: '62%'}
  }));
  nccpiSlopePanel.add(chartKey([[sc, '■', 'Nine-season mean yield'], [SOIL, '●', 'Mean NCCPI (right axis)']]));
  nccpiSlopePanel.add(ui.Label(
    'Per 1 % of slope, NCCPI drops ' + Math.abs(f.nccpi.b).toFixed(4) + ' (R² ' + f.nccpi.r2.toFixed(3) + ') and yield drops ' +
    Math.abs(f[scenario].b).toFixed(3) + ' Mg ha⁻¹ ' + fmtCi([f[scenario].lo, f[scenario].hi]) + ' (R² ' + f[scenario].r2.toFixed(3) +
    '). Steeper ground rates lower on soils; modeled yield barely responds.', {fontSize: '11.5px', color: THEME.muted, margin: '2px 12px', whiteSpace: 'pre-wrap'}));
}

// Field validation detail, shown under "How the model compares with observations".
var fieldCheckCard = ui.Panel({style: CARD_STYLE});
chartsViewContainer.add(fieldCheckCard);

function buildFieldCheck() {
  var fc = COLAB_STATS.fieldCheck;
  fieldCheckCard.add(kicker('Commercial field check, in detail'));
  fc.eligibility.forEach(function(e) {
    fieldCheckCard.add(smallLine(e.year + ': ' + e.candidates + ' field records → ' + e.supported + ' with modeled cover → ' + e.primary + ' used', e.primary ? THEME.ink : THEME.muted));
  });
  fieldCheckCard.add(smallLine('Used = at least 80 % valid rainfed-corn cover and 10 pixels after a 30 m inward buffer. No 2013 field overlapped the corn mask.', THEME.muted));

  var rows = [[{label: 'Observed (Mg ha⁻¹)', type: 'number'}, {label: SCENARIO_LABELS.M1_fixed, type: 'number'},
    {label: SCENARIO_LABELS.M2_HI_sensitivity, type: 'number'}, {label: '1 : 1', type: 'number'}]];
  fc.multiyear.forEach(function(r) { rows.push([r[0], r[1], r[2], null]); });
  rows.push([8, null, null, 8]); rows.push([12.5, null, null, 12.5]);
  fieldCheckCard.add(ui.Chart(rows).setChartType('ScatterChart').setOptions({
    title: '14 fields observed in 2015 and 2017 (two-season means)',
    hAxis: {title: 'Observed (Mg ha⁻¹)', viewWindow: {min: 8, max: 12.5}},
    vAxis: {title: 'Modeled (Mg ha⁻¹)', viewWindow: {min: 8, max: 12.5}},
    series: {0: {color: THEME.m1, pointSize: 5}, 1: {color: THEME.primary, pointSize: 5},
             2: {color: THEME.grid, pointSize: 0, lineWidth: 1, lineDashStyle: [4, 4]}},
    legend: {position: 'none'},
    chartArea: {left: 45, top: 35, width: '85%', height: '65%'}
  }));

  fieldCheckCard.add(chartKey([[THEME.m1, '●', 'Fixed HI (M1)'], [THEME.primary, '●', 'Annual HI (M2)'], [THEME.grid, '- -', '1 : 1']]));
  fieldCheckCard.add(smallLine('Error by latitude band (RMSE / bias, Mg ha⁻¹):', THEME.ink, true));
  ['North', 'Central', 'South'].forEach(function(z) {
    var v = fc.zones[z];
    fieldCheckCard.add(smallLine('• ' + z + ' (' + v.n + '): fixed HI ' + v.M1_fixed.rmse.toFixed(2) + ' / ' + v.M1_fixed.bias.toFixed(2) +
      ' · annual HI ' + v.M2_HI_sensitivity.rmse.toFixed(2) + ' / ' + v.M2_HI_sensitivity.bias.toFixed(2)));
  });
  fieldCheckCard.add(smallLine('Predictive R²: fixed HI ' + fc.predictiveR2.M1_fixed.toFixed(2) + ', annual HI ' + fc.predictiveR2.M2_HI_sensitivity.toFixed(2) +
    ' (below 0 means larger errors than predicting the sample mean). Field moisture basis is unknown, so absolute errors assume 15.5 %. ' +
    'Spatial intervals are withheld because every set has fewer than 20 independent groups.', THEME.muted));
}

// -----------------------------------------------------------------------------------------
// 11. MAP LEGEND GENERATION
// -----------------------------------------------------------------------------------------

var legend = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '10px 14px',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    border: '1px solid ' + THEME.line
  }
});
map.add(legend);

function updateLegend(layerKey, year, scenario) {
  legend.clear();
  var title = kicker('Map legend', THEME.muted);
  legend.add(title);

  if (layerKey === 'yield') {
    var subtitle = ui.Label('Yield, Mg ha⁻¹ · ' + scenarioLabel(scenario), {fontSize: '11px', color: THEME.body, margin: '0 0 6px 0'});
    legend.add(subtitle);

    var colorBar = ui.Thumbnail({
      image: ee.Image.pixelLonLat().select(0),
      params: {
        bbox: [0, 0, 1, 0.1],
        dimensions: '180x12',
        format: 'png',
        min: 0,
        max: 1,
        palette: YIELD_VIS.palette
      },
      style: {stretch: 'horizontal', margin: '0 0 4px 0'}
    });
    legend.add(colorBar);

    var labels = ui.Panel({
      layout: ui.Panel.Layout.flow('horizontal'),
      style: {stretch: 'horizontal', margin: '0 0 4px 0'}
    });
    labels.add(ui.Label('0', {fontSize: '10px', margin: '0', stretch: 'horizontal'}));
    labels.add(ui.Label('10', {fontSize: '10px', margin: '0', textAlign: 'center', stretch: 'horizontal'}));
    labels.add(ui.Label('20+', {fontSize: '10px', margin: '0', textAlign: 'right', stretch: 'horizontal'}));
    legend.add(labels);
    legend.add(ui.Label('Same 0–20+ scale in every year; no data is transparent.',
      {fontSize: '10px', color: THEME.muted, margin: '0 0 4px 0'}));
  } else if (layerKey === 'nccpi') {
    legend.add(ui.Label('Soil productivity, NCCPI Corn v3 (0–1)', {fontSize: '11px', color: THEME.body, margin: '0 0 6px 0'}));
    legend.add(ui.Thumbnail({
      image: ee.Image.pixelLonLat().select(0),
      params: {bbox: [0, 0, 1, 0.1], dimensions: '180x12', format: 'png', min: 0, max: 1, palette: NCCPI_VIS.palette},
      style: {stretch: 'horizontal', margin: '0 0 4px 0'}
    }));
    legend.add(ui.Panel([
      ui.Label('≤ 0.3 less', {fontSize: '10px', margin: '0', stretch: 'horizontal'}),
      ui.Label('0.6', {fontSize: '10px', margin: '0', textAlign: 'center', stretch: 'horizontal'}),
      ui.Label('more ≥ 0.9', {fontSize: '10px', margin: '0', textAlign: 'right', stretch: 'horizontal'})
    ], ui.Panel.Layout.flow('horizontal'), {stretch: 'horizontal', margin: '0 0 4px 0'}));
    legend.add(ui.Label('USDA-NRCS soil rating for rainfed corn; not a yield.', {fontSize: '10px', color: THEME.muted, margin: '0 0 4px 0'}));
  } else if (layerKey === 'npp_season' || layerKey === 'gpp_season' || layerKey === 'gpp_calendar') {
    var fluxLabel = ui.Label(LAYER_LABELS[layerKey] + ' (kg C m⁻²)', {fontSize: '11px', color: THEME.body, margin: '0 0 6px 0'});
    legend.add(fluxLabel);
    var fluxBar = ui.Thumbnail({
      image: ee.Image.pixelLonLat().select(0),
      params: {
        bbox: [0, 0, 1, 0.1],
        dimensions: '180x12',
        format: 'png',
        min: 0,
        max: 1,
        palette: GPP_VIS.palette
      },
      style: {stretch: 'horizontal', margin: '0 0 4px 0'}
    });
    legend.add(fluxBar);
  } else {
    var layerInfo = ui.Label(LAYER_LABELS[layerKey] || layerKey, {fontSize: '11px', color: THEME.body});
    legend.add(layerInfo);
  }

  // Feature Indicators
  var markerLegend = ui.Panel([
    ui.Label('◆ CSP3 flux tower (US-Ne3)', {fontSize: '11px', color: THEME.tower, fontWeight: 'bold'}),
    ui.Label('― CSP3 field (about 65 ha)', {fontSize: '11px', color: THEME.field, fontWeight: 'bold'}),
    ui.Label('― MLRA 106 boundary', {fontSize: '11px', color: THEME.boundary, fontWeight: 'bold'}),
    ui.Label('┄ 30 m analysis grid extent (off by default)', {fontSize: '11px', color: THEME.grid})
  ]);
  legend.add(markerLegend);
}

// -----------------------------------------------------------------------------------------
// 12. CORE UPDATE FUNCTION
// -----------------------------------------------------------------------------------------

function updateApp() {
  var year = yearSelect.getValue();
  if (isExtendedYear(year)) {
    updateExtendedApp();
    return;
  }
  layerSelect.setDisabled(false);
  maskCheckbox.setDisabled(false);
  viewSelect.setDisabled(false);
  sourceBadge.setValue('Historical 2001–2017 production-efficiency model. Year-specific HI may be measured, estimated, provisional, or fixed-fill.');
  ++inspectSeq; // Do not let a prior-year pixel lookup overwrite this view.
  inspectorLabel.setValue('Click the map inside MLRA 106, or use "Query CSP3 tower" above, to read any 30 m pixel.');
  mapChip.setValue('Tap the map to read a pixel');
  var scenario = scenarioSelect.getValue();
  var activeLayer = layerSelect.getValue();
  var applyCornMask = maskCheckbox.getValue();
  var opacity = opacitySlider.getValue() / 100;
  var yearInt = parseInt(year, 10);

  // 1. Reset Map Layers
  map.layers().reset();
  inspectedLayer = null;

  // Layer 0: 30-m Analysis Grid Bounds (EPSG:5070)
  var gridOutline = ee.Image().paint({
    featureCollection: ee.FeatureCollection([ee.Feature(aoiGrid)]),
    color: 1,
    width: 1.5
  });
  map.addLayer(gridOutline, {palette: [THEME.grid]}, '30 m analysis grid extent (EPSG:5070)', false);

  // Layer 1: MLRA 106 Nebraska Boundary Outline
  var mlraOutline = ee.Image().paint({
    featureCollection: ee.FeatureCollection([ee.Feature(mlra106)]),
    color: 1,
    width: 2.5
  });
  map.addLayer(mlraOutline, {palette: [THEME.boundary]}, 'MLRA 106 boundary');

  // Layer 2: Compute Live Rasters across the entire MLRA 106 AOI
  var models = computeLiveModel(year, scenario, applyCornMask);
  var maskSuffix = applyCornMask ? ', corn fields' : ', full landscape';

  var activeRasterLayer;
  if (activeLayer === 'yield') {
    activeRasterLayer = map.addLayer(models.yield, YIELD_VIS, year + ' yield, ' + scenarioLabel(scenario) + maskSuffix);
  } else if (activeLayer === 'npp_season') {
    activeRasterLayer = map.addLayer(models.nppSeason, NPP_VIS, year + ' allocated seasonal NPP' + maskSuffix);
  } else if (activeLayer === 'gpp_season') {
    activeRasterLayer = map.addLayer(models.gppSeason, GPP_VIS, year + ' growing-season GPP');
  } else if (activeLayer === 'gpp_calendar') {
    activeRasterLayer = map.addLayer(models.gppCalendar, GPP_VIS, year + ' calendar-year GPP');
  } else if (activeLayer === 'fraction') {
    activeRasterLayer = map.addLayer(models.fraction, FRAC_VIS, year + ' share of GPP in the growing season');
  } else if (activeLayer === 'nccpi') {
    var nccpiLayerImg = NCCPI_IMG.clip(mlra106);
    if (applyCornMask) { nccpiLayerImg = nccpiLayerImg.updateMask(models.cdlCorn); }
    activeRasterLayer = map.addLayer(nccpiLayerImg, NCCPI_VIS, 'Soil productivity, NCCPI Corn v3' + (applyCornMask ? ' (' + year + ' corn fields)' : ''));
  } else if (activeLayer === 'cdl') {
    activeRasterLayer = map.addLayer(models.cdlCorn.selfMask(), {palette: ['#C48A16']}, year + ' rainfed corn fields (cleaned mask)');
  }
  if (activeRasterLayer) {
    activeRasterLayer.setOpacity(opacity);
  }

  // Layer 3: CSP3 Research Field Footprint Outline
  var csp3FieldOutline = ee.Image().paint({
    featureCollection: ee.FeatureCollection([ee.Feature(csp3Field)]),
    color: 1,
    width: 2.0
  });
  map.addLayer(csp3FieldOutline, {palette: ['#F9A825']}, 'CSP3 field (about 65 ha)');

  // Layer 4: CSP3 AmeriFlux Tower Site Marker
  map.addLayer(csp3Tower, {color: THEME.tower}, 'CSP3 flux tower (US-Ne3)');

  // 2. Update Stats Card
  var yStats = COLAB_STATS.yield[yearInt][scenario];
  var pStats = COLAB_STATS.patches[yearInt];
  var ops = COLAB_STATS.operations[yearInt];
  var csp3Rec = COLAB_STATS.csp3_site_records.history[yearInt];

  statsCard.clear();
  statsCard.add(kicker(year + ' season · ' + scenarioLabel(scenario), scenarioColor(scenario)));
  statsCard.add(ui.Panel([
    ui.Label(yStats.mean.toFixed(2), {fontSize: '34px', fontWeight: 'bold', color: THEME.ink, margin: '0 10px 0 0'}),
    ui.Label('Mg ha⁻¹ mean yield\n± ' + yStats.sd.toFixed(2) + ' · range ' + yStats.min.toFixed(2) + '–' + yStats.max.toFixed(2),
      {fontSize: '12px', color: THEME.body, whiteSpace: 'pre', margin: '8px 0 0 0'})
  ], ui.Panel.Layout.flow('horizontal'), {margin: '0 0 8px 0'}));

  var statsGrid = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {margin: '2px 0'}
  });

  statsGrid.add(ui.Label('• Modeled production: ' + (yStats.prod_Mg / 1e6).toFixed(2) + ' million Mg on ' + fmtInt(yStats.valid_ha) + ' ha', {fontSize: '12px', color: THEME.ink, margin: '2px 0'}));
  statsGrid.add(ui.Label('• Harvest index: ' + yStats.hi.toFixed(3) + ' (' + hiSourceLabel(yStats.hi_type) + ')', {fontSize: '12px', color: scenarioColor(scenario), fontWeight: 'bold', margin: '2px 0'}));
  statsGrid.add(ui.Label('• CSP3 observed yield: ' + csp3Rec.obs_mgha.toFixed(2) + ' Mg ha⁻¹ (reported ' + csp3Rec.field_harvest + ')', {fontSize: '12px', color: THEME.ink, margin: '2px 0'}));
  statsGrid.add(ui.Label('• Agreement with soil productivity (NCCPI): r = ' + COLAB_STATS.nccpi.annual[yearInt].r.toFixed(2) + ' (see the NCCPI view)', {fontSize: '12px', color: '#8c5a2b', margin: '2px 0'}));
  statsGrid.add(ui.Label('• Fields mapped: ' + fmtInt(pStats.n_patches) + ' (median ' + pStats.median_ha.toFixed(1) + ' ha)', {fontSize: '12px', color: THEME.ink, margin: '2px 0'}));
  statsGrid.add(ui.Label('• Planted ' + ops.plant + ' · harvested ' + ops.harvest, {fontSize: '11px', color: THEME.muted, margin: '6px 0 0 0'}));

  statsCard.add(statsGrid);

  // Update View 2 CSP3 history
  updateCsp3HistoryCard(yearInt);
  updateNccpiView(yearInt, scenario);

  // 3. Update Legend
  updateLegend(activeLayer, year, scenario);
}

// -----------------------------------------------------------------------------------------
// 13. POINT INSPECTION HANDLER
// -----------------------------------------------------------------------------------------

var inspectedLayer = null;
var inspectSeq = 0;

function queryLocation(coords) {
  inspectorLabel.setValue('Reading pixel at ' + coords.lat.toFixed(4) + '° N, ' + Math.abs(coords.lon).toFixed(4) + '° W…');
  var point = ee.Geometry.Point([coords.lon, coords.lat]);

  var year = yearSelect.getValue();
  var scenario = scenarioSelect.getValue();
  var applyCornMask = maskCheckbox.getValue();
  var models = computeLiveModel(year, scenario, applyCornMask);

  var sampleImg = ee.Image.cat([
    models.yield,
    models.nppSeason,
    models.gppSeason,
    models.gppCalendar,
    models.fraction
  ]);

  sampleImg.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 30
  }).evaluate(function(result) {
    var isCsp3 = (Math.abs(coords.lon - (-96.4397)) < 0.005 && Math.abs(coords.lat - 41.1797) < 0.005);
    var prefix = isCsp3 ? 'CSP3 flux tower, Mead (US-Ne3)\n' : coords.lat.toFixed(4) + '° N, ' + Math.abs(coords.lon).toFixed(4) + '° W\n';

    if (!result || result.yield_Mg_ha === null || result.yield_Mg_ha === undefined) {
      mapChip.setValue('No corn here in ' + year);
      inspectorLabel.setValue(
        prefix + 'No corn in this pixel in ' + year + '.\nUncheck "Show corn fields only" to read any pixel.'
      );
    } else {
      var csp3Obs = isCsp3 ? ('\n• CSP3 observed: ' + COLAB_STATS.csp3_site_records.history[parseInt(year, 10)].obs_mgha.toFixed(2) + ' Mg ha⁻¹') : '';
      mapChip.setValue((isCsp3 ? 'CSP3 tower · ' : '') + Number(result.yield_Mg_ha).toFixed(2) + ' Mg ha⁻¹ modeled');
      inspectorLabel.setValue(
        prefix +
        '• Modeled yield, ' + scenarioLabel(scenario) + ': ' + Number(result.yield_Mg_ha).toFixed(2) + ' Mg ha⁻¹' + csp3Obs + '\n' +
        '• Allocated seasonal NPP: ' + Number(result.npp_season).toFixed(3) + ' kg C m⁻²\n' +
        '• Growing-season GPP: ' + Number(result.gpp_season).toFixed(3) + ' kg C m⁻²\n' +
        '• Calendar-year GPP: ' + Number(result.gpp_calendar).toFixed(3) + ' kg C m⁻²\n' +
        '• Share of GPP in the growing season: ' + (Number(result.gpp_fraction) * 100).toFixed(1) + ' %'
      );
    }
  });

  // NCCPI is read separately, so yield readings never depend on the soil asset loading.
  var seq = ++inspectSeq;
  NCCPI_IMG.reduceRegion({reducer: ee.Reducer.first(), geometry: point, scale: 30}).evaluate(function(r, err) {
    var v = (!err && r && r.nccpi !== null && r.nccpi !== undefined) ? Number(r.nccpi).toFixed(3) : (err ? 'unavailable' : 'no rating');
    var tries = 0;
    var append = function() {
      if (seq !== inspectSeq) { return; }  // a newer click has taken over
      var cur = inspectorLabel.getValue();
      if (cur.indexOf('Reading pixel') === 0 && tries++ < 40) { ui.util.setTimeout(append, 250); return; }
      inspectorLabel.setValue(cur + '\n• Soil productivity (NCCPI Corn v3): ' + v);
    };
    append();
  });

  // Highlight inspected point on its own layer, so the tower marker stays visible.
  if (inspectedLayer) { map.layers().remove(inspectedLayer); }
  inspectedLayer = ui.Map.Layer(point, {color: THEME.primary}, 'Inspected point');
  map.layers().add(inspectedLayer);
}

map.onClick(function(coords) {
  querySelectedLocation(coords);
});

// -----------------------------------------------------------------------------------------
// 14. INITIALIZE APPLICATION
// -----------------------------------------------------------------------------------------

// Footer: link back to the project page.
panel.add(ui.Label({
  value: 'Project page · noahberkowitzgeo.com ↗',
  targetUrl: 'https://noahberkowitzgeo.com/body-of-work-2/#doctoral-research',
  style: {fontSize: '12px', color: THEME.primary, margin: '4px 8px 14px 8px', backgroundColor: 'rgba(0,0,0,0)'}
}));

// Narrow screens (phones, small embeds): map first, panel on demand.
var mapChip = ui.Label('Tap the map to read a pixel', {fontSize: '12px', color: THEME.ink, fontWeight: 'bold', margin: '0',
  padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid ' + THEME.line});
var showPanelBtn = ui.Button({label: 'Results & settings', onClick: function() {
  panel.style().set('shown', true); map.style().set('shown', false);
}});
var mobileBar = ui.Panel([showPanelBtn, mapChip], ui.Panel.Layout.flow('vertical'),
  {position: 'top-left', padding: '0', backgroundColor: 'rgba(0,0,0,0)', shown: false});
map.add(mobileBar);
var backToMapBtn = ui.Button({label: '← Back to map', style: {shown: false, margin: '0 0 12px 0'}, onClick: function() {
  panel.style().set('shown', false); map.style().set('shown', true);
}});
panel.insert(0, backToMapBtn);

var narrowLayout = null;
// Earth Engine's deviceInfo width is not in CSS pixels, so decide by device and orientation.
function applyLayout(info) {
  var narrow = info.is_mobile || info.is_portrait;
  if (narrow === narrowLayout) { return; }
  narrowLayout = narrow;
  panel.style().set({width: narrow ? '100%' : '420px', shown: !narrow});
  map.style().set('shown', true);
  mobileBar.style().set('shown', narrow);
  backToMapBtn.style().set('shown', narrow);
  legend.style().set('shown', true);
}
ui.root.onResize(applyLayout);

buildColabCharts();
buildNccpiStatic();
buildFieldCheck();
updateApp();
// 2019/2021 use completed, grid-verified annual rasters in the same controls.
// Historical 2001–2017 remains a live calculation. No new-year GPP/NPP
// diagnostic assets or independent validation statistics are implied here.
// Pre-extension source snapshot:
// https://code.earthengine.google.com/5061e5ec018660ec1c9e09c476314b59
var EXT_ASSET_ROOT = 'projects/ee-njberkowitz95/assets/';
var EXT_GRID = [30, 0, -111285, 0, -30, 2047275];
// Yield assets re-masked 2026-09-28 with the core-filter cleaned masks
// (CSP3_GPP_outputs/extension_2019_2021/20260928_corefilter_remask_v1); '_corefilter' suffix keeps the
// earlier assets intact. Values inside the new masks are pixel-identical to the earlier rasters.
var EXT_RECORDS = {
  '2019': {
    status: 'PUBLISHED INPUTS',
    caveat: '2019 CDL corn, official LANID and published Landsat GPP/NPP. M2 HI is a mixed-support estimate, not a same-plot grain/biomass measurement.',
    patches: 12456,
    validPixels: 3921802,
    scenarios: {
      M1_fixed: {asset: 'csp3_dryland_corn_yield_2019_M1_fixed_corefilter',
        mean: 10.07201908537078, sd: 1.365299343304221,
        min: 0.9876227101774182, max: 15.186406870015515,
        hi: 0.5, hiStatus: 'fixed model value'},
      M2_HI_sensitivity: {asset: 'csp3_dryland_corn_yield_2019_M2_HI_sensitivity_corefilter',
        mean: 9.706245191640484, sd: 1.3157173426472983,
        min: 0.9517563559562716, max: 14.634899657257536,
        hi: 0.48184207701405357, hiStatus: 'estimated from mixed-support harvest and biomass data'}
    }
  },
  '2021': {
    status: 'EXPERIMENTAL PROXY — NOT AN OFFICIAL 2021 LANID/NTSG PRODUCT',
    caveat: '2021 CDL corn with nominal-2020 LGRIP rainfed proxy and research NPP. Irrigation is not same-year LANID truth; measured HI is unavailable. M1 and M2 pixels are identical.',
    patches: 8669,
    validPixels: 1953011,
    scenarios: {
      M1_fixed: {asset: 'csp3_dryland_corn_yield_2021_M1_fixed_corefilter',
        mean: 11.542817536776829, sd: 0.7698211329679278,
        min: 4.195623610158608, max: 16.440636008640148,
        hi: 0.5, hiStatus: 'fixed model value'},
      M2_HI_sensitivity: {asset: 'csp3_dryland_corn_yield_2021_M1_fixed_corefilter',
        mean: 11.542817536776829, sd: 0.7698211329679278,
        min: 4.195623610158608, max: 16.440636008640148,
        hi: 0.5, hiStatus: 'fixed-fill; measured 2021 HI missing, identical to M1'}
    }
  }
};

function isExtendedYear(year) {
  return year === '2019' || year === '2021';
}
function selectedExtensionImage() {
  var year = yearSelect.getValue();
  var scenario = scenarioSelect.getValue();
  var asset = EXT_RECORDS[year].scenarios[scenario].asset;
  var image = ee.Image(EXT_ASSET_ROOT + asset).select('b1');
  return image.updateMask(image.gte(0)); // Preserve exported off-crop nodata.
}
function updateExtendedApp() {
  var year = yearSelect.getValue();
  var scenario = scenarioSelect.getValue();
  var record = EXT_RECORDS[year];
  var data = record.scenarios[scenario];
  var opacity = opacitySlider.getValue() / 100;
  // Only completed yield assets were uploaded for 2019/2021. Do not expose
  // historical live GPP, NPP, CDL, or NCCPI layers as new-year products.
  layerSelect.setValue('yield', false);
  layerSelect.setDisabled(true);
  maskCheckbox.setValue(true, false);
  maskCheckbox.setDisabled(true);
  viewSelect.setValue('map_view', false);
  switchView('map_view');
  viewSelect.setDisabled(true);
  sourceBadge.setValue(record.status + '\n' + record.caveat +
    '\nOnly the completed dryland-corn yield raster is available in this year. Other views and map layers remain historical (2001–2017).');
  inspectedLayer = null;
  ++inspectSeq; // Invalidate any pending historical or new-year pixel lookup.
  map.layers().reset();

  var gridOutline = ee.Image().paint({
    featureCollection: ee.FeatureCollection([ee.Feature(aoiGrid)]), color: 1, width: 1.5
  });
  map.addLayer(gridOutline, {palette: [THEME.grid]}, '30 m analysis grid extent (EPSG:5070)', false);
  var mlraOutline = ee.Image().paint({
    featureCollection: ee.FeatureCollection([ee.Feature(mlra106)]), color: 1, width: 2.5
  });
  map.addLayer(mlraOutline, {palette: [THEME.boundary]}, 'MLRA 106 boundary');
  var activeRasterLayer = map.addLayer(selectedExtensionImage(), YIELD_VIS,
    year + ' yield, ' + scenarioLabel(scenario) +
    (year === '2021' ? ' — EXPERIMENTAL LGRIP proxy' : ' — published inputs'));
  activeRasterLayer.setOpacity(opacity);
  var csp3FieldOutline = ee.Image().paint({
    featureCollection: ee.FeatureCollection([ee.Feature(csp3Field)]), color: 1, width: 2.0
  });
  map.addLayer(csp3FieldOutline, {palette: [THEME.field]}, 'CSP3 field (about 65 ha)');
  map.addLayer(csp3Tower, {color: THEME.tower}, 'CSP3 flux tower (US-Ne3)');

  var validHa = record.validPixels * 0.09; // A 30 m pixel is 0.09 ha.
  statsCard.clear();
  statsCard.add(kicker(year + ' season · ' + scenarioLabel(scenario) + ' · ' + record.status,
    scenarioColor(scenario)));
  statsCard.add(ui.Panel([
    ui.Label(data.mean.toFixed(2), {fontSize: '34px', fontWeight: 'bold',
      color: THEME.ink, margin: '0 10px 0 0'}),
    ui.Label('Mg ha⁻¹ mean yield\n± ' + data.sd.toFixed(2) + ' · range ' +
      data.min.toFixed(2) + '–' + data.max.toFixed(2),
      {fontSize: '12px', color: THEME.body, whiteSpace: 'pre', margin: '8px 0 0 0'})
  ], ui.Panel.Layout.flow('horizontal'), {margin: '0 0 8px 0'}));
  var statsGrid = ui.Panel({layout: ui.Panel.Layout.flow('vertical'), style: {margin: '2px 0'}});
  statsGrid.add(ui.Label('• Valid modeled crop pixels: ' + fmtInt(record.validPixels) +
    ' (' + fmtInt(validHa) + ' ha)', {fontSize: '12px', color: THEME.ink, margin: '2px 0'}));
  statsGrid.add(ui.Label('• Harvest index: ' + data.hi.toFixed(3) + ' (' + data.hiStatus + ')',
    {fontSize: '12px', color: scenarioColor(scenario), fontWeight: 'bold', margin: '2px 0'}));
  statsGrid.add(ui.Label('• Indexed dryland-corn patches: ' + fmtInt(record.patches),
    {fontSize: '12px', color: THEME.ink, margin: '2px 0'}));
  statsGrid.add(ui.Label('• Grain moisture 0.155 and root:shoot 0.18 are fixed model parameters.',
    {fontSize: '11px', color: THEME.muted, margin: '4px 0'}));
  statsGrid.add(ui.Label('• ' + record.caveat,
    {fontSize: '11px', color: year === '2021' ? THEME.m1 : THEME.muted, margin: '4px 0'}));
  statsCard.add(statsGrid);
  inspectorLabel.setValue('Click a displayed ' + year +
    ' dryland-corn pixel to read its modeled yield. No data is transparent.');
  mapChip.setValue(year + (year === '2021' ? ' EXPERIMENTAL proxy' : ' published inputs'));
  legend.style().set('shown', true);
  updateLegend('yield', year, scenario);
}
function inspectExtensionLocation(coords) {
  var year = yearSelect.getValue();
  var scenario = scenarioSelect.getValue();
  var record = EXT_RECORDS[year];
  var seq = ++inspectSeq;
  var point = ee.Geometry.Point([coords.lon, coords.lat]);
  inspectorLabel.setValue('Reading the ' + year + ' source pixel…');
  selectedExtensionImage().reduceRegion({
    reducer: ee.Reducer.first(), geometry: point,
    crs: 'EPSG:5070', crsTransform: EXT_GRID, maxPixels: 1e8
  }).evaluate(function(result, error) {
    if (seq !== inspectSeq || year !== yearSelect.getValue() ||
        scenario !== scenarioSelect.getValue()) return;
    if (error) {
      inspectorLabel.setValue('Pixel lookup failed: ' + error);
    } else if (!result || result.b1 === null || result.b1 === undefined) {
      inspectorLabel.setValue('No modeled dryland-corn yield at this pixel in ' + year + '.');
      mapChip.setValue('No modeled crop pixel here in ' + year);
    } else {
      var value = Number(result.b1).toFixed(2);
      inspectorLabel.setValue(year + ' ' + scenarioLabel(scenario) +
        ': ' + value + ' Mg ha⁻¹\n' + record.status +
        '\nOnly yield was uploaded for this year; no per-pixel GPP/NPP diagnostics are asserted.');
      mapChip.setValue(year + ' · ' + value + ' Mg ha⁻¹ modeled');
    }
  });
  if (inspectedLayer) map.layers().remove(inspectedLayer);
  inspectedLayer = ui.Map.Layer(point, {color: THEME.primary}, 'Inspected point');
  map.layers().add(inspectedLayer);
}
function querySelectedLocation(coords) {
  if (isExtendedYear(yearSelect.getValue())) inspectExtensionLocation(coords);
  else queryLocation(coords);
}
