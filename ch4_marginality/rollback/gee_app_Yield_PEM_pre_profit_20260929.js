
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

var CH4_DATA = {"years": [2001, 2003, 2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2021], "mgha_per_buac": 0.06276766474688954, "asset": "projects/ee-njberkowitz95/assets/ch4_verified_yields_corefilter_20260928", "county_scope_asset": "projects/ee-njberkowitz95/assets/ch4_finbin_county_scope_corefilter_20260928", "annual": [{"year": 2001, "scenario": "M1_fixed", "experimental": false, "n": 3525196, "mean": 7.742699237581749, "sd": 1.4009239330760983, "min": 1.4625896215438843, "max": 11.932127952575684, "p05": 3.7459437251091003, "p25": 7.611388444900513, "median": 8.070000648498535, "p75": 8.445443153381348, "p95": 9.167905807495117, "cutoff_Mg_ha": 7.611388444900513, "crop_ha": 326203.74, "aoi_boundary_crop_ha": 3.8699999999999997, "valid_ha": 317267.64, "missing_ha": 8936.1, "quartile_ha": 79316.91, "quartile_percent": 25.0, "nccpi_valid_ha": 317071.98}, {"year": 2001, "scenario": "M2_HI_sensitivity", "experimental": false, "n": 3525196, "mean": 7.742699237581749, "sd": 1.4009239330760983, "min": 1.4625896215438843, "max": 11.932127952575684, "p05": 3.7459437251091003, "p25": 7.611388444900513, "median": 8.070000648498535, "p75": 8.445443153381348, "p95": 9.167905807495117, "cutoff_Mg_ha": 7.611388444900513, "crop_ha": 326203.74, "aoi_boundary_crop_ha": 3.8699999999999997, "valid_ha": 317267.64, "missing_ha": 8936.1, "quartile_ha": 79316.91, "quartile_percent": 25.0, "nccpi_valid_ha": 317071.98}, {"year": 2003, "scenario": "M1_fixed", "experimental": false, "n": 3134047, "mean": 7.300803536878094, "sd": 1.327089673617896, "min": 1.122223138809204, "max": 11.649285316467285, "p05": 3.677274298667908, "p25": 7.036578178405762, "median": 7.5398173332214355, "p75": 8.027012825012207, "p95": 8.834748268127441, "cutoff_Mg_ha": 7.036578178405762, "crop_ha": 289853.73, "aoi_boundary_crop_ha": 3.15, "valid_ha": 282064.23, "missing_ha": 7789.5, "quartile_ha": 70516.26, "quartile_percent": 25.000071792158828, "nccpi_valid_ha": 281917.08}, {"year": 2003, "scenario": "M2_HI_sensitivity", "experimental": false, "n": 3134047, "mean": 7.300803536878094, "sd": 1.327089673617896, "min": 1.122223138809204, "max": 11.649285316467285, "p05": 3.677274298667908, "p25": 7.036578178405762, "median": 7.5398173332214355, "p75": 8.027012825012207, "p95": 8.834748268127441, "cutoff_Mg_ha": 7.036578178405762, "crop_ha": 289853.73, "aoi_boundary_crop_ha": 3.15, "valid_ha": 282064.23, "missing_ha": 7789.5, "quartile_ha": 70516.26, "quartile_percent": 25.000071792158828, "nccpi_valid_ha": 281917.08}, {"year": 2005, "scenario": "M1_fixed", "experimental": false, "n": 3413786, "mean": 7.670830107645355, "sd": 1.4661298184004012, "min": 1.0823920965194702, "max": 13.059136390686035, "p05": 3.6792479157447815, "p25": 7.546361565589905, "median": 7.998739957809448, "p75": 8.40156078338623, "p95": 9.217741012573242, "cutoff_Mg_ha": 7.546361565589905, "crop_ha": 316100.7, "aoi_boundary_crop_ha": 8.91, "valid_ha": 307240.74, "missing_ha": 8859.96, "quartile_ha": 76810.23, "quartile_percent": 25.00001464649512, "nccpi_valid_ha": 307034.64}, {"year": 2005, "scenario": "M2_HI_sensitivity", "experimental": false, "n": 3413786, "mean": 6.644603227474943, "sd": 1.2699865317146, "min": 0.9375864267349243, "max": 11.31204605102539, "p05": 3.1870270371437073, "p25": 6.536786317825317, "median": 6.928644418716431, "p75": 7.2775750160217285, "p95": 7.98456335067749, "cutoff_Mg_ha": 6.536786317825317, "crop_ha": 316100.7, "aoi_boundary_crop_ha": 8.91, "valid_ha": 307240.74, "missing_ha": 8859.96, "quartile_ha": 76810.23, "quartile_percent": 25.00001464649512, "nccpi_valid_ha": 307034.64}, {"year": 2007, "scenario": "M1_fixed", "experimental": false, "n": 3470152, "mean": 8.395028154853934, "sd": 1.61862227538498, "min": 1.619521141052246, "max": 13.848673820495605, "p05": 4.0403900146484375, "p25": 8.251138687133789, "median": 8.71271562576294, "p75": 9.18197751045227, "p95": 10.20113682746887, "cutoff_Mg_ha": 8.251138687133789, "crop_ha": 321235.47, "aoi_boundary_crop_ha": 7.02, "valid_ha": 312313.68, "missing_ha": 8921.789999999999, "quartile_ha": 78078.59999999999, "quartile_percent": 25.00005763436299, "nccpi_valid_ha": 312066.72}, {"year": 2007, "scenario": "M2_HI_sensitivity", "experimental": false, "n": 3470152, "mean": 7.8266458805422445, "sd": 1.5090340535720992, "min": 1.5098720788955688, "max": 12.911054611206055, "p05": 3.766836905479431, "p25": 7.692498683929443, "median": 8.122824668884277, "p75": 8.560315132141113, "p95": 9.510472536087034, "cutoff_Mg_ha": 7.692498683929443, "crop_ha": 321235.47, "aoi_boundary_crop_ha": 7.02, "valid_ha": 312313.68, "missing_ha": 8921.789999999999, "quartile_ha": 78078.59999999999, "quartile_percent": 25.00005763436299, "nccpi_valid_ha": 312066.72}, {"year": 2009, "scenario": "M1_fixed", "experimental": false, "n": 2857291, "mean": 9.163539866338416, "sd": 1.7558944398217151, "min": 0.49164673686027527, "max": 14.513936042785645, "p05": 4.352019309997559, "p25": 8.97908878326416, "median": 9.602717399597168, "p75": 10.061958312988281, "p95": 10.931979179382324, "cutoff_Mg_ha": 8.97908878326416, "crop_ha": 265079.88, "aoi_boundary_crop_ha": 2.61, "valid_ha": 257156.19, "missing_ha": 7923.69, "quartile_ha": 64289.159999999996, "quartile_percent": 25.00004374773168, "nccpi_valid_ha": 256965.93}, {"year": 2009, "scenario": "M2_HI_sensitivity", "experimental": false, "n": 2857291, "mean": 9.163539866338416, "sd": 1.7558944398217151, "min": 0.49164673686027527, "max": 14.513936042785645, "p05": 4.352019309997559, "p25": 8.97908878326416, "median": 9.602717399597168, "p75": 10.061958312988281, "p95": 10.931979179382324, "cutoff_Mg_ha": 8.97908878326416, "crop_ha": 265079.88, "aoi_boundary_crop_ha": 2.61, "valid_ha": 257156.19, "missing_ha": 7923.69, "quartile_ha": 64289.159999999996, "quartile_percent": 25.00004374773168, "nccpi_valid_ha": 256965.93}, {"year": 2011, "scenario": "M1_fixed", "experimental": false, "n": 3739411, "mean": 4.649890030604128, "sd": 1.263368478151877, "min": 0.0, "max": 9.561383247375488, "p05": 1.7729651927947998, "p25": 4.4510252475738525, "median": 4.92219352722168, "p75": 5.329243183135986, "p95": 6.217602729797363, "cutoff_Mg_ha": 4.4510252475738525, "crop_ha": 346792.76999999996, "aoi_boundary_crop_ha": 5.49, "valid_ha": 336546.99, "missing_ha": 10245.779999999999, "quartile_ha": 84136.77, "quartile_percent": 25.00000668554486, "nccpi_valid_ha": 336281.39999999997}, {"year": 2011, "scenario": "M2_HI_sensitivity", "experimental": false, "n": 3739411, "mean": 4.585771792018764, "sd": 1.2459476442317292, "min": 0.0, "max": 9.429539680480957, "p05": 1.748517394065857, "p25": 4.389649152755737, "median": 4.854320526123047, "p75": 5.255757093429565, "p95": 6.131866931915283, "cutoff_Mg_ha": 4.389649152755737, "crop_ha": 346792.76999999996, "aoi_boundary_crop_ha": 5.49, "valid_ha": 336546.99, "missing_ha": 10245.779999999999, "quartile_ha": 84136.77, "quartile_percent": 25.00000668554486, "nccpi_valid_ha": 336281.39999999997}, {"year": 2013, "scenario": "M1_fixed", "experimental": false, "n": 3351121, "mean": 5.118982722519891, "sd": 1.3824305059292572, "min": 0.0, "max": 9.796733856201172, "p05": 1.994766354560852, "p25": 5.01600980758667, "median": 5.487758159637451, "p75": 5.87801456451416, "p95": 6.672763347625732, "cutoff_Mg_ha": 5.01600980758667, "crop_ha": 310377.06, "aoi_boundary_crop_ha": 3.8699999999999997, "valid_ha": 301600.89, "missing_ha": 8776.17, "quartile_ha": 75400.29, "quartile_percent": 25.000022380570563, "nccpi_valid_ha": 301372.29}, {"year": 2013, "scenario": "M2_HI_sensitivity", "experimental": false, "n": 3351121, "mean": 5.703103785261067, "sd": 1.5401780156020606, "min": 0.0, "max": 10.914627075195312, "p05": 2.2223868370056152, "p25": 5.588380813598633, "median": 6.113959789276123, "p75": 6.548748016357422, "p95": 7.434184551239014, "cutoff_Mg_ha": 5.588380813598633, "crop_ha": 310377.06, "aoi_boundary_crop_ha": 3.8699999999999997, "valid_ha": 301600.89, "missing_ha": 8776.17, "quartile_ha": 75400.29, "quartile_percent": 25.000022380570563, "nccpi_valid_ha": 301372.29}, {"year": 2015, "scenario": "M1_fixed", "experimental": false, "n": 3408408, "mean": 8.884062787195221, "sd": 2.106641549255999, "min": 1.158868432044983, "max": 14.235503196716309, "p05": 3.8818643927574157, "p25": 8.926181077957153, "median": 9.527812480926514, "p75": 10.012952089309692, "p95": 10.957081747055053, "cutoff_Mg_ha": 8.926181077957153, "crop_ha": 315754.74, "aoi_boundary_crop_ha": 7.47, "valid_ha": 306756.72, "missing_ha": 8998.02, "quartile_ha": 76689.18, "quartile_percent": 25.0, "nccpi_valid_ha": 306522.0}, {"year": 2015, "scenario": "M2_HI_sensitivity", "experimental": false, "n": 3408408, "mean": 9.989720793542983, "sd": 2.3688217193970194, "min": 1.3030943870544434, "max": 16.007169723510742, "p05": 4.364978313446045, "p25": 10.037081003189087, "median": 10.713588237762451, "p75": 11.25910496711731, "p95": 12.320735549926757, "cutoff_Mg_ha": 10.037081003189087, "crop_ha": 315754.74, "aoi_boundary_crop_ha": 7.47, "valid_ha": 306756.72, "missing_ha": 8998.02, "quartile_ha": 76689.18, "quartile_percent": 25.0, "nccpi_valid_ha": 306522.0}, {"year": 2017, "scenario": "M1_fixed", "experimental": false, "n": 3489266, "mean": 8.23184772948048, "sd": 2.0814616066709135, "min": 0.9720077514648438, "max": 12.80916690826416, "p05": 3.66741281747818, "p25": 8.153589725494385, "median": 9.028985023498535, "p75": 9.485933780670166, "p95": 10.140743255615234, "cutoff_Mg_ha": 8.153589725494385, "crop_ha": 323178.20999999996, "aoi_boundary_crop_ha": 3.5999999999999996, "valid_ha": 314033.94, "missing_ha": 9144.27, "quartile_ha": 78508.53, "quartile_percent": 25.000014329661308, "nccpi_valid_ha": 313820.19}, {"year": 2017, "scenario": "M2_HI_sensitivity", "experimental": false, "n": 3489266, "mean": 8.763193024361493, "sd": 2.2158147759124667, "min": 1.0347484350204468, "max": 13.635967254638672, "p05": 3.904135048389435, "p25": 8.6798837184906, "median": 9.611783981323242, "p75": 10.09822702407837, "p95": 10.795302391052246, "cutoff_Mg_ha": 8.6798837184906, "crop_ha": 323178.20999999996, "aoi_boundary_crop_ha": 3.5999999999999996, "valid_ha": 314033.94, "missing_ha": 9144.27, "quartile_ha": 78508.53, "quartile_percent": 25.000014329661308, "nccpi_valid_ha": 313820.19}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "n": 3921802, "mean": 10.07201908524825, "sd": 1.3652993430897815, "min": 0.9876227378845215, "max": 15.186407089233398, "p05": 8.724512243270874, "p25": 9.829856395721436, "median": 10.210228443145752, "p75": 10.632291793823242, "p95": 11.587911558151244, "cutoff_Mg_ha": 9.829856395721436, "crop_ha": 353360.33999999997, "aoi_boundary_crop_ha": 3.06, "valid_ha": 352962.18, "missing_ha": 398.15999999999997, "quartile_ha": 88240.59, "quartile_percent": 25.00001274924129, "nccpi_valid_ha": 352802.97}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "n": 3921802, "mean": 9.706245191734961, "sd": 1.3157173426855229, "min": 0.9517563581466675, "max": 14.634900093078613, "p05": 8.407673978805542, "p25": 9.472877025604248, "median": 9.83943510055542, "p75": 10.246171236038208, "p95": 11.167086601257324, "cutoff_Mg_ha": 9.472877025604248, "crop_ha": 353360.33999999997, "aoi_boundary_crop_ha": 3.06, "valid_ha": 352962.18, "missing_ha": 398.15999999999997, "quartile_ha": 88240.59, "quartile_percent": 25.00001274924129, "nccpi_valid_ha": 352802.97}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "n": 1953011, "mean": 11.54281753672208, "sd": 0.769821133114497, "min": 4.195623397827148, "max": 16.440635681152344, "p05": 10.345548152923584, "p25": 11.095331192016602, "median": 11.514275550842285, "p75": 11.936913013458252, "p95": 12.89518117904663, "cutoff_Mg_ha": 11.095331192016602, "crop_ha": 187807.41, "aoi_boundary_crop_ha": 0.0, "valid_ha": 175770.99, "missing_ha": 12036.42, "quartile_ha": 43942.77, "quartile_percent": 25.000012800747157, "nccpi_valid_ha": 175713.21}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "n": 1953011, "mean": 11.54281753672208, "sd": 0.769821133114497, "min": 4.195623397827148, "max": 16.440635681152344, "p05": 10.345548152923584, "p25": 11.095331192016602, "median": 11.514275550842285, "p75": 11.936913013458252, "p95": 12.89518117904663, "cutoff_Mg_ha": 11.095331192016602, "crop_ha": 187807.41, "aoi_boundary_crop_ha": 0.0, "valid_ha": 175770.99, "missing_ha": 12036.42, "quartile_ha": 43942.77, "quartile_percent": 25.000012800747157, "nccpi_valid_ha": 175713.21}], "costs": [{"year": 2019, "source": "UNL", "cash_cost_usd_ac": 363.18, "total_cost_usd_ac": 565.52, "operator_share": 1.0, "reported_price_usd_bu": null, "sample_n": null, "geography": "Eastern Nebraska", "account": "UNL total economic cost; cash excludes machinery ownership and real-estate opportunity", "full_economic_account": true, "source_file": "unl_2019.pdf", "published_cash_usd_bu": 2.14, "cash_rounding_discrepancy": true, "cash_note": "Line-item-derived cash cost; printed 2019 cash-per-bushel does not reconcile", "operating_cost_usd_ac": null, "land_cost_usd_ac": null, "overhead_usd_ac": null, "nass_price_usd_bu": 3.52, "cpi_u": 255.657, "to_2021_dollars": 1.059896658413421}, {"year": 2021, "source": "UNL", "cash_cost_usd_ac": 345.69, "total_cost_usd_ac": 572.18, "operator_share": 1.0, "reported_price_usd_bu": null, "sample_n": null, "geography": "Eastern Nebraska", "account": "UNL total economic cost; cash excludes machinery ownership and real-estate opportunity", "full_economic_account": true, "source_file": "unl_2021.pdf", "published_cash_usd_bu": 2.03, "cash_rounding_discrepancy": false, "cash_note": "Cash-per-bushel agrees within rounding", "operating_cost_usd_ac": null, "land_cost_usd_ac": null, "overhead_usd_ac": null, "nass_price_usd_bu": 5.96, "cpi_u": 270.97, "to_2021_dollars": 1.0}, {"year": 2019, "source": "ERS_Heartland", "cash_cost_usd_ac": null, "total_cost_usd_ac": 724.79, "operator_share": 1.0, "reported_price_usd_bu": 3.8, "sample_n": null, "geography": "ERS Heartland region; all production practices", "account": "Sector economic costs per planted acre; operating costs are not cash costs", "full_economic_account": true, "source_file": "ers_corn.csv", "published_cash_usd_bu": null, "cash_rounding_discrepancy": null, "cash_note": "Unavailable: operating category excludes several cash overhead expenses", "operating_cost_usd_ac": 345.0, "land_cost_usd_ac": 193.03, "overhead_usd_ac": 379.79, "nass_price_usd_bu": 3.52, "cpi_u": 255.657, "to_2021_dollars": 1.059896658413421}, {"year": 2021, "source": "ERS_Heartland", "cash_cost_usd_ac": null, "total_cost_usd_ac": 783.59, "operator_share": 1.0, "reported_price_usd_bu": 5.02, "sample_n": null, "geography": "ERS Heartland region; all production practices", "account": "Sector economic costs per planted acre; operating costs are not cash costs", "full_economic_account": true, "source_file": "ers_corn.csv", "published_cash_usd_bu": null, "cash_rounding_discrepancy": null, "cash_note": "Unavailable: operating category excludes several cash overhead expenses", "operating_cost_usd_ac": 366.08, "land_cost_usd_ac": 198.86, "overhead_usd_ac": 417.51, "nass_price_usd_bu": 5.96, "cpi_u": 270.97, "to_2021_dollars": 1.0}, {"year": 2019, "source": "FINBIN_county", "cash_cost_usd_ac": 470.64, "total_cost_usd_ac": 551.5, "operator_share": 0.9326000000000001, "reported_price_usd_bu": 3.6, "sample_n": 5.0, "geography": "Gage, Johnson, Lancaster, Pawnee participating farms", "account": "Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established", "full_economic_account": false, "source_file": "finbin_county_1008338.csv", "published_cash_usd_bu": null, "cash_rounding_discrepancy": null, "cash_note": "Direct plus overhead minus depreciation; conditional accounting cash margin; not whole-farm cash income", "operating_cost_usd_ac": null, "land_cost_usd_ac": null, "overhead_usd_ac": null, "nass_price_usd_bu": 3.52, "cpi_u": 255.657, "to_2021_dollars": 1.059896658413421}, {"year": 2019, "source": "FINBIN_state", "cash_cost_usd_ac": 550.1999999999999, "total_cost_usd_ac": 652.8599999999999, "operator_share": 0.9115000000000001, "reported_price_usd_bu": 3.68, "sample_n": 63.0, "geography": "Nebraska statewide participating farms", "account": "Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established", "full_economic_account": false, "source_file": "finbin_state_1008210.csv", "published_cash_usd_bu": null, "cash_rounding_discrepancy": null, "cash_note": "Direct plus overhead minus depreciation; conditional accounting cash margin; not whole-farm cash income", "operating_cost_usd_ac": null, "land_cost_usd_ac": null, "overhead_usd_ac": null, "nass_price_usd_bu": 3.52, "cpi_u": 255.657, "to_2021_dollars": 1.059896658413421}, {"year": 2021, "source": "FINBIN_state", "cash_cost_usd_ac": 613.5999999999999, "total_cost_usd_ac": 716.06, "operator_share": 0.9081999999999999, "reported_price_usd_bu": 5.43, "sample_n": 52.0, "geography": "Nebraska statewide participating farms", "account": "Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established", "full_economic_account": false, "source_file": "finbin_state_1008210.csv", "published_cash_usd_bu": null, "cash_rounding_discrepancy": null, "cash_note": "Direct plus overhead minus depreciation; conditional accounting cash margin; not whole-farm cash income", "operating_cost_usd_ac": null, "land_cost_usd_ac": null, "overhead_usd_ac": null, "nass_price_usd_bu": 5.96, "cpi_u": 270.97, "to_2021_dollars": 1.0}], "eligibility": [{"year": 2001, "eligible": false, "status": "matching_original_not_recovered", "original_recovered": false, "source_url": null, "file": null, "sha256": null, "budget_number": null, "pdf_page": null, "printed_page": null, "title": null, "assumed_yield_bu_ac": null}, {"year": 2003, "eligible": false, "status": "matching_original_not_recovered", "original_recovered": false, "source_url": null, "file": null, "sha256": null, "budget_number": null, "pdf_page": null, "printed_page": null, "title": null, "assumed_yield_bu_ac": null}, {"year": 2005, "eligible": false, "status": "matching_original_not_recovered", "original_recovered": false, "source_url": null, "file": null, "sha256": null, "budget_number": null, "pdf_page": null, "printed_page": null, "title": null, "assumed_yield_bu_ac": null}, {"year": 2007, "eligible": false, "status": "matching_original_not_recovered", "original_recovered": false, "source_url": null, "file": null, "sha256": null, "budget_number": null, "pdf_page": null, "printed_page": null, "title": null, "assumed_yield_bu_ac": null}, {"year": 2009, "eligible": false, "status": "original_recovered_selected_system_absent", "original_recovered": true, "source_url": "https://cap.unl.edu/sites/unl.edu.ianr.agecon.center-for-ag-profitability/files/media/file/Crop-Budgets-ec09-872.pdf", "file": "unl_2009.pdf", "sha256": "1c8b75dbfd4a0d4279a8cc5c063c8bad553b4b0ea3753ceeebe1df76d8532e80", "budget_number": null, "pdf_page": null, "printed_page": null, "title": null, "assumed_yield_bu_ac": null}, {"year": 2011, "eligible": false, "status": "original_recovered_selected_system_absent", "original_recovered": true, "source_url": "https://cap.unl.edu/sites/unl.edu.ianr.agecon.center-for-ag-profitability/files/media/file/Crop-Budgets-EC11-872.pdf", "file": "unl_2011.pdf", "sha256": "b8a2152dcc047ac3b2274d4353517f6ffb1f543bc5c93068b79cb9548e255ac9", "budget_number": null, "pdf_page": null, "printed_page": null, "title": null, "assumed_yield_bu_ac": null}, {"year": 2013, "eligible": false, "status": "original_recovered_selected_system_absent", "original_recovered": true, "source_url": "https://digitalcommons.unl.edu/cgi/viewcontent.cgi?article=5325&context=extensionhist", "file": "unl_2013.pdf", "sha256": "ffed1c52df62b67f7248ac74401b9ea85fd39ad4ec2730c1277998734f856994", "budget_number": null, "pdf_page": null, "printed_page": null, "title": null, "assumed_yield_bu_ac": null}, {"year": 2015, "eligible": false, "status": "original_recovered_selected_system_absent", "original_recovered": true, "source_url": "https://cap.unl.edu/sites/unl.edu.ianr.agecon.center-for-ag-profitability/files/media/file/2015-Crop-Budget-EC872.pdf", "file": "unl_2015.pdf", "sha256": "f1b374b5075e3e9ed08b42576466fef8fbd5afccebf45fd4e5a0b9c4f0c67445", "budget_number": null, "pdf_page": null, "printed_page": null, "title": null, "assumed_yield_bu_ac": null}, {"year": 2017, "eligible": false, "status": "original_recovered_selected_system_absent", "original_recovered": true, "source_url": "https://cap.unl.edu/sites/unl.edu.ianr.agecon.center-for-ag-profitability/files/media/file/2017-crop-budgets.pdf", "file": "unl_2017.pdf", "sha256": "8543fc37829cd7e5dd1d2f903578dad96ffc6831c17d2f61e0715e790d86d395", "budget_number": null, "pdf_page": null, "printed_page": null, "title": null, "assumed_yield_bu_ac": null}, {"year": 2019, "eligible": true, "status": "verified_matching_original", "original_recovered": true, "source_url": "https://cap.unl.edu/sites/unl.edu.ianr.agecon.center-for-ag-profitability/files/media/file/2019-nebraska-crop-budgets%20%281%29.pdf", "file": "unl_2019.pdf", "sha256": "6a0693e0c7f8c0f6bcee620595b45fa1214e342147fbd0de40df2e60eab5dd09", "budget_number": 18.0, "pdf_page": 36.0, "printed_page": 30.0, "title": "2019 Budget 18 Corn, Eastern Nebraska, Conventional Tillage, in Corn/Soybean Rotation, Dryland", "assumed_yield_bu_ac": 160.0}, {"year": 2021, "eligible": true, "status": "verified_matching_original", "original_recovered": true, "source_url": "https://cap.unl.edu/sites/unl.edu.ianr.agecon.center-for-ag-profitability/files/media/file/2021-all-nebraska-crop-budgets-updated-021521%20%282%29.pdf", "file": "unl_2021.pdf", "sha256": "6f8182a9f7cb98b806308a3c378d4e7c9a2ed78b974aad95f93bf9ea87b0e6b4", "budget_number": 18.0, "pdf_page": 30.0, "printed_page": 30.0, "title": "2021 Budget 18 Corn, Eastern Nebraska, Conventional Tillage, in Corn/Soybean Rotation, Dryland", "assumed_yield_bu_ac": 170.0}], "sensitivity": [{"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 144884.16, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 56643.57, "mean_return_usd_ac": -0.5804453550402492, "mean_return_2021usd_ac": -0.615212092198752, "total_return_usd": -506257.78753074334, "total_return_2021usd": -536580.9372996066, "mean_revenue_usd_ac": 480.11155464495965, "mean_cash_margin_usd_ac": 171.4085546449597, "breakeven_bu_ac": 160.6590909090909, "breakeven_Mg_ha": 10.084195956721867, "return_p05": -64.81320735844271, "return_median": 6.0076984049172495, "return_p95": 71.67889864342379, "mean_revenue_usd_ac_2021dollars": 508.86863243386534, "mean_cash_margin_usd_ac_2021dollars": 181.67535429166708, "return_p05_2021dollars": -68.69530190026958, "return_median_2021dollars": 6.367539464127432, "return_p95_2021dollars": 75.97222515091917}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 341933.4, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 253692.81, "mean_return_usd_ac": -85.40844535504023, "mean_return_2021usd_ac": -90.5241258320924, "total_return_usd": -74492267.37094796, "total_return_2021usd": -78954105.26410685, "mean_revenue_usd_ac": 480.11155464495965, "mean_cash_margin_usd_ac": 116.93155464495952, "breakeven_bu_ac": 189.01069518716577, "breakeven_Mg_ha": 11.863759949084548, "return_p05": -149.64120735844276, "return_median": -78.82030159508278, "return_p95": -13.14910135657624, "mean_revenue_usd_ac_2021dollars": 508.86863243386534, "mean_cash_margin_usd_ac_2021dollars": 123.93536403127894, "return_p05_2021dollars": -158.60421564016332, "return_median_2021dollars": -83.54137427576629, "return_p95_2021dollars": -13.936688588974539}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 352585.44, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264344.85, "mean_return_usd_ac": -170.23644535504042, "mean_return_2021usd_ac": -180.43303957198628, "total_return_usd": -148478276.95436534, "total_return_2021usd": -157371629.59091428, "mean_revenue_usd_ac": 480.11155464495965, "mean_cash_margin_usd_ac": 62.45455464495968, "breakeven_bu_ac": 217.36229946524065, "breakeven_Mg_ha": 13.64332394144723, "return_p05": -234.46920735844276, "return_median": -163.64830159508276, "return_p95": -97.9771013565762, "mean_revenue_usd_ac_2021dollars": 508.86863243386534, "mean_cash_margin_usd_ac_2021dollars": 66.19537377089117, "return_p05_2021dollars": -248.513129380057, "return_median_2021dollars": -173.45028801565994, "return_p95_2021dollars": -103.84560232886818}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 16637.399999999998, "quartile_ha": 88240.59, "both_ha": 16637.399999999998, "disagree_ha": 71603.19, "mean_return_usd_ac": 84.14512311171734, "mean_return_2021usd_ac": 89.18513480789514, "total_return_usd": 73390412.18632223, "total_return_2021usd": 77786252.63586654, "mean_revenue_usd_ac": 564.8371231117172, "mean_cash_margin_usd_ac": 256.1341231117173, "breakeven_bu_ac": 136.56022727272725, "breakeven_Mg_ha": 8.571566563213585, "return_p05": 8.577167813596834, "return_median": 91.89588047637324, "return_p95": 169.15611605108683, "mean_revenue_usd_ac_2021dollars": 598.6689793339592, "mean_cash_margin_usd_ac_2021dollars": 271.475701191761, "return_p05_2021dollars": 9.090911504282433, "return_median_2021dollars": 97.40013663886714, "return_p95_2021dollars": 179.28800215273978}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 144884.16, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 56643.57, "mean_return_usd_ac": -0.6828768882826706, "mean_return_2021usd_ac": -0.7237789319985576, "total_return_usd": -595597.3970950135, "total_return_2021usd": -631271.6909407362, "mean_revenue_usd_ac": 564.8371231117172, "mean_cash_margin_usd_ac": 201.6571231117172, "breakeven_bu_ac": 160.6590909090909, "breakeven_Mg_ha": 10.084195956721867, "return_p05": -76.2508321864032, "return_median": 7.067880476373205, "return_p95": 84.32811605108681, "mean_revenue_usd_ac_2021dollars": 598.6689793339592, "mean_cash_margin_usd_ac_2021dollars": 213.73571093137292, "return_p05_2021dollars": -80.81800223561129, "return_median_2021dollars": 7.491222898973418, "return_p95_2021dollars": 89.37908841284609}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 335572.29, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 247331.7, "mean_return_usd_ac": -85.5108768882827, "mean_return_2021usd_ac": -90.63269267189229, "total_return_usd": -74581606.98051226, "total_return_2021usd": -79048796.01774803, "mean_revenue_usd_ac": 564.8371231117172, "mean_cash_margin_usd_ac": 147.18012311171736, "breakeven_bu_ac": 184.7579545454545, "breakeven_Mg_ha": 11.596825350230146, "return_p05": -161.07883218640316, "return_median": -77.76011952362677, "return_p95": -0.4998839489131662, "mean_revenue_usd_ac_2021dollars": 598.6689793339592, "mean_cash_margin_usd_ac_2021dollars": 155.99572067098515, "return_p05_2021dollars": -170.72691597550494, "return_median_2021dollars": -82.41769084092024, "return_p95_2021dollars": -0.5298253270475701}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 14563.53, "quartile_ha": 88240.59, "both_ha": 14563.53, "disagree_ha": 73677.06, "mean_return_usd_ac": 168.87069157847498, "mean_return_2021usd_ac": 178.98548170798907, "total_return_usd": 147287082.16017523, "total_return_2021usd": 156109086.20903274, "mean_revenue_usd_ac": 649.5626915784751, "mean_cash_margin_usd_ac": 340.859691578475, "breakeven_bu_ac": 118.748023715415, "breakeven_Mg_ha": 7.453536141924857, "return_p05": 81.96754298563627, "return_median": 177.78406254782914, "return_p95": 266.63333345874975, "mean_revenue_usd_ac_2021dollars": 688.4693262340534, "mean_cash_margin_usd_ac_2021dollars": 361.276048091855, "return_p05_2021dollars": 86.87712490883433, "return_median_2021dollars": 188.43273381360675, "return_p95_2021dollars": 282.6037791545603}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 18032.4, "quartile_ha": 88240.59, "both_ha": 18032.4, "disagree_ha": 70208.19, "mean_return_usd_ac": 84.04269157847477, "mean_return_2021usd_ac": 89.07656796809518, "total_return_usd": 73301072.57675783, "total_return_2021usd": 77691561.88222529, "mean_revenue_usd_ac": 649.5626915784751, "mean_cash_margin_usd_ac": 286.38269157847475, "breakeven_bu_ac": 139.70355731225297, "breakeven_Mg_ha": 8.768866049323362, "return_p05": -2.8604570143637584, "return_median": 92.9560625478291, "return_p95": 181.80533345874971, "mean_revenue_usd_ac_2021dollars": 688.4693262340534, "mean_cash_margin_usd_ac_2021dollars": 303.5360578314668, "return_p05_2021dollars": -3.031788831059379, "return_median_2021dollars": 98.52382007371303, "return_p95_2021dollars": 192.69486541466657}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 144884.16, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 56643.57, "mean_return_usd_ac": -0.7853084215250977, "mean_return_2021usd_ac": -0.8323457717983694, "total_return_usd": -684937.0066592887, "total_return_2021usd": -725962.4445818712, "mean_revenue_usd_ac": 649.5626915784751, "mean_cash_margin_usd_ac": 231.90569157847483, "breakeven_bu_ac": 160.6590909090909, "breakeven_Mg_ha": 10.084195956721867, "return_p05": -87.68845701436373, "return_median": 8.128062547829131, "return_p95": 96.97733345874975, "mean_revenue_usd_ac_2021dollars": 688.4693262340534, "mean_cash_margin_usd_ac_2021dollars": 245.7960675710789, "return_p05_2021dollars": -92.94070257095304, "return_median_2021dollars": 8.614906333819373, "return_p95_2021dollars": 102.78595167477292}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 351499.41, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 263258.82, "mean_return_usd_ac": -135.95994535504022, "mean_return_2021usd_ac": -144.10349175987847, "total_return_usd": -118582706.41767916, "total_return_2021usd": -125685414.27771787, "mean_revenue_usd_ac": 480.11155464495965, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 205.90625, "breakeven_Mg_ha": 12.924254469289222, "return_p05": -200.19270735844268, "return_median": -129.3718015950827, "return_p95": -63.70060135657616, "mean_revenue_usd_ac_2021dollars": 508.86863243386534, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -212.1835815679493, "return_median_2021dollars": -137.12074020355226, "return_p95_2021dollars": -67.5160545167605}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 352962.18, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264721.59, "mean_return_usd_ac": -244.6784453550403, "mean_return_2021usd_ac": -259.33386661759806, "total_return_usd": -213405736.34759325, "total_return_2021usd": -226188026.84106964, "mean_revenue_usd_ac": 480.11155464495965, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 242.2426470588235, "breakeven_Mg_ha": 15.20500525798732, "return_p05": -308.9112073584427, "return_median": -238.0903015950828, "return_p95": -172.41910135657622, "mean_revenue_usd_ac_2021dollars": 508.86863243386534, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -327.41395642566886, "return_median_2021dollars": -252.35111506127186, "return_p95_2021dollars": -182.7464293744801}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 352962.18, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264721.59, "mean_return_usd_ac": -353.3969453550406, "mean_return_2021usd_ac": -374.5642414753179, "total_return_usd": -308228766.2775075, "total_return_2021usd": -326690639.4044216, "mean_revenue_usd_ac": 480.11155464495965, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 278.579044117647, "breakeven_Mg_ha": 17.485756046685417, "return_p05": -417.62970735844266, "return_median": -346.80880159508274, "return_p95": -281.13760135657617, "mean_revenue_usd_ac_2021dollars": 508.86863243386534, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -442.6443312833883, "return_median_2021dollars": -367.58148991899134, "return_p95_2021dollars": -297.9768042321996}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 305278.11, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 217037.52, "mean_return_usd_ac": -51.23437688828251, "mean_return_2021usd_ac": -54.303144859784446, "total_return_usd": -44686036.443826094, "total_return_2021usd": -47362580.70455163, "mean_revenue_usd_ac": 564.8371231117172, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 175.02031249999996, "breakeven_Mg_ha": 10.985616298895838, "return_p05": -126.80233218640312, "return_median": -43.48361952362672, "return_p95": 33.77661605108689, "mean_revenue_usd_ac_2021dollars": 598.6689793339592, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -134.39736816339726, "return_median_2021dollars": -46.08814302881256, "return_p95_2021dollars": 35.799722485060116}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 351499.41, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 263258.82, "mean_return_usd_ac": -159.95287688828273, "mean_return_2021usd_ac": -169.5335197175042, "total_return_usd": -139509066.3737403, "total_return_2021usd": -147865193.2679035, "mean_revenue_usd_ac": 564.8371231117172, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 205.90625, "breakeven_Mg_ha": 12.924254469289224, "return_p05": -235.5208321864032, "return_median": -152.20211952362678, "return_p95": -74.94188394891317, "mean_revenue_usd_ac_2021dollars": 598.6689793339592, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -249.62774302111686, "return_median_2021dollars": -161.31851788653213, "return_p95_2021dollars": -79.43065237265947}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 352954.44, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264713.85, "mean_return_usd_ac": -268.6713768882827, "mean_return_2021usd_ac": -284.7638945752237, "total_return_usd": -234332096.30365425, "total_return_2021usd": -248367805.8312551, "mean_revenue_usd_ac": 564.8371231117172, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 236.7921875, "breakeven_Mg_ha": 14.862892639682606, "return_p05": -344.23933218640315, "return_median": -260.9206195236267, "return_p95": -183.66038394891316, "mean_revenue_usd_ac_2021dollars": 598.6689793339592, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -364.8581178788363, "return_median_2021dollars": -276.5488927442516, "return_p95_2021dollars": -194.66102723037898}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 49162.86, "quartile_ha": 88240.59, "both_ha": 49162.86, "disagree_ha": 39077.73, "mean_return_usd_ac": 33.49119157847499, "mean_return_2021usd_ac": 35.49720204030935, "total_return_usd": 29210633.5300268, "total_return_2021usd": 30960252.868614435, "mean_revenue_usd_ac": 649.5626915784751, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 152.1915760869565, "breakeven_Mg_ha": 9.552709825126817, "return_p05": -53.41195701436368, "return_median": 42.40456254782919, "return_p95": 131.25383345874982, "mean_revenue_usd_ac_2021dollars": 688.4693262340534, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -56.61115475884535, "return_median_2021dollars": 44.94445414592706, "return_p95_2021dollars": 139.11549948688062}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 321645.78, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 233405.19, "mean_return_usd_ac": -75.22730842152502, "mean_return_2021usd_ac": -79.73317281741018, "total_return_usd": -65612396.399887234, "total_return_2021usd": -69542359.69473726, "mean_revenue_usd_ac": 649.5626915784751, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 179.04891304347825, "breakeven_Mg_ha": 11.23848214720802, "return_p05": -162.13045701436374, "return_median": -66.31393745217088, "return_p95": 22.53533345874976, "mean_revenue_usd_ac_2021dollars": 688.4693262340534, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -171.84152961656494, "return_median_2021dollars": -70.28592071179253, "return_p95_2021dollars": 23.885124629161034}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 351499.41, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 263258.82, "mean_return_usd_ac": -183.94580842152516, "mean_return_2021usd_ac": -194.9635476751298, "total_return_usd": -160435426.32980132, "total_return_2021usd": -170044972.258089, "mean_revenue_usd_ac": 649.5626915784751, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 205.90625, "breakeven_Mg_ha": 12.924254469289222, "return_p05": -270.8489570143637, "return_median": -175.03243745217085, "return_p95": -86.18316654125019, "mean_revenue_usd_ac_2021dollars": 688.4693262340534, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -287.0719044742844, "return_median_2021dollars": -185.516295569512, "return_p95_2021dollars": -91.34525022855843}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 146321.72999999998, "loss_ha": 104890.14, "quartile_ha": 43003.08, "both_ha": 43003.08, "disagree_ha": 61887.06, "mean_return_usd_ac": -26.108411511896623, "mean_return_2021usd_ac": -27.672218117941725, "total_return_usd": -9439988.823984597, "total_return_2021usd": -10005412.610001314, "mean_revenue_usd_ac": 442.66658848810295, "mean_cash_margin_usd_ac": 42.62258848810336, "breakeven_bu_ac": 167.99928840192615, "breakeven_Mg_ha": 10.544923012128107, "return_p05": -242.07713905616475, "return_median": -16.78363342918658, "return_p95": 44.38919386482616, "mean_revenue_usd_ac_2021dollars": 469.1808379298093, "mean_cash_margin_usd_ac_2021dollars": 45.1755391114711, "return_p05_2021dollars": -256.57675076391007, "return_median_2021dollars": -17.788916987630643, "return_p95_2021dollars": 47.04795824699478}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 146321.72999999998, "loss_ha": 144897.3, "quartile_ha": 43003.08, "both_ha": 43003.08, "disagree_ha": 101894.22, "mean_return_usd_ac": -108.83341151189664, "mean_return_2021usd_ac": -115.352169185192, "total_return_usd": -39350773.51911201, "total_return_2021usd": -41707753.35889016, "mean_revenue_usd_ac": 442.66658848810295, "mean_cash_margin_usd_ac": -27.97341151189663, "breakeven_bu_ac": 197.6462216493249, "breakeven_Mg_ha": 12.405791778974246, "return_p05": -324.8021390561648, "return_median": -99.5086334291866, "return_p95": -38.33580613517386, "mean_revenue_usd_ac_2021dollars": 469.1808379298093, "mean_cash_margin_usd_ac_2021dollars": -29.648925385882762, "return_p05_2021dollars": -344.25670183116034, "return_median_2021dollars": -105.46886805488093, "return_p95_2021dollars": -40.631992820255505}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 146321.72999999998, "loss_ha": 146297.79, "quartile_ha": 43003.08, "both_ha": 43003.08, "disagree_ha": 103294.71, "mean_return_usd_ac": -191.55841151189648, "mean_return_2021usd_ac": -203.0321202524421, "total_return_usd": -69261558.21423936, "total_return_2021usd": -73410094.10777894, "mean_revenue_usd_ac": 442.66658848810295, "mean_cash_margin_usd_ac": -98.56941151189666, "breakeven_bu_ac": 227.2931548967236, "breakeven_Mg_ha": 14.26666054582038, "return_p05": -407.5271390561647, "return_median": -182.2336334291865, "return_p95": -121.06080613517378, "mean_revenue_usd_ac_2021dollars": 469.1808379298093, "mean_cash_margin_usd_ac_2021dollars": -104.47338988323666, "return_p05_2021dollars": -431.93665289841056, "return_median_2021dollars": -193.14881912213107, "return_p95_2021dollars": -128.31194388750566}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 146321.72999999998, "loss_ha": 11530.35, "quartile_ha": 43003.08, "both_ha": 11530.35, "disagree_ha": 31472.73, "mean_return_usd_ac": 52.00922175070989, "mean_return_2021usd_ac": 55.12440034026003, "total_return_usd": 18804915.49043966, "total_return_2021usd": 19931267.090063777, "mean_revenue_usd_ac": 520.7842217507094, "mean_cash_margin_usd_ac": 120.74022175070976, "breakeven_bu_ac": 142.79939514163723, "breakeven_Mg_ha": 8.963184560308893, "return_p05": -202.07163418372323, "return_median": 62.97954890683934, "return_p95": 134.94758101744256, "mean_revenue_usd_ac_2021dollars": 551.977456388011, "mean_cash_margin_usd_ac_2021dollars": 127.97215756967275, "return_p05_2021dollars": -214.17504983146748, "return_median_2021dollars": 66.75181343474364, "return_p95_2021dollars": 143.03049018136178}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 146321.72999999998, "loss_ha": 104890.14, "quartile_ha": 43003.08, "both_ha": 43003.08, "disagree_ha": 61887.06, "mean_return_usd_ac": -30.71577824929016, "mean_return_2021usd_ac": -32.55555072699028, "total_return_usd": -11105869.204687769, "total_return_2021usd": -11771073.658825085, "mean_revenue_usd_ac": 520.7842217507094, "mean_cash_margin_usd_ac": 50.14422175070987, "breakeven_bu_ac": 167.99928840192618, "breakeven_Mg_ha": 10.54492301212811, "return_p05": -284.79663418372326, "return_median": -19.74545109316068, "return_p95": 52.22258101744254, "mean_revenue_usd_ac_2021dollars": 551.977456388011, "mean_cash_margin_usd_ac_2021dollars": 53.14769307231897, "return_p05_2021dollars": -301.8550008987178, "return_median_2021dollars": -20.928137632506637, "return_p95_2021dollars": 55.350539114111506}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 146321.72999999998, "loss_ha": 143818.47, "quartile_ha": 43003.08, "both_ha": 43003.08, "disagree_ha": 100815.39, "mean_return_usd_ac": -113.44077824929003, "mean_return_2021usd_ac": -120.23550179424042, "total_return_usd": -41016653.899815135, "total_return_2021usd": -43473414.40771388, "mean_revenue_usd_ac": 520.7842217507094, "mean_cash_margin_usd_ac": -20.45177824929015, "breakeven_bu_ac": 193.19918166221507, "breakeven_Mg_ha": 12.126661463947324, "return_p05": -367.5216341837232, "return_median": -102.4704510931606, "return_p95": -30.50241898255737, "mean_revenue_usd_ac_2021dollars": 551.977456388011, "mean_cash_margin_usd_ac_2021dollars": -21.676771425034918, "return_p05_2021dollars": -389.534951965968, "return_median_2021dollars": -108.60808869975682, "return_p95_2021dollars": -32.32941195313866}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 146321.72999999998, "loss_ha": 8008.65, "quartile_ha": 43003.08, "both_ha": 8008.65, "disagree_ha": 34994.43, "mean_return_usd_ac": 130.1268550133163, "mean_return_2021usd_ac": 137.92101879846166, "total_return_usd": 47049819.80486388, "total_return_2021usd": 49867946.79012882, "mean_revenue_usd_ac": 598.9018550133161, "mean_cash_margin_usd_ac": 198.85785501331628, "breakeven_bu_ac": 124.17338707968456, "breakeven_Mg_ha": 7.794073530703385, "return_p05": -162.06612931128177, "return_median": 142.74273124286515, "return_p95": 225.5059681700588, "mean_revenue_usd_ac_2021dollars": 634.7740748462129, "mean_cash_margin_usd_ac_2021dollars": 210.7687760278745, "return_p05_2021dollars": -171.77334889902494, "return_median_2021dollars": 151.2925438571178, "return_p95_2021dollars": 239.0130221157286}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 146321.72999999998, "loss_ha": 14389.47, "quartile_ha": 43003.08, "both_ha": 14389.47, "disagree_ha": 28613.61, "mean_return_usd_ac": 47.40185501331628, "mean_return_2021usd_ac": 50.2410677312114, "total_return_usd": 17139035.109736465, "total_return_2021usd": 18165606.04123998, "mean_revenue_usd_ac": 598.9018550133161, "mean_cash_margin_usd_ac": 128.26185501331642, "breakeven_bu_ac": 146.08633774080536, "breakeven_Mg_ha": 9.169498271415748, "return_p05": -244.7911293112818, "return_median": 60.017731242865125, "return_p95": 142.7809681700588, "mean_revenue_usd_ac_2021dollars": 634.7740748462129, "mean_cash_margin_usd_ac_2021dollars": 135.94431153052076, "return_p05_2021dollars": -259.4532999662752, "return_median_2021dollars": 63.61259278986753, "return_p95_2021dollars": 151.33307104847836}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 146321.72999999998, "loss_ha": 104890.14, "quartile_ha": 43003.08, "both_ha": 43003.08, "disagree_ha": 61887.06, "mean_return_usd_ac": -35.32314498668364, "mean_return_2021usd_ac": -37.43888333603877, "total_return_usd": -12771749.585390914, "total_return_2021usd": -13536734.707648829, "mean_revenue_usd_ac": 598.9018550133161, "mean_cash_margin_usd_ac": 57.66585501331627, "breakeven_bu_ac": 167.99928840192615, "breakeven_Mg_ha": 10.544923012128107, "return_p05": -327.5161293112817, "return_median": -22.707268757134784, "return_p95": 60.0559681700589, "mean_revenue_usd_ac_2021dollars": 634.7740748462129, "mean_cash_margin_usd_ac_2021dollars": 61.119847033166735, "return_p05_2021dollars": -347.13325103352537, "return_median_2021dollars": -24.067358277382635, "return_p95_2021dollars": 63.6531199812282}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 350994.51, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 262753.92, "mean_return_usd_ac": -117.30931794111918, "mean_return_2021usd_ac": -124.3357540865498, "total_return_usd": -102315842.89875728, "total_return_2021usd": -108444219.9911454, "mean_revenue_usd_ac": 437.62168205888094, "mean_cash_margin_usd_ac": -30.048317941119095, "breakeven_bu_ac": 203.4795292474941, "breakeven_Mg_ha": 12.771934874661614, "return_p05": -175.85748050722046, "return_median": -111.30422490391786, "return_p95": -51.44492588651914, "mean_revenue_usd_ac_2021dollars": 463.8337584634685, "mean_cash_margin_usd_ac_2021dollars": -31.848111776736175, "return_p05_2021dollars": -186.3907559466063, "return_median_2021dollars": -117.97097604295841, "return_p95_2021dollars": -54.526305039447735}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 352960.11, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264719.52, "mean_return_usd_ac": -215.23831794111905, "mean_return_2021usd_ac": -228.13037394831755, "total_return_usd": -187728394.56205776, "total_return_2021usd": -198972698.0856413, "mean_revenue_usd_ac": 437.62168205888094, "mean_cash_margin_usd_ac": -112.5783179411192, "breakeven_bu_ac": 239.3876814676401, "breakeven_Mg_ha": 15.025805734896018, "return_p05": -273.78648050722046, "return_median": -209.23322490391783, "return_p95": -149.37392588651912, "mean_revenue_usd_ac_2021dollars": 463.8337584634685, "mean_cash_margin_usd_ac_2021dollars": -119.32138299559593, "return_p05_2021dollars": -290.1853758083742, "return_median_2021dollars": -221.7655959047263, "return_p95_2021dollars": -158.32092490121562}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 352962.18, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264721.59, "mean_return_usd_ac": -313.167317941119, "mean_return_2021usd_ac": -331.9249938100854, "total_return_usd": -273140946.2253584, "total_return_2021usd": -289501176.1801373, "mean_revenue_usd_ac": 437.62168205888094, "mean_cash_margin_usd_ac": -195.108317941119, "breakeven_bu_ac": 275.2958336877861, "breakeven_Mg_ha": 17.279676595130418, "return_p05": -371.7154805072204, "return_median": -307.16222490391783, "return_p95": -247.3029258865191, "mean_revenue_usd_ac_2021dollars": 463.8337584634685, "mean_cash_margin_usd_ac_2021dollars": -206.79465421445536, "return_p05_2021dollars": -393.97999567014205, "return_median_2021dollars": -325.5602157664942, "return_p95_2021dollars": -262.1155447629835}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 293261.76, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 205021.17, "mean_return_usd_ac": -40.081962283669554, "mean_return_2021usd_ac": -42.48273788711413, "total_return_usd": -34959028.21759023, "total_return_2021usd": -37052957.18920438, "mean_revenue_usd_ac": 514.8490377163306, "mean_cash_margin_usd_ac": 47.179037716330456, "breakeven_bu_ac": 172.95759986036998, "breakeven_Mg_ha": 10.856144643462372, "return_p05": -108.9621535379064, "return_median": -33.017146945785726, "return_p95": 37.40555778056574, "mean_revenue_usd_ac_2021dollars": 545.6867746629042, "mean_cash_margin_usd_ac_2021dollars": 50.00490442269941, "return_p05_2021dollars": -115.48862242835712, "return_median_2021dollars": -34.99476371818318, "return_p95_2021dollars": 39.64602569771178}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 350994.51, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 262753.92, "mean_return_usd_ac": -138.0109622836695, "mean_return_2021usd_ac": -146.277357748882, "total_return_usd": -120371579.8808908, "total_return_2021usd": -127581435.28370036, "mean_revenue_usd_ac": 514.8490377163306, "mean_cash_margin_usd_ac": -35.35096228366956, "breakeven_bu_ac": 203.4795292474941, "breakeven_Mg_ha": 12.771934874661614, "return_p05": -206.8911535379064, "return_median": -130.9461469457857, "return_p95": -60.52344221943423, "mean_revenue_usd_ac_2021dollars": 545.6867746629042, "mean_cash_margin_usd_ac_2021dollars": -37.46836679616025, "return_p05_2021dollars": -219.28324229012503, "return_median_2021dollars": -138.78938357995108, "return_p95_2021dollars": -64.1485941640561}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 352951.11, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264710.52, "mean_return_usd_ac": -235.9399622836693, "mean_return_2021usd_ac": -250.0719776106497, "total_return_usd": -205784131.54419127, "total_return_2021usd": -218109913.3781962, "mean_revenue_usd_ac": 514.8490377163306, "mean_cash_margin_usd_ac": -117.88096228366966, "breakeven_bu_ac": 234.00145863461825, "breakeven_Mg_ha": 14.687725105860856, "return_p05": -304.8201535379063, "return_median": -228.87514694578567, "return_p95": -158.4524422194342, "mean_revenue_usd_ac_2021dollars": 545.6867746629042, "mean_cash_margin_usd_ac_2021dollars": -124.94163801501999, "return_p05_2021dollars": -323.0778621518929, "return_median_2021dollars": -242.58400344171895, "return_p95_2021dollars": -167.943214025824}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 39437.55, "quartile_ha": 88240.59, "both_ha": 39437.55, "disagree_ha": 48803.04, "mean_return_usd_ac": 37.14539337377996, "mean_return_2021usd_ac": 39.37027831232141, "total_return_usd": 32397786.46357673, "total_return_2021usd": 34338305.612736546, "mean_revenue_usd_ac": 592.0763933737803, "mean_cash_margin_usd_ac": 124.40639337377996, "breakeven_bu_ac": 150.39791292206084, "breakeven_Mg_ha": 9.4401257769238, "return_p05": -42.066826568592425, "return_median": 45.26993101234632, "return_p95": 126.2560414476505, "mean_revenue_usd_ac_2021dollars": 627.5397908623399, "mean_cash_margin_usd_ac_2021dollars": 131.85792062213494, "return_p05_2021dollars": -44.58648891010803, "return_median_2021dollars": 47.98144860659196, "return_p95_2021dollars": 133.81835643487116}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 314010.45, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 225769.86, "mean_return_usd_ac": -60.78360662622005, "mean_return_2021usd_ac": -64.42434154944651, "total_return_usd": -53014765.19972391, "total_return_2021usd": -56190172.48175949, "mean_revenue_usd_ac": 592.0763933737803, "mean_cash_margin_usd_ac": 41.876393373779926, "breakeven_bu_ac": 176.93872108477746, "breakeven_Mg_ha": 11.106030325792709, "return_p05": -139.9958265685924, "return_median": -52.65906898765365, "return_p95": 28.327041447650533, "mean_revenue_usd_ac_2021dollars": 627.5397908623399, "mean_cash_margin_usd_ac_2021dollars": 44.38464940327527, "return_p05_2021dollars": -148.38110877187592, "return_median_2021dollars": -55.81317125517591, "return_p95_2021dollars": 30.023736573103278}, {"year": 2019, "scenario": "M1_fixed", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 350994.51, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 262753.92, "mean_return_usd_ac": -158.71260662622, "mean_return_2021usd_ac": -168.21896141121437, "total_return_usd": -138427316.8630245, "total_return_2021usd": -146718650.57625547, "mean_revenue_usd_ac": 592.0763933737803, "mean_cash_margin_usd_ac": -40.65360662621999, "breakeven_bu_ac": 203.4795292474941, "breakeven_Mg_ha": 12.771934874661614, "return_p05": -237.9248265685924, "return_median": -150.58806898765363, "return_p95": -69.60195855234944, "mean_revenue_usd_ac_2021dollars": 627.5397908623399, "mean_cash_margin_usd_ac_2021dollars": -43.08862181558428, "return_p05_2021dollars": -252.17572863364384, "return_median_2021dollars": -159.60779111694382, "return_p95_2021dollars": -73.7708832886646}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 235025.01, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 146784.41999999998, "mean_return_usd_ac": -18.016102612720815, "mean_return_2021usd_ac": -19.0952069568561, "total_return_usd": -15713438.258129282, "total_return_2021usd": -16654620.701976834, "mean_revenue_usd_ac": 462.67589738727895, "mean_cash_margin_usd_ac": 153.97289738727926, "breakeven_bu_ac": 160.6590909090909, "breakeven_Mg_ha": 10.084195956721867, "return_p05": -79.91620810099069, "return_median": -11.667225228198362, "return_p95": 51.619075227912674, "mean_revenue_usd_ac_2021dollars": 490.38863756920784, "mean_cash_margin_usd_ac_2021dollars": 163.19535942700986, "return_p05_2021dollars": -84.7029219193116, "return_median_2021dollars": -12.366053032324208, "return_p95_2021dollars": 54.71088534445565}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 348091.02, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 259850.43, "mean_return_usd_ac": -102.84410261272082, "mean_return_2021usd_ac": -109.00412069674978, "total_return_usd": -89699447.84154652, "total_return_2021usd": -95072145.02878413, "mean_revenue_usd_ac": 462.67589738727895, "mean_cash_margin_usd_ac": 99.49589738727916, "breakeven_bu_ac": 189.01069518716577, "breakeven_Mg_ha": 11.863759949084548, "return_p05": -164.7442081009907, "return_median": -96.4952252281984, "return_p95": -33.20892477208736, "mean_revenue_usd_ac_2021dollars": 490.38863756920784, "mean_cash_margin_usd_ac_2021dollars": 105.45536916662181, "return_p05_2021dollars": -174.6118356592053, "return_median_2021dollars": -102.27496677221792, "return_p95_2021dollars": -35.19802839543807}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 352863.45, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264622.86, "mean_return_usd_ac": -187.6721026127209, "mean_return_2021usd_ac": -198.91303443664356, "total_return_usd": -163685457.4249638, "total_return_2021usd": -173489669.35559145, "mean_revenue_usd_ac": 462.67589738727895, "mean_cash_margin_usd_ac": 45.018897387279175, "breakeven_bu_ac": 217.36229946524065, "breakeven_Mg_ha": 13.64332394144723, "return_p05": -249.57220810099068, "return_median": -181.3232252281984, "return_p95": -118.03692477208732, "mean_revenue_usd_ac_2021dollars": 490.38863756920784, "mean_cash_margin_usd_ac_2021dollars": 47.71537890623389, "return_p05_2021dollars": -264.520749399099, "return_median_2021dollars": -192.1838805121116, "return_p95_2021dollars": -125.1069421353317}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 19457.64, "quartile_ha": 88240.59, "both_ha": 19457.64, "disagree_ha": 68782.95, "mean_return_usd_ac": 63.63258516150492, "mean_return_2021usd_ac": 67.4439643788865, "total_return_usd": 55499611.6326769, "total_return_2021usd": 58823852.91271688, "mean_revenue_usd_ac": 544.3245851615051, "mean_cash_margin_usd_ac": 235.621585161505, "breakeven_bu_ac": 136.56022727272725, "breakeven_Mg_ha": 8.571566563213585, "return_p05": -9.191068354106708, "return_median": 71.10185267270782, "return_p95": 145.55632379754428, "mean_revenue_usd_ac_2021dollars": 576.9278089049509, "mean_cash_margin_usd_ac_2021dollars": 249.73453076275248, "return_p05_2021dollars": -9.741582635767042, "return_median_2021dollars": 75.36061605480639, "return_p95_2021dollars": 154.2746612039591}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 235025.01, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 146784.41999999998, "mean_return_usd_ac": -21.19541483849512, "mean_return_2021usd_ac": -22.464949361007218, "total_return_usd": -18486397.950740363, "total_return_2021usd": -19593671.414090425, "mean_revenue_usd_ac": 544.3245851615051, "mean_cash_margin_usd_ac": 181.1445851615049, "breakeven_bu_ac": 160.6590909090909, "breakeven_Mg_ha": 10.084195956721867, "return_p05": -94.01906835410674, "return_median": -13.72614732729221, "return_p95": 60.72832379754425, "mean_revenue_usd_ac_2021dollars": 576.9278089049509, "mean_cash_margin_usd_ac_2021dollars": 191.9945405023644, "return_p05_2021dollars": -99.65049637566075, "return_median_2021dollars": -14.548297685087324, "return_p95_2021dollars": 64.3657474640654}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 344809.26, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 256568.67, "mean_return_usd_ac": -106.02341483849506, "mean_return_2021usd_ac": -112.37386310090083, "total_return_usd": -92472407.53415754, "total_return_2021usd": -98011195.74089764, "mean_revenue_usd_ac": 544.3245851615051, "mean_cash_margin_usd_ac": 126.66758516150496, "breakeven_bu_ac": 184.7579545454545, "breakeven_Mg_ha": 11.596825350230146, "return_p05": -178.8470683541067, "return_median": -98.55414732729218, "return_p95": -24.09967620245573, "mean_revenue_usd_ac_2021dollars": 576.9278089049509, "mean_cash_margin_usd_ac_2021dollars": 134.25455024197655, "return_p05_2021dollars": -189.5594101155544, "return_median_2021dollars": -104.45721142498098, "return_p95_2021dollars": -25.543166275828273}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 14800.95, "quartile_ha": 88240.59, "both_ha": 14800.95, "disagree_ha": 73439.64, "mean_return_usd_ac": 145.28127293573073, "mean_return_2021usd_ac": 153.9831357146292, "total_return_usd": 126712661.52348313, "total_return_2021usd": 134302326.52741063, "mean_revenue_usd_ac": 625.9732729357302, "mean_cash_margin_usd_ac": 317.2702729357304, "breakeven_bu_ac": 118.748023715415, "breakeven_Mg_ha": 7.453536141924857, "return_p05": 61.534071392777214, "return_median": 153.87093057361392, "return_p95": 239.4935723671759, "mean_revenue_usd_ac_2021dollars": 663.4669802406928, "mean_cash_margin_usd_ac_2021dollars": 336.2737020984947, "return_p05_2021dollars": 65.21975664777746, "return_median_2021dollars": 163.0872851419369, "return_p95_2021dollars": 253.83843706346255}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 23368.41, "quartile_ha": 88240.59, "both_ha": 23368.41, "disagree_ha": 64872.18, "mean_return_usd_ac": 60.45327293573055, "mean_return_2021usd_ac": 64.07422197473531, "total_return_usd": 52726651.94006576, "total_return_2021usd": 55884802.20060322, "mean_revenue_usd_ac": 625.9732729357302, "mean_cash_margin_usd_ac": 262.79327293573044, "breakeven_bu_ac": 139.70355731225297, "breakeven_Mg_ha": 8.768866049323362, "return_p05": -23.293928607222817, "return_median": 69.04293057361389, "return_p95": 154.66557236717586, "mean_revenue_usd_ac_2021dollars": 663.4669802406928, "mean_cash_margin_usd_ac_2021dollars": 278.5337118381068, "return_p05_2021dollars": -24.68915709211626, "return_median_2021dollars": 73.17837140204318, "return_p95_2021dollars": 163.92952332356884}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "UNL", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 235025.01, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 146784.41999999998, "mean_return_usd_ac": -24.37472706426937, "mean_return_2021usd_ac": -25.834691765158283, "total_return_usd": -21259357.6433514, "total_return_2021usd": -22532722.126203973, "mean_revenue_usd_ac": 625.9732729357302, "mean_cash_margin_usd_ac": 208.31627293573075, "breakeven_bu_ac": 160.6590909090909, "breakeven_Mg_ha": 10.084195956721867, "return_p05": -108.12192860722278, "return_median": -15.785069426386087, "return_p95": 69.83757236717588, "mean_revenue_usd_ac_2021dollars": 663.4669802406928, "mean_cash_margin_usd_ac_2021dollars": 220.7937215777192, "return_p05_2021dollars": -114.59807083200991, "return_median_2021dollars": -16.730542337850473, "return_p95_2021dollars": 74.02060958367518}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 352382.58, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264141.99, "mean_return_usd_ac": -153.39560261272078, "mean_return_2021usd_ac": -162.5834866245358, "total_return_usd": -133789886.88827768, "total_return_2021usd": -141803454.04239509, "mean_revenue_usd_ac": 462.67589738727895, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 205.90625, "breakeven_Mg_ha": 12.924254469289222, "return_p05": -215.29570810099065, "return_median": -147.0467252281983, "return_p95": -83.76042477208728, "mean_revenue_usd_ac_2021dollars": 490.38863756920784, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -228.1912015869913, "return_median_2021dollars": -155.85433270000388, "return_p95_2021dollars": -88.77739432322404}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 352962.18, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264721.59, "mean_return_usd_ac": -262.11410261272084, "mean_return_2021usd_ac": -277.8138614822554, "total_return_usd": -228612916.81819177, "total_return_2021usd": -242306066.60574684, "mean_revenue_usd_ac": 462.67589738727895, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 242.2426470588235, "breakeven_Mg_ha": 15.20500525798732, "return_p05": -324.0142081009907, "return_median": -255.7652252281984, "return_p95": -192.4789247720873, "mean_revenue_usd_ac_2021dollars": 490.38863756920784, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -343.42157644471087, "return_median_2021dollars": -271.0847075577235, "return_p95_2021dollars": -204.0077691809436}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 352962.18, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264721.59, "mean_return_usd_ac": -370.8326026127205, "mean_return_2021usd_ac": -393.0442363399745, "total_return_usd": -323435946.74810547, "total_return_2021usd": -342808679.1690982, "mean_revenue_usd_ac": 462.67589738727895, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 278.579044117647, "breakeven_Mg_ha": 17.485756046685417, "return_p05": -432.7327081009906, "return_median": -364.4837252281983, "return_p95": -301.1974247720873, "mean_revenue_usd_ac_2021dollars": 490.38863756920784, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -458.65195130243023, "return_median_2021dollars": -386.31508241544293, "return_p95_2021dollars": -319.2381440386631}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 328878.27, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 240637.68, "mean_return_usd_ac": -71.74691483849504, "mean_return_2021usd_ac": -76.0443152887932, "total_return_usd": -62576836.99747151, "total_return_2021usd": -66324980.42770139, "mean_revenue_usd_ac": 544.3245851615051, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 175.02031249999996, "breakeven_Mg_ha": 10.985616298895838, "return_p05": -144.57056835410663, "return_median": -64.27764732729213, "return_p95": 10.17682379754433, "mean_revenue_usd_ac_2021dollars": 576.9278089049509, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -153.22986230344668, "return_median_2021dollars": -68.12766361287329, "return_p95_2021dollars": 10.786381536279418}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 352382.58, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264141.99, "mean_return_usd_ac": -180.46541483849504, "mean_return_2021usd_ac": -191.27469014651277, "total_return_usd": -157399866.92738554, "total_return_2021usd": -166827592.99105307, "mean_revenue_usd_ac": 544.3245851615051, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 205.90625, "breakeven_Mg_ha": 12.924254469289224, "return_p05": -253.28906835410672, "return_median": -172.9961473272922, "return_p95": -98.54167620245572, "mean_revenue_usd_ac_2021dollars": 576.9278089049509, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -268.46023716116633, "return_median_2021dollars": -183.35803847059287, "return_p95_2021dollars": -104.44399332144015}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 352962.18, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264721.59, "mean_return_usd_ac": -289.183914838495, "mean_return_2021usd_ac": -306.5050650042322, "total_return_usd": -252222896.8572996, "total_return_2021usd": -267330205.5544048, "mean_revenue_usd_ac": 544.3245851615051, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 236.7921875, "breakeven_Mg_ha": 14.862892639682606, "return_p05": -362.0075683541067, "return_median": -281.71464732729214, "return_p95": -207.26017620245568, "mean_revenue_usd_ac_2021dollars": 576.9278089049509, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -383.6906120188858, "return_median_2021dollars": -298.58841332831236, "return_p95_2021dollars": -219.67436817915964}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 104829.21, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 16588.62, "mean_return_usd_ac": 9.901772935730662, "mean_return_2021usd_ac": 10.49485604694938, "total_return_usd": 8636212.893334633, "total_return_2021usd": 9153493.18699228, "mean_revenue_usd_ac": 625.9732729357302, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 152.1915760869565, "breakeven_Mg_ha": 9.552709825126817, "return_p05": -73.84542860722273, "return_median": 18.491430573613968, "return_p95": 104.11407236717594, "mean_revenue_usd_ac_2021dollars": 663.4669802406928, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -78.26852301990222, "return_median_2021dollars": 19.599005474257215, "return_p95_2021dollars": 110.35015739578287}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 337363.38, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 249122.79, "mean_return_usd_ac": -98.8167270642694, "mean_return_2021usd_ac": -104.73551881077022, "total_return_usd": -86186817.03657945, "total_return_2021usd": -91349119.37635946, "mean_revenue_usd_ac": 625.9732729357302, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 179.04891304347825, "breakeven_Mg_ha": 11.23848214720802, "return_p05": -182.5639286072228, "return_median": -90.2270694263861, "return_p95": -4.604427632824127, "mean_revenue_usd_ac_2021dollars": 663.4669802406928, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -193.49889787762183, "return_median_2021dollars": -95.63136938346237, "return_p95_2021dollars": -4.88021746193671}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 352382.58, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264141.99, "mean_return_usd_ac": -207.53522706426944, "mean_return_2021usd_ac": -219.96589366848977, "total_return_usd": -181009846.9664935, "total_return_2021usd": -191851731.9397112, "mean_revenue_usd_ac": 625.9732729357302, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 205.90625, "breakeven_Mg_ha": 12.924254469289222, "return_p05": -291.2824286072228, "return_median": -198.94556942638604, "return_p95": -113.32292763282408, "mean_revenue_usd_ac_2021dollars": 663.4669802406928, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -308.72927273534134, "return_median_2021dollars": -210.86174424118184, "return_p95_2021dollars": -120.11059231965618}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 146321.72999999998, "loss_ha": 125321.04, "quartile_ha": 43003.08, "both_ha": 43003.08, "disagree_ha": 82317.95999999999, "mean_return_usd_ac": -42.18422315482545, "mean_return_2021usd_ac": -44.71091715956556, "total_return_usd": -15252501.859355606, "total_return_2021usd": -16166075.7531755, "mean_revenue_usd_ac": 426.5907768451745, "mean_cash_margin_usd_ac": 26.546776845174595, "breakeven_bu_ac": 167.99928840192615, "breakeven_Mg_ha": 10.544923012128107, "return_p05": -250.3098705623046, "return_median": -33.19807753766827, "return_p95": 25.753210149571004, "mean_revenue_usd_ac_2021dollars": 452.14213888818585, "mean_cash_margin_usd_ac_2021dollars": 28.136840069847334, "return_p05_2021dollars": -265.3025953768826, "return_median_2021dollars": -35.18653144792425, "return_p95_2021dollars": 27.295741380948908}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 146321.72999999998, "loss_ha": 145768.86, "quartile_ha": 43003.08, "both_ha": 43003.08, "disagree_ha": 102765.78, "mean_return_usd_ac": -124.90922315482548, "mean_return_2021usd_ac": -132.39086822681583, "total_return_usd": -45163286.55448302, "total_return_2021usd": -47868416.50206434, "mean_revenue_usd_ac": 426.5907768451745, "mean_cash_margin_usd_ac": -44.04922315482545, "breakeven_bu_ac": 197.6462216493249, "breakeven_Mg_ha": 12.405791778974246, "return_p05": -333.0348705623046, "return_median": -115.92307753766828, "return_p95": -56.97178985042902, "mean_revenue_usd_ac_2021dollars": 452.14213888818585, "mean_cash_margin_usd_ac_2021dollars": -46.687624427506584, "return_p05_2021dollars": -352.9825464441329, "return_median_2021dollars": -122.86648251517452, "return_p95_2021dollars": -60.384209686301375}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 146321.72999999998, "loss_ha": 146313.63, "quartile_ha": 43003.08, "both_ha": 43003.08, "disagree_ha": 103310.55, "mean_return_usd_ac": -207.6342231548253, "mean_return_2021usd_ac": -220.07081929406596, "total_return_usd": -75074071.24961038, "total_return_2021usd": -79570757.25095312, "mean_revenue_usd_ac": 426.5907768451745, "mean_cash_margin_usd_ac": -114.64522315482546, "breakeven_bu_ac": 227.2931548967236, "breakeven_Mg_ha": 14.26666054582038, "return_p05": -415.7598705623045, "return_median": -198.6480775376682, "return_p95": -139.69678985042893, "mean_revenue_usd_ac_2021dollars": 452.14213888818585, "mean_cash_margin_usd_ac_2021dollars": -121.51208892486046, "return_p05_2021dollars": -440.66249751138304, "return_median_2021dollars": -210.5464335824247, "return_p95_2021dollars": -148.06416075355153}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 146321.72999999998, "loss_ha": 17309.34, "quartile_ha": 43003.08, "both_ha": 17309.34, "disagree_ha": 25693.74, "mean_return_usd_ac": 33.09650217079364, "mean_return_2021usd_ac": 35.07887205599672, "total_return_usd": 11966664.860591425, "total_return_2021usd": 12683428.098094156, "mean_revenue_usd_ac": 501.8715021707936, "mean_cash_margin_usd_ac": 101.82750217079358, "breakeven_bu_ac": 142.79939514163723, "breakeven_Mg_ha": 8.963184560308893, "return_p05": -211.7572006615348, "return_median": 43.66843819097846, "return_p95": 113.02289429361292, "mean_revenue_usd_ac_2021dollars": 531.9319281037481, "mean_cash_margin_usd_ac_2021dollars": 107.92662928540949, "return_p05_2021dollars": -224.440749376141, "return_median_2021dollars": 46.284031716751095, "return_p95_2021dollars": 119.79258798601366}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 146321.72999999998, "loss_ha": 125321.04, "quartile_ha": 43003.08, "both_ha": 43003.08, "disagree_ha": 82317.95999999999, "mean_return_usd_ac": -49.62849782920637, "mean_return_2021usd_ac": -52.60107901125355, "total_return_usd": -17944119.83453599, "total_return_2021usd": -19018912.650794685, "mean_revenue_usd_ac": 501.8715021707936, "mean_cash_margin_usd_ac": 31.231502170793608, "breakeven_bu_ac": 167.99928840192618, "breakeven_Mg_ha": 10.54492301212811, "return_p05": -294.4822006615348, "return_median": -39.05656180902156, "return_p95": 30.297894293612888, "mean_revenue_usd_ac_2021dollars": 531.9319281037481, "mean_cash_margin_usd_ac_2021dollars": 33.10216478805565, "return_p05_2021dollars": -312.1207004433913, "return_median_2021dollars": -41.39591935049919, "return_p95_2021dollars": 32.11263691876336}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 146321.72999999998, "loss_ha": 145338.3, "quartile_ha": 43003.08, "both_ha": 43003.08, "disagree_ha": 102335.22, "mean_return_usd_ac": -132.35349782920636, "mean_return_2021usd_ac": -140.2810300785038, "total_return_usd": -47854904.5296634, "total_return_2021usd": -50721253.39968353, "mean_revenue_usd_ac": 501.8715021707936, "mean_cash_margin_usd_ac": -39.36449782920637, "breakeven_bu_ac": 193.19918166221507, "breakeven_Mg_ha": 12.126661463947324, "return_p05": -377.2072006615347, "return_median": -121.78156180902148, "return_p95": -52.42710570638702, "mean_revenue_usd_ac_2021dollars": 531.9319281037481, "mean_cash_margin_usd_ac_2021dollars": -41.7222997092982, "return_p05_2021dollars": -399.80065151064144, "return_median_2021dollars": -129.07587041774937, "return_p95_2021dollars": -55.5673141484868}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 146321.72999999998, "loss_ha": 8216.369999999999, "quartile_ha": 43003.08, "both_ha": 8216.369999999999, "disagree_ha": 34786.71, "mean_return_usd_ac": 108.37722749641264, "mean_return_2021usd_ac": 114.86866127155888, "total_return_usd": 39185831.580538414, "total_return_2021usd": 41532931.94936377, "mean_revenue_usd_ac": 577.1522274964125, "mean_cash_margin_usd_ac": 177.10822749641264, "breakeven_bu_ac": 124.17338707968456, "breakeven_Mg_ha": 7.794073530703385, "return_p05": -173.20453076076507, "return_median": 120.5349539196252, "return_p95": 200.2925784376548, "mean_revenue_usd_ac_2021dollars": 611.7217173193102, "mean_cash_margin_usd_ac_2021dollars": 187.71641850097174, "return_p05_2021dollars": -183.5789033753995, "return_median_2021dollars": 127.75459488142643, "return_p95_2021dollars": 212.28943459107836}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 146321.72999999998, "loss_ha": 24561.72, "quartile_ha": 43003.08, "both_ha": 24561.72, "disagree_ha": 18441.36, "mean_return_usd_ac": 25.6522274964126, "mean_return_2021usd_ac": 27.18871020430859, "total_return_usd": 9275046.885410994, "total_return_2021usd": 9830591.200474922, "mean_revenue_usd_ac": 577.1522274964125, "mean_cash_margin_usd_ac": 106.51222749641258, "breakeven_bu_ac": 146.08633774080536, "breakeven_Mg_ha": 9.169498271415748, "return_p05": -255.9295307607651, "return_median": 37.80995391962517, "return_p95": 117.5675784376548, "mean_revenue_usd_ac_2021dollars": 611.7217173193102, "mean_cash_margin_usd_ac_2021dollars": 112.8919540036178, "return_p05_2021dollars": -271.25885444264975, "return_median_2021dollars": 40.074643814176156, "return_p95_2021dollars": 124.6094835238281}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_county", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 146321.72999999998, "loss_ha": 125321.04, "quartile_ha": 43003.08, "both_ha": 43003.08, "disagree_ha": 82317.95999999999, "mean_return_usd_ac": -57.07277250358732, "mean_return_2021usd_ac": -60.49124086294158, "total_return_usd": -20635737.809716385, "total_return_2021usd": -21871749.548413884, "mean_revenue_usd_ac": 577.1522274964125, "mean_cash_margin_usd_ac": 35.91622749641261, "breakeven_bu_ac": 167.99928840192615, "breakeven_Mg_ha": 10.544923012128107, "return_p05": -338.654530760765, "return_median": -44.91504608037474, "return_p95": 34.842578437654886, "mean_revenue_usd_ac_2021dollars": 611.7217173193102, "mean_cash_margin_usd_ac_2021dollars": 38.06748950626396, "return_p05_2021dollars": -358.93880550989996, "return_median_2021dollars": -47.60530725307401, "return_p95_2021dollars": 36.92953245657793}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 352180.98, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 263940.39, "mean_return_usd_ac": -133.201919531495, "mean_return_2021usd_ac": -141.18026940568495, "total_return_usd": -116177187.89770782, "total_return_2021usd": -123135813.23664866, "mean_revenue_usd_ac": 421.72908046850455, "mean_cash_margin_usd_ac": -45.94091953149497, "breakeven_bu_ac": 203.4795292474941, "breakeven_Mg_ha": 12.771934874661614, "return_p05": -189.62386568405296, "return_median": -127.41491779550272, "return_p95": -69.72945492975754, "mean_revenue_usd_ac_2021dollars": 446.9892431443327, "mean_cash_margin_usd_ac_2021dollars": -48.69262709587139, "return_p05_2021dollars": -200.98170159396312, "return_median_2021dollars": -135.04664560347408, "return_p95_2021dollars": -73.90601627303927}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 352962.18, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264721.59, "mean_return_usd_ac": -231.13091953149487, "mean_return_2021usd_ac": -244.97488926745277, "total_return_usd": -201589739.56100836, "total_return_2021usd": -213664291.33114457, "mean_revenue_usd_ac": 421.72908046850455, "mean_cash_margin_usd_ac": -128.470919531495, "breakeven_bu_ac": 239.3876814676401, "breakeven_Mg_ha": 15.025805734896018, "return_p05": -287.5528656840529, "return_median": -225.3439177955027, "return_p95": -167.6584549297575, "mean_revenue_usd_ac_2021dollars": 446.9892431443327, "mean_cash_margin_usd_ac_2021dollars": -136.16589831473107, "return_p05_2021dollars": -304.77632145573097, "return_median_2021dollars": -238.84126546524197, "return_p95_2021dollars": -177.70063613480716}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 352962.18, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264721.59, "mean_return_usd_ac": -329.0599195314948, "mean_return_2021usd_ac": -348.7695091292206, "total_return_usd": -287002291.22430897, "total_return_2021usd": -304192769.4256406, "mean_revenue_usd_ac": 421.72908046850455, "mean_cash_margin_usd_ac": -211.0009195314948, "breakeven_bu_ac": 275.2958336877861, "breakeven_Mg_ha": 17.279676595130418, "return_p05": -385.4818656840529, "return_median": -323.2729177955027, "return_p95": -265.5874549297575, "mean_revenue_usd_ac_2021dollars": 446.9892431443327, "mean_cash_margin_usd_ac_2021dollars": -223.6391695335905, "return_p05_2021dollars": -408.57094131749886, "return_median_2021dollars": -342.6358853270099, "return_p95_2021dollars": -281.49525599657505}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 322990.02, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 234749.43, "mean_return_usd_ac": -58.77914062528818, "mean_return_2021usd_ac": -62.29981473315551, "total_return_usd": -51266492.92223795, "total_return_2021usd": -54337184.5368553, "mean_revenue_usd_ac": 496.1518593747117, "mean_cash_margin_usd_ac": 28.48185937471183, "breakeven_bu_ac": 172.95759986036998, "breakeven_Mg_ha": 10.856144643462372, "return_p05": -125.1579008047682, "return_median": -51.97090328882675, "return_p95": 15.894347141461708, "mean_revenue_usd_ac_2021dollars": 525.8696978168625, "mean_cash_margin_usd_ac_2021dollars": 30.18782757665804, "return_p05_2021dollars": -132.65444083701223, "return_median_2021dollars": -55.08378673055454, "return_p95_2021dollars": 16.846365422898174}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 352180.98, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 263940.39, "mean_return_usd_ac": -156.70814062528817, "mean_return_2021usd_ac": -166.0944345949234, "total_return_usd": -136679044.58553857, "total_return_2021usd": -144865662.63135132, "mean_revenue_usd_ac": 496.1518593747117, "mean_cash_margin_usd_ac": -54.04814062528818, "breakeven_bu_ac": 203.4795292474941, "breakeven_Mg_ha": 12.771934874661614, "return_p05": -223.08690080476816, "return_median": -149.89990328882672, "return_p95": -82.03465285853827, "mean_revenue_usd_ac_2021dollars": 525.8696978168625, "mean_cash_margin_usd_ac_2021dollars": -57.28544364220161, "return_p05_2021dollars": -236.4490606987801, "return_median_2021dollars": -158.87840659232242, "return_p95_2021dollars": -86.94825443886971}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 352962.18, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 264721.59, "mean_return_usd_ac": -254.63714062528817, "mean_return_2021usd_ac": -269.8890544566913, "total_return_usd": -222091596.2488392, "total_return_2021usd": -235394140.7258473, "mean_revenue_usd_ac": 496.1518593747117, "mean_cash_margin_usd_ac": -136.57814062528817, "breakeven_bu_ac": 234.00145863461825, "breakeven_Mg_ha": 14.687725105860856, "return_p05": -321.01590080476814, "return_median": -247.8289032888267, "return_p95": -179.96365285853824, "mean_revenue_usd_ac_2021dollars": 525.8696978168625, "mean_cash_margin_usd_ac_2021dollars": -144.75871486106124, "return_p05_2021dollars": -340.243680560548, "return_median_2021dollars": -262.6730264540903, "return_p95_2021dollars": -190.7428743006376}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 352962.18, "loss_ha": 82091.87999999999, "quartile_ha": 88240.59, "both_ha": 82091.87999999999, "disagree_ha": 6148.71, "mean_return_usd_ac": 15.64363828091855, "mean_return_2021usd_ac": 16.580639939373846, "total_return_usd": 13644202.053231863, "total_return_2021usd": 14461444.162937991, "mean_revenue_usd_ac": 570.5746382809185, "mean_cash_margin_usd_ac": 102.9046382809186, "breakeven_bu_ac": 150.39791292206084, "breakeven_Mg_ha": 9.4401257769238, "return_p05": -60.69193592548349, "return_median": 23.47311121784918, "return_p95": 101.5181492126809, "mean_revenue_usd_ac_2021dollars": 604.750152489392, "mean_cash_margin_usd_ac_2021dollars": 109.06828224918743, "return_p05_2021dollars": -64.32718008006141, "return_median_2021dollars": 24.879072142364933, "return_p95_2021dollars": 107.59874711883556}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 352962.18, "loss_ha": 333380.61, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 245140.02, "mean_return_usd_ac": -82.28536171908146, "mean_return_2021usd_ac": -87.21397992239407, "total_return_usd": -71768349.61006878, "total_return_2021usd": -76067033.93155806, "mean_revenue_usd_ac": 570.5746382809185, "mean_cash_margin_usd_ac": 20.374638280918514, "breakeven_bu_ac": 176.93872108477746, "breakeven_Mg_ha": 11.106030325792709, "return_p05": -158.62093592548348, "return_median": -74.4558887821508, "return_p95": 3.5891492126809226, "mean_revenue_usd_ac_2021dollars": 604.750152489392, "mean_cash_margin_usd_ac_2021dollars": 21.595011030327704, "return_p05_2021dollars": -168.12179994182932, "return_median_2021dollars": -78.91554771940295, "return_p95_2021dollars": 3.804127257067671}, {"year": 2019, "scenario": "M2_HI_sensitivity", "experimental": false, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 352962.18, "loss_ha": 352180.98, "quartile_ha": 88240.59, "both_ha": 88240.59, "disagree_ha": 263940.39, "mean_return_usd_ac": -180.2143617190815, "mean_return_2021usd_ac": -191.008599784162, "total_return_usd": -157180901.27336943, "total_return_2021usd": -166595512.0260541, "mean_revenue_usd_ac": 570.5746382809185, "mean_cash_margin_usd_ac": -62.155361719081405, "breakeven_bu_ac": 203.4795292474941, "breakeven_Mg_ha": 12.771934874661614, "return_p05": -256.54993592548345, "return_median": -172.38488878215077, "return_p95": -94.33985078731904, "mean_revenue_usd_ac_2021dollars": 604.750152489392, "mean_cash_margin_usd_ac_2021dollars": -65.87826018853185, "return_p05_2021dollars": -271.9164198035972, "return_median_2021dollars": -182.71016758117082, "return_p95_2021dollars": -99.9904926047002}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 2.16, "quartile_ha": 43942.77, "both_ha": 2.16, "disagree_ha": 43940.61, "mean_return_usd_ac": 445.2718083601328, "mean_return_2021usd_ac": 445.2718083601328, "total_return_usd": 193399168.1576264, "total_return_2021usd": 193399168.1576264, "mean_revenue_usd_ac": 931.6248083601346, "mean_cash_margin_usd_ac": 637.7883083601333, "breakeven_bu_ac": 96.00335570469798, "breakeven_Mg_ha": 6.025906445448868, "return_p05": 348.6397809813585, "return_median": 442.9681747766614, "return_p95": 554.4215471570618, "mean_revenue_usd_ac_2021dollars": 931.6248083601346, "mean_cash_margin_usd_ac_2021dollars": 637.7883083601333, "return_p05_2021dollars": 348.6397809813585, "return_median_2021dollars": 442.9681747766614, "return_p95_2021dollars": 554.4215471570618}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 7.38, "quartile_ha": 43942.77, "both_ha": 7.38, "disagree_ha": 43935.39, "mean_return_usd_ac": 359.4448083601333, "mean_return_2021usd_ac": 359.4448083601333, "total_return_usd": 156121105.42422417, "total_return_2021usd": 156121105.42422417, "mean_revenue_usd_ac": 931.6248083601346, "mean_cash_margin_usd_ac": 585.9348083601337, "breakeven_bu_ac": 112.94512435846822, "breakeven_Mg_ha": 7.089301700528081, "return_p05": 262.8127809813585, "return_median": 357.1411747766614, "return_p95": 468.5945471570618, "mean_revenue_usd_ac_2021dollars": 931.6248083601346, "mean_cash_margin_usd_ac_2021dollars": 585.9348083601337, "return_p05_2021dollars": 262.8127809813585, "return_median_2021dollars": 357.1411747766614, "return_p95_2021dollars": 468.5945471570618}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 24.03, "quartile_ha": 43942.77, "both_ha": 24.03, "disagree_ha": 43918.74, "mean_return_usd_ac": 273.61780836013327, "mean_return_2021usd_ac": 273.61780836013327, "total_return_usd": 118843042.69082163, "total_return_2021usd": 118843042.69082163, "mean_revenue_usd_ac": 931.6248083601346, "mean_cash_margin_usd_ac": 534.081308360133, "breakeven_bu_ac": 129.88689301223846, "breakeven_Mg_ha": 8.152696955607293, "return_p05": 176.98578098135852, "return_median": 271.3141747766614, "return_p95": 382.7675471570618, "mean_revenue_usd_ac_2021dollars": 931.6248083601346, "mean_cash_margin_usd_ac_2021dollars": 534.081308360133, "return_p05_2021dollars": 176.98578098135852, "return_median_2021dollars": 271.3141747766614, "return_p95_2021dollars": 382.7675471570618}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 0.4499999999999999, "quartile_ha": 43942.77, "both_ha": 0.4499999999999999, "disagree_ha": 43942.32, "mean_return_usd_ac": 609.6761863060391, "mean_return_2021usd_ac": 609.6761863060391, "total_return_usd": 264806495.860022, "total_return_2021usd": 264806495.860022, "mean_revenue_usd_ac": 1096.0291863060384, "mean_cash_margin_usd_ac": 802.1926863060386, "breakeven_bu_ac": 81.60285234899328, "breakeven_Mg_ha": 5.122020478631538, "return_p05": 495.991448213363, "return_median": 606.9660291490135, "return_p95": 738.0876437141904, "mean_revenue_usd_ac_2021dollars": 1096.0291863060384, "mean_cash_margin_usd_ac_2021dollars": 802.1926863060386, "return_p05_2021dollars": 495.991448213363, "return_median_2021dollars": 606.9660291490135, "return_p95_2021dollars": 738.0876437141904}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 2.16, "quartile_ha": 43942.77, "both_ha": 2.16, "disagree_ha": 43940.61, "mean_return_usd_ac": 523.8491863060385, "mean_return_2021usd_ac": 523.8491863060385, "total_return_usd": 227528433.1266193, "total_return_2021usd": 227528433.1266193, "mean_revenue_usd_ac": 1096.0291863060384, "mean_cash_margin_usd_ac": 750.3391863060382, "breakeven_bu_ac": 96.00335570469798, "breakeven_Mg_ha": 6.025906445448868, "return_p05": 410.164448213363, "return_median": 521.1390291490135, "return_p95": 652.2606437141905, "mean_revenue_usd_ac_2021dollars": 1096.0291863060384, "mean_cash_margin_usd_ac_2021dollars": 750.3391863060382, "return_p05_2021dollars": 410.164448213363, "return_median_2021dollars": 521.1390291490135, "return_p95_2021dollars": 652.2606437141905}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 6.48, "quartile_ha": 43942.77, "both_ha": 6.48, "disagree_ha": 43936.29, "mean_return_usd_ac": 438.02218630603926, "mean_return_2021usd_ac": 438.02218630603926, "total_return_usd": 190250370.39321712, "total_return_2021usd": 190250370.39321712, "mean_revenue_usd_ac": 1096.0291863060384, "mean_cash_margin_usd_ac": 698.4856863060388, "breakeven_bu_ac": 110.40385906040268, "breakeven_Mg_ha": 6.929792412266198, "return_p05": 324.337448213363, "return_median": 435.3120291490135, "return_p95": 566.4336437141905, "mean_revenue_usd_ac_2021dollars": 1096.0291863060384, "mean_cash_margin_usd_ac_2021dollars": 698.4856863060388, "return_p05_2021dollars": 324.337448213363, "return_median_2021dollars": 435.3120291490135, "return_p95_2021dollars": 566.4336437141905}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 0.09, "quartile_ha": 43942.77, "both_ha": 0.09, "disagree_ha": 43942.68, "mean_return_usd_ac": 774.0805642519449, "mean_return_2021usd_ac": 774.0805642519449, "total_return_usd": 336213823.56241745, "total_return_2021usd": 336213823.56241745, "mean_revenue_usd_ac": 1260.4335642519452, "mean_cash_margin_usd_ac": 966.597064251945, "breakeven_bu_ac": 70.95900204260286, "breakeven_Mg_ha": 4.453930850983946, "return_p05": 643.3431154453674, "return_median": 770.9638835213653, "return_p95": 921.7537402713187, "mean_revenue_usd_ac_2021dollars": 1260.4335642519452, "mean_cash_margin_usd_ac_2021dollars": 966.597064251945, "return_p05_2021dollars": 643.3431154453674, "return_median_2021dollars": 770.9638835213653, "return_p95_2021dollars": 921.7537402713187}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 0.8999999999999999, "quartile_ha": 43942.77, "both_ha": 0.8999999999999999, "disagree_ha": 43941.87, "mean_return_usd_ac": 688.2535642519451, "mean_return_2021usd_ac": 688.2535642519451, "total_return_usd": 298935760.8290151, "total_return_2021usd": 298935760.8290151, "mean_revenue_usd_ac": 1260.4335642519452, "mean_cash_margin_usd_ac": 914.743564251945, "breakeven_bu_ac": 83.48117887365042, "breakeven_Mg_ha": 5.239918648216407, "return_p05": 557.5161154453674, "return_median": 685.1368835213653, "return_p95": 835.9267402713189, "mean_revenue_usd_ac_2021dollars": 1260.4335642519452, "mean_cash_margin_usd_ac_2021dollars": 914.743564251945, "return_p05_2021dollars": 557.5161154453674, "return_median_2021dollars": 685.1368835213653, "return_p95_2021dollars": 835.9267402713189}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 2.16, "quartile_ha": 43942.77, "both_ha": 2.16, "disagree_ha": 43940.61, "mean_return_usd_ac": 602.4265642519451, "mean_return_2021usd_ac": 602.4265642519451, "total_return_usd": 261657698.0956126, "total_return_2021usd": 261657698.0956126, "mean_revenue_usd_ac": 1260.4335642519452, "mean_cash_margin_usd_ac": 862.8900642519445, "breakeven_bu_ac": 96.003355704698, "breakeven_Mg_ha": 6.025906445448869, "return_p05": 471.6891154453674, "return_median": 599.3098835213654, "return_p95": 750.0997402713189, "mean_revenue_usd_ac_2021dollars": 1260.4335642519452, "mean_cash_margin_usd_ac_2021dollars": 862.8900642519445, "return_p05_2021dollars": 471.6891154453674, "return_median_2021dollars": 599.3098835213654, "return_p95_2021dollars": 750.0997402713189}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 30.6, "quartile_ha": 43942.77, "both_ha": 30.6, "disagree_ha": 43912.17, "mean_return_usd_ac": 265.5733083601331, "mean_return_2021usd_ac": 265.5733083601331, "total_return_usd": 115348997.97693367, "total_return_2021usd": 115348997.97693367, "mean_revenue_usd_ac": 931.6248083601346, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 131.47483221476512, "breakeven_Mg_ha": 8.252368191109928, "return_p05": 168.94128098135843, "return_median": 263.2696747766613, "return_p95": 374.7230471570617, "mean_revenue_usd_ac_2021dollars": 931.6248083601346, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 168.94128098135843, "return_median_2021dollars": 263.2696747766613, "return_p95_2021dollars": 374.7230471570617}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 1882.98, "quartile_ha": 43942.77, "both_ha": 1882.98, "disagree_ha": 42059.79, "mean_return_usd_ac": 148.0348083601332, "mean_return_2021usd_ac": 148.0348083601332, "total_return_usd": 64297375.79987954, "total_return_2021usd": 64297375.79987954, "mean_revenue_usd_ac": 931.6248083601346, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 154.6762731938413, "breakeven_Mg_ha": 9.708668460129328, "return_p05": 51.40278098135843, "return_median": 145.7311747766613, "return_p95": 257.18454715706173, "mean_revenue_usd_ac_2021dollars": 931.6248083601346, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 51.40278098135843, "return_median_2021dollars": 145.7311747766613, "return_p95_2021dollars": 257.18454715706173}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 50068.53, "quartile_ha": 43942.77, "both_ha": 43942.77, "disagree_ha": 6125.76, "mean_return_usd_ac": 30.49630836013326, "mean_return_2021usd_ac": 30.49630836013326, "total_return_usd": 13245753.622825388, "total_return_2021usd": 13245753.622825388, "mean_revenue_usd_ac": 931.6248083601346, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 177.87771417291748, "breakeven_Mg_ha": 11.164968729148724, "return_p05": -66.13571901864145, "return_median": 28.19267477666142, "return_p95": 139.64604715706184, "mean_revenue_usd_ac_2021dollars": 931.6248083601346, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -66.13571901864145, "return_median_2021dollars": 28.19267477666142, "return_p95_2021dollars": 139.64604715706184}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 7.109999999999999, "quartile_ha": 43942.77, "both_ha": 7.109999999999999, "disagree_ha": 43935.66, "mean_return_usd_ac": 429.9776863060394, "mean_return_2021usd_ac": 429.9776863060394, "total_return_usd": 186756325.6793293, "total_return_2021usd": 186756325.6793293, "mean_revenue_usd_ac": 1096.0291863060384, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 111.75360738255034, "breakeven_Mg_ha": 7.01451296244344, "return_p05": 316.29294821336293, "return_median": 427.2675291490134, "return_p95": 558.3891437141904, "mean_revenue_usd_ac_2021dollars": 1096.0291863060384, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 316.29294821336293, "return_median_2021dollars": 427.2675291490134, "return_p95_2021dollars": 558.3891437141904}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 30.6, "quartile_ha": 43942.77, "both_ha": 30.6, "disagree_ha": 43912.17, "mean_return_usd_ac": 312.439186306039, "mean_return_2021usd_ac": 312.439186306039, "total_return_usd": 135704703.50227493, "total_return_2021usd": 135704703.50227493, "mean_revenue_usd_ac": 1096.0291863060384, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 131.47483221476512, "breakeven_Mg_ha": 8.252368191109928, "return_p05": 198.7544482133629, "return_median": 309.7290291490134, "return_p95": 440.8506437141904, "mean_revenue_usd_ac_2021dollars": 1096.0291863060384, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 198.7544482133629, "return_median_2021dollars": 309.7290291490134, "return_p95_2021dollars": 440.8506437141904}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 1048.68, "quartile_ha": 43942.77, "both_ha": 1048.68, "disagree_ha": 42894.09, "mean_return_usd_ac": 194.9006863060392, "mean_return_2021usd_ac": 194.9006863060392, "total_return_usd": 84653081.32522084, "total_return_2021usd": 84653081.32522084, "mean_revenue_usd_ac": 1096.0291863060384, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 151.19605704697986, "breakeven_Mg_ha": 9.490223419776417, "return_p05": 81.21594821336305, "return_median": 192.1905291490135, "return_p95": 323.3121437141905, "mean_revenue_usd_ac_2021dollars": 1096.0291863060384, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 81.21594821336305, "return_median_2021dollars": 192.1905291490135, "return_p95_2021dollars": 323.3121437141905}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 2.43, "quartile_ha": 43942.77, "both_ha": 2.43, "disagree_ha": 43940.34, "mean_return_usd_ac": 594.3820642519446, "mean_return_2021usd_ac": 594.3820642519446, "total_return_usd": 258163653.3817244, "total_return_2021usd": 258163653.3817244, "mean_revenue_usd_ac": 1260.4335642519452, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 97.17704989786988, "breakeven_Mg_ha": 6.099576489081253, "return_p05": 463.6446154453673, "return_median": 591.2653835213653, "return_p95": 742.0552402713188, "mean_revenue_usd_ac_2021dollars": 1260.4335642519452, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 463.6446154453673, "return_median_2021dollars": 591.2653835213653, "return_p95_2021dollars": 742.0552402713188}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 8.01, "quartile_ha": 43942.77, "both_ha": 8.01, "disagree_ha": 43934.76, "mean_return_usd_ac": 476.8435642519449, "mean_return_2021usd_ac": 476.8435642519449, "total_return_usd": 207112031.2046704, "total_return_2021usd": 207112031.2046704, "mean_revenue_usd_ac": 1260.4335642519452, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 114.3259410563175, "breakeven_Mg_ha": 7.175972340095592, "return_p05": 346.1061154453673, "return_median": 473.72688352136527, "return_p95": 624.5167402713188, "mean_revenue_usd_ac_2021dollars": 1260.4335642519452, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 346.1061154453673, "return_median_2021dollars": 473.72688352136527, "return_p95_2021dollars": 624.5167402713188}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 30.6, "quartile_ha": 43942.77, "both_ha": 30.6, "disagree_ha": 43912.17, "mean_return_usd_ac": 359.3050642519449, "mean_return_2021usd_ac": 359.3050642519449, "total_return_usd": 156060409.0276162, "total_return_2021usd": 156060409.0276162, "mean_revenue_usd_ac": 1260.4335642519452, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 131.47483221476512, "breakeven_Mg_ha": 8.252368191109928, "return_p05": 228.56761544536744, "return_median": 356.1883835213654, "return_p95": 506.9782402713189, "mean_revenue_usd_ac_2021dollars": 1260.4335642519452, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 228.56761544536744, "return_median_2021dollars": 356.1883835213654, "return_p95_2021dollars": 506.9782402713189}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 34.29, "quartile_ha": 43942.77, "both_ha": 34.29, "disagree_ha": 43908.48, "mean_return_usd_ac": 237.4506509526728, "mean_return_2021usd_ac": 237.4506509526728, "total_return_usd": 103134214.90091692, "total_return_2021usd": 103134214.90091692, "mean_revenue_usd_ac": 846.1016509526728, "mean_cash_margin_usd_ac": 324.5416509526726, "breakeven_bu_ac": 132.28836743229843, "breakeven_Mg_ha": 8.303431896903849, "return_p05": 149.68944368726972, "return_median": 235.35849093216385, "return_p95": 336.58044372804346, "mean_revenue_usd_ac_2021dollars": 846.1016509526728, "mean_cash_margin_usd_ac_2021dollars": 324.5416509526726, "return_p05_2021dollars": 149.68944368726972, "return_median_2021dollars": 235.35849093216385, "return_p95_2021dollars": 336.58044372804346}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 2186.55, "quartile_ha": 43942.77, "both_ha": 2186.55, "disagree_ha": 41756.22, "mean_return_usd_ac": 130.04165095267288, "mean_return_2021usd_ac": 130.04165095267288, "total_return_usd": 56482235.452351466, "total_return_2021usd": 56482235.452351466, "mean_revenue_usd_ac": 846.1016509526728, "mean_cash_margin_usd_ac": 232.50165095267292, "breakeven_bu_ac": 155.63337344976284, "breakeven_Mg_ha": 9.768743408122171, "return_p05": 42.28044368726973, "return_median": 127.94949093216384, "return_p95": 229.17144372804347, "mean_revenue_usd_ac_2021dollars": 846.1016509526728, "mean_cash_margin_usd_ac_2021dollars": 232.50165095267292, "return_p05_2021dollars": 42.28044368726973, "return_median_2021dollars": 127.94949093216384, "return_p95_2021dollars": 229.17144372804347}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 56735.55, "quartile_ha": 43942.77, "both_ha": 43942.77, "disagree_ha": 12792.78, "mean_return_usd_ac": 22.63265095267301, "mean_return_2021usd_ac": 22.63265095267301, "total_return_usd": 9830256.00378606, "total_return_2021usd": 9830256.00378606, "mean_revenue_usd_ac": 846.1016509526728, "mean_cash_margin_usd_ac": 140.46165095267295, "breakeven_bu_ac": 178.97837946722726, "breakeven_Mg_ha": 11.2340549193405, "return_p05": -65.12855631273015, "return_median": 20.540490932163948, "return_p95": 121.7624437280436, "mean_revenue_usd_ac_2021dollars": 846.1016509526728, "mean_cash_margin_usd_ac_2021dollars": 140.46165095267295, "return_p05_2021dollars": -65.12855631273015, "return_median_2021dollars": 20.540490932163948, "return_p95_2021dollars": 121.7624437280436}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 7.38, "quartile_ha": 43942.77, "both_ha": 7.38, "disagree_ha": 43935.39, "mean_return_usd_ac": 386.7627070031443, "mean_return_2021usd_ac": 386.7627070031443, "total_return_usd": 167986349.92023236, "total_return_2021usd": 167986349.92023236, "mean_revenue_usd_ac": 995.413707003144, "mean_cash_margin_usd_ac": 473.85370700314417, "breakeven_bu_ac": 112.44511231745366, "breakeven_Mg_ha": 7.057917112368271, "return_p05": 283.5142278673762, "return_median": 384.301342273134, "return_p95": 503.3859926212276, "mean_revenue_usd_ac_2021dollars": 995.413707003144, "mean_cash_margin_usd_ac_2021dollars": 473.85370700314417, "return_p05_2021dollars": 283.5142278673762, "return_median_2021dollars": 384.301342273134, "return_p95_2021dollars": 503.3859926212276}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 34.29, "quartile_ha": 43942.77, "both_ha": 34.29, "disagree_ha": 43908.48, "mean_return_usd_ac": 279.35370700314473, "mean_return_2021usd_ac": 279.35370700314473, "total_return_usd": 121334370.47166708, "total_return_2021usd": 121334370.47166708, "mean_revenue_usd_ac": 995.413707003144, "mean_cash_margin_usd_ac": 381.8137070031448, "breakeven_bu_ac": 132.28836743229843, "breakeven_Mg_ha": 8.303431896903849, "return_p05": 176.1052278673762, "return_median": 276.892342273134, "return_p95": 395.9769926212276, "mean_revenue_usd_ac_2021dollars": 995.413707003144, "mean_cash_margin_usd_ac_2021dollars": 381.8137070031448, "return_p05_2021dollars": 176.1052278673762, "return_median_2021dollars": 276.892342273134, "return_p95_2021dollars": 395.9769926212276}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 1234.89, "quartile_ha": 43942.77, "both_ha": 1234.89, "disagree_ha": 42707.88, "mean_return_usd_ac": 171.94470700314469, "mean_return_2021usd_ac": 171.94470700314469, "total_return_usd": 74682391.02310157, "total_return_2021usd": 74682391.02310157, "mean_revenue_usd_ac": 995.413707003144, "mean_cash_margin_usd_ac": 289.7737070031445, "breakeven_bu_ac": 152.13162254714317, "breakeven_Mg_ha": 9.548946681439425, "return_p05": 68.69622786737631, "return_median": 169.4833422731341, "return_p95": 288.56799262122775, "mean_revenue_usd_ac_2021dollars": 995.413707003144, "mean_cash_margin_usd_ac_2021dollars": 289.7737070031445, "return_p05_2021dollars": 68.69622786737631, "return_median_2021dollars": 169.4833422731341, "return_p95_2021dollars": 288.56799262122775}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 2.7, "quartile_ha": 43942.77, "both_ha": 2.7, "disagree_ha": 43940.07, "mean_return_usd_ac": 536.0747630536163, "mean_return_2021usd_ac": 536.0747630536163, "total_return_usd": 232838484.939548, "total_return_2021usd": 232838484.939548, "mean_revenue_usd_ac": 1144.7257630536158, "mean_cash_margin_usd_ac": 623.1657630536168, "breakeven_bu_ac": 97.77835853691624, "breakeven_Mg_ha": 6.137319228146323, "return_p05": 417.3390120474826, "return_median": 533.2441936141039, "return_p95": 670.1915415144117, "mean_revenue_usd_ac_2021dollars": 1144.7257630536158, "mean_cash_margin_usd_ac_2021dollars": 623.1657630536168, "return_p05_2021dollars": 417.3390120474826, "return_median_2021dollars": 533.2441936141039, "return_p95_2021dollars": 670.1915415144117}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 8.1, "quartile_ha": 43942.77, "both_ha": 8.1, "disagree_ha": 43934.67, "mean_return_usd_ac": 428.66576305361633, "mean_return_2021usd_ac": 428.66576305361633, "total_return_usd": 186186505.49098253, "total_return_2021usd": 186186505.49098253, "mean_revenue_usd_ac": 1144.7257630536158, "mean_cash_margin_usd_ac": 531.1257630536161, "breakeven_bu_ac": 115.03336298460736, "breakeven_Mg_ha": 7.220375562525087, "return_p05": 309.9300120474826, "return_median": 425.8351936141039, "return_p95": 562.7825415144117, "mean_revenue_usd_ac_2021dollars": 1144.7257630536158, "mean_cash_margin_usd_ac_2021dollars": 531.1257630536161, "return_p05_2021dollars": 309.9300120474826, "return_median_2021dollars": 425.8351936141039, "return_p95_2021dollars": 562.7825415144117}, {"year": 2021, "scenario": "M1_fixed", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 34.29, "quartile_ha": 43942.77, "both_ha": 34.29, "disagree_ha": 43908.48, "mean_return_usd_ac": 321.25676305361645, "mean_return_2021usd_ac": 321.25676305361645, "total_return_usd": 139534526.04241714, "total_return_2021usd": 139534526.04241714, "mean_revenue_usd_ac": 1144.7257630536158, "mean_cash_margin_usd_ac": 439.0857630536165, "breakeven_bu_ac": 132.28836743229843, "breakeven_Mg_ha": 8.303431896903849, "return_p05": 202.5210120474827, "return_median": 318.426193614104, "return_p95": 455.37354151441184, "mean_revenue_usd_ac_2021dollars": 1144.7257630536158, "mean_cash_margin_usd_ac_2021dollars": 439.0857630536165, "return_p05_2021dollars": 202.5210120474827, "return_median_2021dollars": 318.426193614104, "return_p95_2021dollars": 455.37354151441184}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 2.16, "quartile_ha": 43942.77, "both_ha": 2.16, "disagree_ha": 43940.61, "mean_return_usd_ac": 445.2718083601328, "mean_return_2021usd_ac": 445.2718083601328, "total_return_usd": 193399168.1576264, "total_return_2021usd": 193399168.1576264, "mean_revenue_usd_ac": 931.6248083601346, "mean_cash_margin_usd_ac": 637.7883083601333, "breakeven_bu_ac": 96.00335570469798, "breakeven_Mg_ha": 6.025906445448868, "return_p05": 348.6397809813585, "return_median": 442.9681747766614, "return_p95": 554.4215471570618, "mean_revenue_usd_ac_2021dollars": 931.6248083601346, "mean_cash_margin_usd_ac_2021dollars": 637.7883083601333, "return_p05_2021dollars": 348.6397809813585, "return_median_2021dollars": 442.9681747766614, "return_p95_2021dollars": 554.4215471570618}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 7.38, "quartile_ha": 43942.77, "both_ha": 7.38, "disagree_ha": 43935.39, "mean_return_usd_ac": 359.4448083601333, "mean_return_2021usd_ac": 359.4448083601333, "total_return_usd": 156121105.42422417, "total_return_2021usd": 156121105.42422417, "mean_revenue_usd_ac": 931.6248083601346, "mean_cash_margin_usd_ac": 585.9348083601337, "breakeven_bu_ac": 112.94512435846822, "breakeven_Mg_ha": 7.089301700528081, "return_p05": 262.8127809813585, "return_median": 357.1411747766614, "return_p95": 468.5945471570618, "mean_revenue_usd_ac_2021dollars": 931.6248083601346, "mean_cash_margin_usd_ac_2021dollars": 585.9348083601337, "return_p05_2021dollars": 262.8127809813585, "return_median_2021dollars": 357.1411747766614, "return_p95_2021dollars": 468.5945471570618}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 24.03, "quartile_ha": 43942.77, "both_ha": 24.03, "disagree_ha": 43918.74, "mean_return_usd_ac": 273.61780836013327, "mean_return_2021usd_ac": 273.61780836013327, "total_return_usd": 118843042.69082163, "total_return_2021usd": 118843042.69082163, "mean_revenue_usd_ac": 931.6248083601346, "mean_cash_margin_usd_ac": 534.081308360133, "breakeven_bu_ac": 129.88689301223846, "breakeven_Mg_ha": 8.152696955607293, "return_p05": 176.98578098135852, "return_median": 271.3141747766614, "return_p95": 382.7675471570618, "mean_revenue_usd_ac_2021dollars": 931.6248083601346, "mean_cash_margin_usd_ac_2021dollars": 534.081308360133, "return_p05_2021dollars": 176.98578098135852, "return_median_2021dollars": 271.3141747766614, "return_p95_2021dollars": 382.7675471570618}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 0.4499999999999999, "quartile_ha": 43942.77, "both_ha": 0.4499999999999999, "disagree_ha": 43942.32, "mean_return_usd_ac": 609.6761863060391, "mean_return_2021usd_ac": 609.6761863060391, "total_return_usd": 264806495.860022, "total_return_2021usd": 264806495.860022, "mean_revenue_usd_ac": 1096.0291863060384, "mean_cash_margin_usd_ac": 802.1926863060386, "breakeven_bu_ac": 81.60285234899328, "breakeven_Mg_ha": 5.122020478631538, "return_p05": 495.991448213363, "return_median": 606.9660291490135, "return_p95": 738.0876437141904, "mean_revenue_usd_ac_2021dollars": 1096.0291863060384, "mean_cash_margin_usd_ac_2021dollars": 802.1926863060386, "return_p05_2021dollars": 495.991448213363, "return_median_2021dollars": 606.9660291490135, "return_p95_2021dollars": 738.0876437141904}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 2.16, "quartile_ha": 43942.77, "both_ha": 2.16, "disagree_ha": 43940.61, "mean_return_usd_ac": 523.8491863060385, "mean_return_2021usd_ac": 523.8491863060385, "total_return_usd": 227528433.1266193, "total_return_2021usd": 227528433.1266193, "mean_revenue_usd_ac": 1096.0291863060384, "mean_cash_margin_usd_ac": 750.3391863060382, "breakeven_bu_ac": 96.00335570469798, "breakeven_Mg_ha": 6.025906445448868, "return_p05": 410.164448213363, "return_median": 521.1390291490135, "return_p95": 652.2606437141905, "mean_revenue_usd_ac_2021dollars": 1096.0291863060384, "mean_cash_margin_usd_ac_2021dollars": 750.3391863060382, "return_p05_2021dollars": 410.164448213363, "return_median_2021dollars": 521.1390291490135, "return_p95_2021dollars": 652.2606437141905}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 6.48, "quartile_ha": 43942.77, "both_ha": 6.48, "disagree_ha": 43936.29, "mean_return_usd_ac": 438.02218630603926, "mean_return_2021usd_ac": 438.02218630603926, "total_return_usd": 190250370.39321712, "total_return_2021usd": 190250370.39321712, "mean_revenue_usd_ac": 1096.0291863060384, "mean_cash_margin_usd_ac": 698.4856863060388, "breakeven_bu_ac": 110.40385906040268, "breakeven_Mg_ha": 6.929792412266198, "return_p05": 324.337448213363, "return_median": 435.3120291490135, "return_p95": 566.4336437141905, "mean_revenue_usd_ac_2021dollars": 1096.0291863060384, "mean_cash_margin_usd_ac_2021dollars": 698.4856863060388, "return_p05_2021dollars": 324.337448213363, "return_median_2021dollars": 435.3120291490135, "return_p95_2021dollars": 566.4336437141905}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 0.09, "quartile_ha": 43942.77, "both_ha": 0.09, "disagree_ha": 43942.68, "mean_return_usd_ac": 774.0805642519449, "mean_return_2021usd_ac": 774.0805642519449, "total_return_usd": 336213823.56241745, "total_return_2021usd": 336213823.56241745, "mean_revenue_usd_ac": 1260.4335642519452, "mean_cash_margin_usd_ac": 966.597064251945, "breakeven_bu_ac": 70.95900204260286, "breakeven_Mg_ha": 4.453930850983946, "return_p05": 643.3431154453674, "return_median": 770.9638835213653, "return_p95": 921.7537402713187, "mean_revenue_usd_ac_2021dollars": 1260.4335642519452, "mean_cash_margin_usd_ac_2021dollars": 966.597064251945, "return_p05_2021dollars": 643.3431154453674, "return_median_2021dollars": 770.9638835213653, "return_p95_2021dollars": 921.7537402713187}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 0.8999999999999999, "quartile_ha": 43942.77, "both_ha": 0.8999999999999999, "disagree_ha": 43941.87, "mean_return_usd_ac": 688.2535642519451, "mean_return_2021usd_ac": 688.2535642519451, "total_return_usd": 298935760.8290151, "total_return_2021usd": 298935760.8290151, "mean_revenue_usd_ac": 1260.4335642519452, "mean_cash_margin_usd_ac": 914.743564251945, "breakeven_bu_ac": 83.48117887365042, "breakeven_Mg_ha": 5.239918648216407, "return_p05": 557.5161154453674, "return_median": 685.1368835213653, "return_p95": 835.9267402713189, "mean_revenue_usd_ac_2021dollars": 1260.4335642519452, "mean_cash_margin_usd_ac_2021dollars": 914.743564251945, "return_p05_2021dollars": 557.5161154453674, "return_median_2021dollars": 685.1368835213653, "return_p95_2021dollars": 835.9267402713189}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "UNL", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 2.16, "quartile_ha": 43942.77, "both_ha": 2.16, "disagree_ha": 43940.61, "mean_return_usd_ac": 602.4265642519451, "mean_return_2021usd_ac": 602.4265642519451, "total_return_usd": 261657698.0956126, "total_return_2021usd": 261657698.0956126, "mean_revenue_usd_ac": 1260.4335642519452, "mean_cash_margin_usd_ac": 862.8900642519445, "breakeven_bu_ac": 96.003355704698, "breakeven_Mg_ha": 6.025906445448869, "return_p05": 471.6891154453674, "return_median": 599.3098835213654, "return_p95": 750.0997402713189, "mean_revenue_usd_ac_2021dollars": 1260.4335642519452, "mean_cash_margin_usd_ac_2021dollars": 862.8900642519445, "return_p05_2021dollars": 471.6891154453674, "return_median_2021dollars": 599.3098835213654, "return_p95_2021dollars": 750.0997402713189}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 30.6, "quartile_ha": 43942.77, "both_ha": 30.6, "disagree_ha": 43912.17, "mean_return_usd_ac": 265.5733083601331, "mean_return_2021usd_ac": 265.5733083601331, "total_return_usd": 115348997.97693367, "total_return_2021usd": 115348997.97693367, "mean_revenue_usd_ac": 931.6248083601346, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 131.47483221476512, "breakeven_Mg_ha": 8.252368191109928, "return_p05": 168.94128098135843, "return_median": 263.2696747766613, "return_p95": 374.7230471570617, "mean_revenue_usd_ac_2021dollars": 931.6248083601346, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 168.94128098135843, "return_median_2021dollars": 263.2696747766613, "return_p95_2021dollars": 374.7230471570617}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 1882.98, "quartile_ha": 43942.77, "both_ha": 1882.98, "disagree_ha": 42059.79, "mean_return_usd_ac": 148.0348083601332, "mean_return_2021usd_ac": 148.0348083601332, "total_return_usd": 64297375.79987954, "total_return_2021usd": 64297375.79987954, "mean_revenue_usd_ac": 931.6248083601346, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 154.6762731938413, "breakeven_Mg_ha": 9.708668460129328, "return_p05": 51.40278098135843, "return_median": 145.7311747766613, "return_p95": 257.18454715706173, "mean_revenue_usd_ac_2021dollars": 931.6248083601346, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 51.40278098135843, "return_median_2021dollars": 145.7311747766613, "return_p95_2021dollars": 257.18454715706173}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 50068.53, "quartile_ha": 43942.77, "both_ha": 43942.77, "disagree_ha": 6125.76, "mean_return_usd_ac": 30.49630836013326, "mean_return_2021usd_ac": 30.49630836013326, "total_return_usd": 13245753.622825388, "total_return_2021usd": 13245753.622825388, "mean_revenue_usd_ac": 931.6248083601346, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 177.87771417291748, "breakeven_Mg_ha": 11.164968729148724, "return_p05": -66.13571901864145, "return_median": 28.19267477666142, "return_p95": 139.64604715706184, "mean_revenue_usd_ac_2021dollars": 931.6248083601346, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": -66.13571901864145, "return_median_2021dollars": 28.19267477666142, "return_p95_2021dollars": 139.64604715706184}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 7.109999999999999, "quartile_ha": 43942.77, "both_ha": 7.109999999999999, "disagree_ha": 43935.66, "mean_return_usd_ac": 429.9776863060394, "mean_return_2021usd_ac": 429.9776863060394, "total_return_usd": 186756325.6793293, "total_return_2021usd": 186756325.6793293, "mean_revenue_usd_ac": 1096.0291863060384, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 111.75360738255034, "breakeven_Mg_ha": 7.01451296244344, "return_p05": 316.29294821336293, "return_median": 427.2675291490134, "return_p95": 558.3891437141904, "mean_revenue_usd_ac_2021dollars": 1096.0291863060384, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 316.29294821336293, "return_median_2021dollars": 427.2675291490134, "return_p95_2021dollars": 558.3891437141904}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 30.6, "quartile_ha": 43942.77, "both_ha": 30.6, "disagree_ha": 43912.17, "mean_return_usd_ac": 312.439186306039, "mean_return_2021usd_ac": 312.439186306039, "total_return_usd": 135704703.50227493, "total_return_2021usd": 135704703.50227493, "mean_revenue_usd_ac": 1096.0291863060384, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 131.47483221476512, "breakeven_Mg_ha": 8.252368191109928, "return_p05": 198.7544482133629, "return_median": 309.7290291490134, "return_p95": 440.8506437141904, "mean_revenue_usd_ac_2021dollars": 1096.0291863060384, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 198.7544482133629, "return_median_2021dollars": 309.7290291490134, "return_p95_2021dollars": 440.8506437141904}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 1048.68, "quartile_ha": 43942.77, "both_ha": 1048.68, "disagree_ha": 42894.09, "mean_return_usd_ac": 194.9006863060392, "mean_return_2021usd_ac": 194.9006863060392, "total_return_usd": 84653081.32522084, "total_return_2021usd": 84653081.32522084, "mean_revenue_usd_ac": 1096.0291863060384, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 151.19605704697986, "breakeven_Mg_ha": 9.490223419776417, "return_p05": 81.21594821336305, "return_median": 192.1905291490135, "return_p95": 323.3121437141905, "mean_revenue_usd_ac_2021dollars": 1096.0291863060384, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 81.21594821336305, "return_median_2021dollars": 192.1905291490135, "return_p95_2021dollars": 323.3121437141905}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 2.43, "quartile_ha": 43942.77, "both_ha": 2.43, "disagree_ha": 43940.34, "mean_return_usd_ac": 594.3820642519446, "mean_return_2021usd_ac": 594.3820642519446, "total_return_usd": 258163653.3817244, "total_return_2021usd": 258163653.3817244, "mean_revenue_usd_ac": 1260.4335642519452, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 97.17704989786988, "breakeven_Mg_ha": 6.099576489081253, "return_p05": 463.6446154453673, "return_median": 591.2653835213653, "return_p95": 742.0552402713188, "mean_revenue_usd_ac_2021dollars": 1260.4335642519452, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 463.6446154453673, "return_median_2021dollars": 591.2653835213653, "return_p95_2021dollars": 742.0552402713188}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 8.01, "quartile_ha": 43942.77, "both_ha": 8.01, "disagree_ha": 43934.76, "mean_return_usd_ac": 476.8435642519449, "mean_return_2021usd_ac": 476.8435642519449, "total_return_usd": 207112031.2046704, "total_return_2021usd": 207112031.2046704, "mean_revenue_usd_ac": 1260.4335642519452, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 114.3259410563175, "breakeven_Mg_ha": 7.175972340095592, "return_p05": 346.1061154453673, "return_median": 473.72688352136527, "return_p95": 624.5167402713188, "mean_revenue_usd_ac_2021dollars": 1260.4335642519452, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 346.1061154453673, "return_median_2021dollars": 473.72688352136527, "return_p95_2021dollars": 624.5167402713188}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "ERS_Heartland", "full_economic_account": true, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 30.6, "quartile_ha": 43942.77, "both_ha": 30.6, "disagree_ha": 43912.17, "mean_return_usd_ac": 359.3050642519449, "mean_return_2021usd_ac": 359.3050642519449, "total_return_usd": 156060409.0276162, "total_return_2021usd": 156060409.0276162, "mean_revenue_usd_ac": 1260.4335642519452, "mean_cash_margin_usd_ac": null, "breakeven_bu_ac": 131.47483221476512, "breakeven_Mg_ha": 8.252368191109928, "return_p05": 228.56761544536744, "return_median": 356.1883835213654, "return_p95": 506.9782402713189, "mean_revenue_usd_ac_2021dollars": 1260.4335642519452, "mean_cash_margin_usd_ac_2021dollars": null, "return_p05_2021dollars": 228.56761544536744, "return_median_2021dollars": 356.1883835213654, "return_p95_2021dollars": 506.9782402713189}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 34.29, "quartile_ha": 43942.77, "both_ha": 34.29, "disagree_ha": 43908.48, "mean_return_usd_ac": 237.4506509526728, "mean_return_2021usd_ac": 237.4506509526728, "total_return_usd": 103134214.90091692, "total_return_2021usd": 103134214.90091692, "mean_revenue_usd_ac": 846.1016509526728, "mean_cash_margin_usd_ac": 324.5416509526726, "breakeven_bu_ac": 132.28836743229843, "breakeven_Mg_ha": 8.303431896903849, "return_p05": 149.68944368726972, "return_median": 235.35849093216385, "return_p95": 336.58044372804346, "mean_revenue_usd_ac_2021dollars": 846.1016509526728, "mean_cash_margin_usd_ac_2021dollars": 324.5416509526726, "return_p05_2021dollars": 149.68944368726972, "return_median_2021dollars": 235.35849093216385, "return_p95_2021dollars": 336.58044372804346}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 2186.55, "quartile_ha": 43942.77, "both_ha": 2186.55, "disagree_ha": 41756.22, "mean_return_usd_ac": 130.04165095267288, "mean_return_2021usd_ac": 130.04165095267288, "total_return_usd": 56482235.452351466, "total_return_2021usd": 56482235.452351466, "mean_revenue_usd_ac": 846.1016509526728, "mean_cash_margin_usd_ac": 232.50165095267292, "breakeven_bu_ac": 155.63337344976284, "breakeven_Mg_ha": 9.768743408122171, "return_p05": 42.28044368726973, "return_median": 127.94949093216384, "return_p95": 229.17144372804347, "mean_revenue_usd_ac_2021dollars": 846.1016509526728, "mean_cash_margin_usd_ac_2021dollars": 232.50165095267292, "return_p05_2021dollars": 42.28044368726973, "return_median_2021dollars": 127.94949093216384, "return_p95_2021dollars": 229.17144372804347}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 0.85, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 56735.55, "quartile_ha": 43942.77, "both_ha": 43942.77, "disagree_ha": 12792.78, "mean_return_usd_ac": 22.63265095267301, "mean_return_2021usd_ac": 22.63265095267301, "total_return_usd": 9830256.00378606, "total_return_2021usd": 9830256.00378606, "mean_revenue_usd_ac": 846.1016509526728, "mean_cash_margin_usd_ac": 140.46165095267295, "breakeven_bu_ac": 178.97837946722726, "breakeven_Mg_ha": 11.2340549193405, "return_p05": -65.12855631273015, "return_median": 20.540490932163948, "return_p95": 121.7624437280436, "mean_revenue_usd_ac_2021dollars": 846.1016509526728, "mean_cash_margin_usd_ac_2021dollars": 140.46165095267295, "return_p05_2021dollars": -65.12855631273015, "return_median_2021dollars": 20.540490932163948, "return_p95_2021dollars": 121.7624437280436}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 7.38, "quartile_ha": 43942.77, "both_ha": 7.38, "disagree_ha": 43935.39, "mean_return_usd_ac": 386.7627070031443, "mean_return_2021usd_ac": 386.7627070031443, "total_return_usd": 167986349.92023236, "total_return_2021usd": 167986349.92023236, "mean_revenue_usd_ac": 995.413707003144, "mean_cash_margin_usd_ac": 473.85370700314417, "breakeven_bu_ac": 112.44511231745366, "breakeven_Mg_ha": 7.057917112368271, "return_p05": 283.5142278673762, "return_median": 384.301342273134, "return_p95": 503.3859926212276, "mean_revenue_usd_ac_2021dollars": 995.413707003144, "mean_cash_margin_usd_ac_2021dollars": 473.85370700314417, "return_p05_2021dollars": 283.5142278673762, "return_median_2021dollars": 384.301342273134, "return_p95_2021dollars": 503.3859926212276}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 34.29, "quartile_ha": 43942.77, "both_ha": 34.29, "disagree_ha": 43908.48, "mean_return_usd_ac": 279.35370700314473, "mean_return_2021usd_ac": 279.35370700314473, "total_return_usd": 121334370.47166708, "total_return_2021usd": 121334370.47166708, "mean_revenue_usd_ac": 995.413707003144, "mean_cash_margin_usd_ac": 381.8137070031448, "breakeven_bu_ac": 132.28836743229843, "breakeven_Mg_ha": 8.303431896903849, "return_p05": 176.1052278673762, "return_median": 276.892342273134, "return_p95": 395.9769926212276, "mean_revenue_usd_ac_2021dollars": 995.413707003144, "mean_cash_margin_usd_ac_2021dollars": 381.8137070031448, "return_p05_2021dollars": 176.1052278673762, "return_median_2021dollars": 276.892342273134, "return_p95_2021dollars": 395.9769926212276}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.0, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 1234.89, "quartile_ha": 43942.77, "both_ha": 1234.89, "disagree_ha": 42707.88, "mean_return_usd_ac": 171.94470700314469, "mean_return_2021usd_ac": 171.94470700314469, "total_return_usd": 74682391.02310157, "total_return_2021usd": 74682391.02310157, "mean_revenue_usd_ac": 995.413707003144, "mean_cash_margin_usd_ac": 289.7737070031445, "breakeven_bu_ac": 152.13162254714317, "breakeven_Mg_ha": 9.548946681439425, "return_p05": 68.69622786737631, "return_median": 169.4833422731341, "return_p95": 288.56799262122775, "mean_revenue_usd_ac_2021dollars": 995.413707003144, "mean_cash_margin_usd_ac_2021dollars": 289.7737070031445, "return_p05_2021dollars": 68.69622786737631, "return_median_2021dollars": 169.4833422731341, "return_p95_2021dollars": 288.56799262122775}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 0.85, "valid_ha": 175770.99, "loss_ha": 2.7, "quartile_ha": 43942.77, "both_ha": 2.7, "disagree_ha": 43940.07, "mean_return_usd_ac": 536.0747630536163, "mean_return_2021usd_ac": 536.0747630536163, "total_return_usd": 232838484.939548, "total_return_2021usd": 232838484.939548, "mean_revenue_usd_ac": 1144.7257630536158, "mean_cash_margin_usd_ac": 623.1657630536168, "breakeven_bu_ac": 97.77835853691624, "breakeven_Mg_ha": 6.137319228146323, "return_p05": 417.3390120474826, "return_median": 533.2441936141039, "return_p95": 670.1915415144117, "mean_revenue_usd_ac_2021dollars": 1144.7257630536158, "mean_cash_margin_usd_ac_2021dollars": 623.1657630536168, "return_p05_2021dollars": 417.3390120474826, "return_median_2021dollars": 533.2441936141039, "return_p95_2021dollars": 670.1915415144117}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 1.0, "valid_ha": 175770.99, "loss_ha": 8.1, "quartile_ha": 43942.77, "both_ha": 8.1, "disagree_ha": 43934.67, "mean_return_usd_ac": 428.66576305361633, "mean_return_2021usd_ac": 428.66576305361633, "total_return_usd": 186186505.49098253, "total_return_2021usd": 186186505.49098253, "mean_revenue_usd_ac": 1144.7257630536158, "mean_cash_margin_usd_ac": 531.1257630536161, "breakeven_bu_ac": 115.03336298460736, "breakeven_Mg_ha": 7.220375562525087, "return_p05": 309.9300120474826, "return_median": 425.8351936141039, "return_p95": 562.7825415144117, "mean_revenue_usd_ac_2021dollars": 1144.7257630536158, "mean_cash_margin_usd_ac_2021dollars": 531.1257630536161, "return_p05_2021dollars": 309.9300120474826, "return_median_2021dollars": 425.8351936141039, "return_p95_2021dollars": 562.7825415144117}, {"year": 2021, "scenario": "M2_HI_sensitivity", "experimental": true, "source": "FINBIN_state", "full_economic_account": false, "price_factor": 1.15, "cost_factor": 1.15, "valid_ha": 175770.99, "loss_ha": 34.29, "quartile_ha": 43942.77, "both_ha": 34.29, "disagree_ha": 43908.48, "mean_return_usd_ac": 321.25676305361645, "mean_return_2021usd_ac": 321.25676305361645, "total_return_usd": 139534526.04241714, "total_return_2021usd": 139534526.04241714, "mean_revenue_usd_ac": 1144.7257630536158, "mean_cash_margin_usd_ac": 439.0857630536165, "breakeven_bu_ac": 132.28836743229843, "breakeven_Mg_ha": 8.303431896903849, "return_p05": 202.5210120474827, "return_median": 318.426193614104, "return_p95": 455.37354151441184, "mean_revenue_usd_ac_2021dollars": 1144.7257630536158, "mean_cash_margin_usd_ac_2021dollars": 439.0857630536165, "return_p05_2021dollars": 202.5210120474827, "return_median_2021dollars": 318.426193614104, "return_p95_2021dollars": 455.37354151441184}]};
// CH4 additive view. CH4_DATA is generated from the executed, audited results.
var ch4Panel = ui.Panel({style: {shown: false, margin: '0'}});
panel.add(ch4Panel);
viewSelect.items().add({label: 'CH4 · economic and yield marginality', value: 'ch4_view'});
// The original app disables its view selector for the 2019/2021 yield-only
// extension. Keep that safeguard, but give CH4 its own always-available entry.
var ch4NavButton = ui.Button({label: 'Open CH4 marginality', onClick: function() {
  if (viewSelect.getValue() === 'ch4_view') {
    viewSelect.setValue('map_view', false);
    switchView('map_view');
  } else {
    viewSelect.setValue('ch4_view', false);
    switchView('ch4_view');
  }
}, style: {margin: '0 6px 0 0', fontSize: '11px'}});
navBar.add(ch4NavButton);
var ch4OldSwitch = switchView;
var ch4PreviousLayers = [];
var ch4PreviousChip = '';
switchView = function(v) {
  ch4OldSwitch(v);
  if (v === 'ch4_view' && !ch4PreviousLayers.length) {
    ch4PreviousChip=mapChip.getValue();
    map.layers().forEach(function(layer) {if (layer!==ch4Layer) {ch4PreviousLayers.push([layer,layer.getShown()]);layer.setShown(false);}});
    legend.style().set('shown',false);
  } else if (v !== 'ch4_view' && ch4PreviousLayers.length) {
    ch4PreviousLayers.forEach(function(r){r[0].setShown(r[1]);});ch4PreviousLayers=[];
    legend.style().set('shown',true);
    mapChip.setValue(ch4PreviousChip);
  }
  ch4Panel.style().set('shown', v === 'ch4_view');
  ch4NavButton.setLabel(v === 'ch4_view' ? 'Back to yield model' : 'Open CH4 marginality');
  if (ch4Layer) ch4Layer.setShown(v === 'ch4_view');
  if (v === 'ch4_view') ch4Refresh();
};
var ch4Layer = null;
var ch4Generation = 0;
ch4Panel.add(kicker('CH4 · EXACT-YEAR BUDGETS', THEME.primary));
ch4Panel.add(ui.Label('Two definitions, reported equally', {fontSize: '17px', fontWeight: 'bold'}));
ch4Panel.add(ui.Label('Economic loss means a negative total economic return. Yield marginality means at or below the annual regional 25th percentile, including ties.', {whiteSpace: 'pre-wrap', fontSize: '12px'}));
var ch4Year = ui.Select({items: CH4_DATA.years.map(function(y) {
  return {label: String(y) + (y === 2021 ? ' · EXPERIMENTAL' : y === 2019 ? ' · economics available' : ' · economics blocked'), value: String(y)};
}), value: '2019', onChange: ch4Refresh, style: {width: '100%'}});
var ch4Scenario = ui.Select({items: ['M1_fixed','M2_HI_sensitivity'], value: 'M1_fixed', onChange: ch4Refresh, style: {width: '100%'}});
var ch4Source = ui.Select({items: ['UNL','ERS_Heartland','FINBIN_county','FINBIN_state'], value: 'UNL', onChange: ch4Refresh, style: {width: '100%'}});
var ch4Definition = ui.Select({items: [
  {label: 'Economic loss / source-account loss', value: 'loss'},
  {label: 'Lowest yield quartile', value: 'quartile'},
  {label: 'Overlap and disagreement', value: 'overlap'}
], value: 'overlap', onChange: ch4Refresh, style: {width: '100%'}});
var ch4Price = ui.Select({items: ['−15%','Baseline','+15%'], value: 'Baseline', onChange: ch4Refresh});
var ch4Cost = ui.Select({items: ['−15%','Baseline','+15%'], value: 'Baseline', onChange: ch4Refresh});
[['Year',ch4Year],['Yield scenario',ch4Scenario],['Economic source',ch4Source],['Marginality definition',ch4Definition],['Price sensitivity',ch4Price],['Cost sensitivity',ch4Cost]].forEach(function(x) {ch4Panel.add(fieldLabel(x[0]));ch4Panel.add(x[1]);});
var ch4Status = ui.Label('', {whiteSpace: 'pre-wrap',fontSize: '12px',margin: '10px 0'});
var ch4Results = ui.Label('', {whiteSpace: 'pre-wrap',fontSize: '12px',margin: '10px 0'});
var ch4Legend = ui.Panel();
ch4Panel.add(ch4Status);ch4Panel.add(ch4Results);ch4Panel.add(ch4Legend);
var ch4Pixel=ui.Label('Click the map to inspect the selected classification.',{fontSize:'12px',whiteSpace:'pre-wrap'});
ch4Panel.add(ch4Pixel);
ch4Panel.add(ui.Label({value: 'Research code and methods (repository access required) ↗',targetUrl: 'https://github.com/njberkowitz95/Yields-and-Fields-CH1/tree/codex/ch4-marginality/ch4_marginality',style: {fontSize: '12px'}}));
ch4Panel.add(ui.Label('FINBIN reports are operator-account proxies with unverified rainfed practice and incomplete opportunity costs. ERS Heartland is a broad all-practice, planted-acre scenario. These are scenario comparisons, not independent profitability validation.', {fontSize: '11px',color: THEME.muted,whiteSpace: 'pre-wrap'}));
function ch4Refresh() {
  if (!ch4Year || !ch4Results) return;
  ch4Generation++;
  ch4Pixel.setValue('Click the map to inspect the selected classification.');
  var y=Number(ch4Year.getValue()), scenario=ch4Scenario.getValue(), source=ch4Source.getValue(), definition=ch4Definition.getValue();
  var pf={'−15%':.85,'Baseline':1,'+15%':1.15}[ch4Price.getValue()];
  var cf={'−15%':.85,'Baseline':1,'+15%':1.15}[ch4Cost.getValue()];
  var annual=CH4_DATA.annual.filter(function(r){return r.year===y && r.scenario===scenario;})[0];
  var cost=CH4_DATA.costs.filter(function(r){return r.year===y && r.source===source;})[0];
  var eligible=CH4_DATA.eligibility.filter(function(r){return r.year===y;})[0];
  mapChip.setValue('CH4 '+y+(y===2021?' · EXPERIMENTAL':''));
  var warning=y===2021 ? 'EXPERIMENTAL 2021. LGRIP2020 proxy; M1 and M2 identical. Excluded from primary temporal summaries.\n' : y===2019 ? '2019 mask source changed from historical years.\n' : '';
  if (ch4Layer) {map.layers().remove(ch4Layer);ch4Layer=null;}
  ch4Legend.clear();
  ch4Results.setValue('Yield-only valid area: '+annual.valid_ha.toFixed(2)+' ha\nLowest-quartile area: '+annual.quartile_ha.toFixed(2)+' ha ('+annual.quartile_percent.toFixed(2)+'%)\nRegional cutoff: '+annual.cutoff_Mg_ha.toFixed(4)+' Mg/ha');
  if (definition!=='quartile' && (!eligible.eligible || !cost)) {
    ch4Status.setValue(warning+(!eligible.eligible ? 'ECONOMICS BLOCKED: no verified exact-year UNL budget matching the selected production system. This blocks all economic sources and sensitivities. Yield-only results remain available.' : 'This source is unavailable or suppressed for the selected year. Select another source or the yield-quartile definition.'));
    return;
  }
  var idx=CH4_DATA.years.indexOf(y)*2+(scenario==='M1_fixed'?0:1);
  var image=ee.Image(CH4_DATA.asset).select([idx]).toDouble().rename('yield');
  image=image.updateMask(image.gte(0));
  var q=image.lte(annual.cutoff_Mg_ha), result=q, palette=['dce6e9','197a91'], max=1;
  var status=warning+'Yield quartiles use the complete annual regional valid footprint. Price, cost and source do not alter this definition.';
  if (definition!=='quartile') {
    if (source==='FINBIN_county') {
      var countyScope=ee.Image(CH4_DATA.county_scope_asset).select(0).eq(1);
      image=image.updateMask(countyScope);q=q.updateMask(countyScope);
    }
    var loss=image.divide(CH4_DATA.mgha_per_buac).multiply(cost.nass_price_usd_bu).multiply(pf).multiply(cost.operator_share).subtract(cost.total_cost_usd_ac*cf).lt(0);
    result=definition==='overlap'?q.add(loss.multiply(2)):loss;
    if (definition==='overlap') {palette=['e2e6e6','e69f00','7a5195','143e64'];max=3;}
    else palette=['e2e6e6','7a5195'];
    var row=CH4_DATA.sensitivity.filter(function(r){return r.year===y && r.scenario===scenario && r.source===source && r.price_factor===pf && r.cost_factor===cf;})[0];
    status=warning+(cost.full_economic_account?'Total economic return < $0/acre.':'FINBIN negative operator-account proxy; incomplete economic opportunity costs.')+'\n'+cost.geography;
    ch4Results.setValue('Compared valid area: '+row.valid_ha.toFixed(2)+' ha\nLoss area: '+row.loss_ha.toFixed(2)+' ha\nQuartile area in this domain: '+row.quartile_ha.toFixed(2)+' ha\nBoth definitions: '+row.both_ha.toFixed(2)+' ha\nDisagreement: '+row.disagree_ha.toFixed(2)+' ha\nMean return: $'+row.mean_return_usd_ac.toFixed(2)+'/acre nominal; $'+row.mean_return_2021usd_ac.toFixed(2)+' in 2021 dollars');
  }
  ch4Status.setValue(status);
  var labels=definition==='overlap'?['Neither','Quartile only','Loss only','Both']:definition==='quartile'?['Above quartile','At/below quartile']:['Nonnegative return','Negative return'];
  labels.forEach(function(label,i){ch4Legend.add(ui.Panel([ui.Label('■',{color:'#'+palette[i],fontWeight:'bold'}),ui.Label(label,{color:THEME.primary,fontSize:'12px'})],ui.Panel.Layout.flow('horizontal'),{margin:'0'}));});
  ch4Layer=ui.Map.Layer(result,{min:0,max:max,palette:palette},'CH4 '+y+' '+scenario+' '+definition,true);
  map.layers().add(ch4Layer);
}
var ch4PriorQuery=querySelectedLocation;
querySelectedLocation=function(coords) {
  if (viewSelect.getValue()!=='ch4_view') {ch4PriorQuery(coords);return;}
  if (!ch4Layer) {ch4Pixel.setValue('No economic layer is available for these settings.');return;}
  var generation=ch4Generation, definition=ch4Definition.getValue();
  ch4Pixel.setValue('Reading the native 30 m classification…');
  ch4Layer.getEeObject().reduceRegion({reducer:ee.Reducer.first(),geometry:ee.Geometry.Point([coords.lon,coords.lat]),crs:'EPSG:5070',crsTransform:[30,0,-111285,0,-30,2047275],maxPixels:1e6}).evaluate(function(value,error) {
    if (generation!==ch4Generation || viewSelect.getValue()!=='ch4_view') return;
    if (error) {ch4Pixel.setValue('Pixel lookup failed: '+error);return;}
    if (!value || value.yield===null || value.yield===undefined) {ch4Pixel.setValue('No valid crop observation in the selected analysis domain.');return;}
    var labels=definition==='overlap'?['Neither definition','Quartile only','Loss only','Both definitions']:definition==='quartile'?['Above annual quartile','At/below annual quartile']:['Nonnegative return','Negative return'];
    ch4Pixel.setValue('Selected native pixel: '+labels[value.yield]);
  });
};
