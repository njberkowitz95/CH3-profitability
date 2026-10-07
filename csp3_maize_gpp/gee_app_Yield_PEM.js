
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

var CH4_DATA = {
"years":[
2001,
2003,
2005,
2007,
2009,
2011,
2013,
2015,
2017,
2019,
2021
],
"mgha_per_buac":0.06276766474688954,
"asset":"projects/ee-njberkowitz95/assets/ch4_verified_yields_corefilter_20260928",
"county_scope_asset":"projects/ee-njberkowitz95/assets/ch4_finbin_county_scope_corefilter_20260928",
"annual":[
{"year":2001,"scenario":"M1_fixed","cutoff_Mg_ha":7.611388444900513,"crop_ha":326203.74,"valid_ha":317267.64,"missing_ha":8936.1},
{"year":2001,"scenario":"M2_HI_sensitivity","cutoff_Mg_ha":7.611388444900513,"crop_ha":326203.74,"valid_ha":317267.64,"missing_ha":8936.1},
{"year":2003,"scenario":"M1_fixed","cutoff_Mg_ha":7.036578178405762,"crop_ha":289853.73,"valid_ha":282064.23,"missing_ha":7789.5},
{"year":2003,"scenario":"M2_HI_sensitivity","cutoff_Mg_ha":7.036578178405762,"crop_ha":289853.73,"valid_ha":282064.23,"missing_ha":7789.5},
{"year":2005,"scenario":"M1_fixed","cutoff_Mg_ha":7.546361565589905,"crop_ha":316100.7,"valid_ha":307240.74,"missing_ha":8859.96},
{"year":2005,"scenario":"M2_HI_sensitivity","cutoff_Mg_ha":6.536786317825317,"crop_ha":316100.7,"valid_ha":307240.74,"missing_ha":8859.96},
{"year":2007,"scenario":"M1_fixed","cutoff_Mg_ha":8.251138687133789,"crop_ha":321235.47,"valid_ha":312313.68,"missing_ha":8921.789999999999},
{"year":2007,"scenario":"M2_HI_sensitivity","cutoff_Mg_ha":7.692498683929443,"crop_ha":321235.47,"valid_ha":312313.68,"missing_ha":8921.789999999999},
{"year":2009,"scenario":"M1_fixed","cutoff_Mg_ha":8.97908878326416,"crop_ha":265079.88,"valid_ha":257156.19,"missing_ha":7923.69},
{"year":2009,"scenario":"M2_HI_sensitivity","cutoff_Mg_ha":8.97908878326416,"crop_ha":265079.88,"valid_ha":257156.19,"missing_ha":7923.69},
{"year":2011,"scenario":"M1_fixed","cutoff_Mg_ha":4.4510252475738525,"crop_ha":346792.76999999996,"valid_ha":336546.99,"missing_ha":10245.779999999999},
{"year":2011,"scenario":"M2_HI_sensitivity","cutoff_Mg_ha":4.389649152755737,"crop_ha":346792.76999999996,"valid_ha":336546.99,"missing_ha":10245.779999999999},
{"year":2013,"scenario":"M1_fixed","cutoff_Mg_ha":5.01600980758667,"crop_ha":310377.06,"valid_ha":301600.89,"missing_ha":8776.17},
{"year":2013,"scenario":"M2_HI_sensitivity","cutoff_Mg_ha":5.588380813598633,"crop_ha":310377.06,"valid_ha":301600.89,"missing_ha":8776.17},
{"year":2015,"scenario":"M1_fixed","cutoff_Mg_ha":8.926181077957153,"crop_ha":315754.74,"valid_ha":306756.72,"missing_ha":8998.02},
{"year":2015,"scenario":"M2_HI_sensitivity","cutoff_Mg_ha":10.037081003189087,"crop_ha":315754.74,"valid_ha":306756.72,"missing_ha":8998.02},
{"year":2017,"scenario":"M1_fixed","cutoff_Mg_ha":8.153589725494385,"crop_ha":323178.20999999996,"valid_ha":314033.94,"missing_ha":9144.27},
{"year":2017,"scenario":"M2_HI_sensitivity","cutoff_Mg_ha":8.6798837184906,"crop_ha":323178.20999999996,"valid_ha":314033.94,"missing_ha":9144.27},
{"year":2019,"scenario":"M1_fixed","cutoff_Mg_ha":9.829856395721436,"crop_ha":353360.33999999997,"valid_ha":352962.18,"missing_ha":398.15999999999997},
{"year":2019,"scenario":"M2_HI_sensitivity","cutoff_Mg_ha":9.472877025604248,"crop_ha":353360.33999999997,"valid_ha":352962.18,"missing_ha":398.15999999999997},
{"year":2021,"scenario":"M1_fixed","cutoff_Mg_ha":11.095331192016602,"crop_ha":187807.41,"valid_ha":175770.99,"missing_ha":12036.42},
{"year":2021,"scenario":"M2_HI_sensitivity","cutoff_Mg_ha":11.095331192016602,"crop_ha":187807.41,"valid_ha":175770.99,"missing_ha":12036.42}
],
"costs":[
{"year":2001,"source":"UNL","cash_cost_usd_ac":null,"total_cost_usd_ac":231.97,"operator_share":1.0,"nass_price_usd_bu":1.94,"to_2021_dollars":1.5300395256916999,"geography":"Geography not explicitly Eastern Nebraska","account":"UNL published total economic cost; cash and ownership/opportunity categories are not separable in this publication","sample_n":null,"full_economic_account":true},
{"year":2011,"source":"UNL","cash_cost_usd_ac":249.15,"total_cost_usd_ac":347.88,"operator_share":1.0,"nass_price_usd_bu":6.11,"to_2021_dollars":1.2046377017769263,"geography":"State/rainfed","account":"UNL total economic cost; cash excludes machinery ownership and real-estate opportunity","sample_n":null,"full_economic_account":true},
{"year":2013,"source":"UNL","cash_cost_usd_ac":323.93,"total_cost_usd_ac":450.19,"operator_share":1.0,"nass_price_usd_bu":4.47,"to_2021_dollars":1.16317603677932,"geography":"Dryland (State)","account":"UNL total economic cost; cash excludes machinery ownership and real-estate opportunity","sample_n":null,"full_economic_account":true},
{"year":2015,"source":"UNL","cash_cost_usd_ac":300.43,"total_cost_usd_ac":478.01,"operator_share":1.0,"nass_price_usd_bu":3.57,"to_2021_dollars":1.143251327963817,"geography":"Dryland (State)","account":"UNL total economic cost; cash excludes machinery ownership and real-estate opportunity","sample_n":null,"full_economic_account":true},
{"year":2017,"source":"UNL","cash_cost_usd_ac":367.23,"total_cost_usd_ac":654.49,"operator_share":1.0,"nass_price_usd_bu":3.35,"to_2021_dollars":1.1054585509138382,"geography":"Eastern Nebraska","account":"UNL total economic cost; cash excludes machinery ownership and real-estate opportunity","sample_n":null,"full_economic_account":true},
{"year":2019,"source":"UNL","cash_cost_usd_ac":363.18,"total_cost_usd_ac":565.52,"operator_share":1.0,"nass_price_usd_bu":3.52,"to_2021_dollars":1.059896658413421,"geography":"Eastern Nebraska","account":"UNL total economic cost; cash excludes machinery ownership and real-estate opportunity","sample_n":null,"full_economic_account":true},
{"year":2021,"source":"UNL","cash_cost_usd_ac":345.69,"total_cost_usd_ac":572.18,"operator_share":1.0,"nass_price_usd_bu":5.96,"to_2021_dollars":1.0,"geography":"Eastern Nebraska","account":"UNL total economic cost; cash excludes machinery ownership and real-estate opportunity","sample_n":null,"full_economic_account":true},
{"year":2001,"source":"ERS_Heartland","cash_cost_usd_ac":null,"total_cost_usd_ac":344.93,"operator_share":1.0,"nass_price_usd_bu":1.94,"to_2021_dollars":1.5300395256916999,"geography":"ERS Heartland region; all production practices","account":"Sector economic costs per planted acre; operating costs are not cash costs","sample_n":null,"full_economic_account":true},
{"year":2009,"source":"ERS_Heartland","cash_cost_usd_ac":null,"total_cost_usd_ac":560.79,"operator_share":1.0,"nass_price_usd_bu":3.58,"to_2021_dollars":1.2630455352689747,"geography":"ERS Heartland region; all production practices","account":"Sector economic costs per planted acre; operating costs are not cash costs","sample_n":null,"full_economic_account":true},
{"year":2011,"source":"ERS_Heartland","cash_cost_usd_ac":null,"total_cost_usd_ac":637.9,"operator_share":1.0,"nass_price_usd_bu":6.11,"to_2021_dollars":1.2046377017769263,"geography":"ERS Heartland region; all production practices","account":"Sector economic costs per planted acre; operating costs are not cash costs","sample_n":null,"full_economic_account":true},
{"year":2013,"source":"ERS_Heartland","cash_cost_usd_ac":null,"total_cost_usd_ac":708.86,"operator_share":1.0,"nass_price_usd_bu":4.47,"to_2021_dollars":1.16317603677932,"geography":"ERS Heartland region; all production practices","account":"Sector economic costs per planted acre; operating costs are not cash costs","sample_n":null,"full_economic_account":true},
{"year":2015,"source":"ERS_Heartland","cash_cost_usd_ac":null,"total_cost_usd_ac":708.4,"operator_share":1.0,"nass_price_usd_bu":3.57,"to_2021_dollars":1.143251327963817,"geography":"ERS Heartland region; all production practices","account":"Sector economic costs per planted acre; operating costs are not cash costs","sample_n":null,"full_economic_account":true},
{"year":2017,"source":"ERS_Heartland","cash_cost_usd_ac":null,"total_cost_usd_ac":698.83,"operator_share":1.0,"nass_price_usd_bu":3.35,"to_2021_dollars":1.1054585509138382,"geography":"ERS Heartland region; all production practices","account":"Sector economic costs per planted acre; operating costs are not cash costs","sample_n":null,"full_economic_account":true},
{"year":2019,"source":"ERS_Heartland","cash_cost_usd_ac":null,"total_cost_usd_ac":724.79,"operator_share":1.0,"nass_price_usd_bu":3.52,"to_2021_dollars":1.059896658413421,"geography":"ERS Heartland region; all production practices","account":"Sector economic costs per planted acre; operating costs are not cash costs","sample_n":null,"full_economic_account":true},
{"year":2021,"source":"ERS_Heartland","cash_cost_usd_ac":null,"total_cost_usd_ac":783.59,"operator_share":1.0,"nass_price_usd_bu":5.96,"to_2021_dollars":1.0,"geography":"ERS Heartland region; all production practices","account":"Sector economic costs per planted acre; operating costs are not cash costs","sample_n":null,"full_economic_account":true},
{"year":2001,"source":"FINBIN_county","cash_cost_usd_ac":178.10999999999999,"total_cost_usd_ac":211.16,"operator_share":0.8138,"nass_price_usd_bu":1.94,"to_2021_dollars":1.5300395256916999,"geography":"Gage, Johnson, Lancaster, Pawnee participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":6.0,"full_economic_account":false},
{"year":2009,"source":"FINBIN_county","cash_cost_usd_ac":299.96,"total_cost_usd_ac":378.46,"operator_share":0.8094,"nass_price_usd_bu":3.58,"to_2021_dollars":1.2630455352689747,"geography":"Gage, Johnson, Lancaster, Pawnee participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":6.0,"full_economic_account":false},
{"year":2011,"source":"FINBIN_county","cash_cost_usd_ac":355.13,"total_cost_usd_ac":425.84999999999997,"operator_share":0.835,"nass_price_usd_bu":6.11,"to_2021_dollars":1.2046377017769263,"geography":"Gage, Johnson, Lancaster, Pawnee participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":8.0,"full_economic_account":false},
{"year":2013,"source":"FINBIN_county","cash_cost_usd_ac":434.26,"total_cost_usd_ac":516.24,"operator_share":0.8747,"nass_price_usd_bu":4.47,"to_2021_dollars":1.16317603677932,"geography":"Gage, Johnson, Lancaster, Pawnee participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":5.0,"full_economic_account":false},
{"year":2015,"source":"FINBIN_county","cash_cost_usd_ac":428.15,"total_cost_usd_ac":504.01,"operator_share":0.9087999999999999,"nass_price_usd_bu":3.57,"to_2021_dollars":1.143251327963817,"geography":"Gage, Johnson, Lancaster, Pawnee participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":5.0,"full_economic_account":false},
{"year":2019,"source":"FINBIN_county","cash_cost_usd_ac":470.64,"total_cost_usd_ac":551.5,"operator_share":0.9326000000000001,"nass_price_usd_bu":3.52,"to_2021_dollars":1.059896658413421,"geography":"Gage, Johnson, Lancaster, Pawnee participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":5.0,"full_economic_account":false},
{"year":2001,"source":"FINBIN_state","cash_cost_usd_ac":188.31,"total_cost_usd_ac":231.13,"operator_share":0.787,"nass_price_usd_bu":1.94,"to_2021_dollars":1.5300395256916999,"geography":"Nebraska statewide participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":60.0,"full_economic_account":false},
{"year":2009,"source":"FINBIN_state","cash_cost_usd_ac":343.45,"total_cost_usd_ac":422.2,"operator_share":0.8337,"nass_price_usd_bu":3.58,"to_2021_dollars":1.2630455352689747,"geography":"Nebraska statewide participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":60.0,"full_economic_account":false},
{"year":2011,"source":"FINBIN_state","cash_cost_usd_ac":389.13,"total_cost_usd_ac":468.05,"operator_share":0.8181999999999999,"nass_price_usd_bu":6.11,"to_2021_dollars":1.2046377017769263,"geography":"Nebraska statewide participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":64.0,"full_economic_account":false},
{"year":2013,"source":"FINBIN_state","cash_cost_usd_ac":484.46999999999997,"total_cost_usd_ac":587.5799999999999,"operator_share":0.8459,"nass_price_usd_bu":4.47,"to_2021_dollars":1.16317603677932,"geography":"Nebraska statewide participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":58.0,"full_economic_account":false},
{"year":2015,"source":"FINBIN_state","cash_cost_usd_ac":495.65,"total_cost_usd_ac":591.6899999999999,"operator_share":0.8698,"nass_price_usd_bu":3.57,"to_2021_dollars":1.143251327963817,"geography":"Nebraska statewide participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":52.0,"full_economic_account":false},
{"year":2017,"source":"FINBIN_state","cash_cost_usd_ac":501.36,"total_cost_usd_ac":603.89,"operator_share":0.8896,"nass_price_usd_bu":3.35,"to_2021_dollars":1.1054585509138382,"geography":"Nebraska statewide participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":54.0,"full_economic_account":false},
{"year":2019,"source":"FINBIN_state","cash_cost_usd_ac":550.1999999999999,"total_cost_usd_ac":652.8599999999999,"operator_share":0.9115000000000001,"nass_price_usd_bu":3.52,"to_2021_dollars":1.059896658413421,"geography":"Nebraska statewide participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":63.0,"full_economic_account":false},
{"year":2021,"source":"FINBIN_state","cash_cost_usd_ac":613.5999999999999,"total_cost_usd_ac":716.06,"operator_share":0.9081999999999999,"nass_price_usd_bu":5.96,"to_2021_dollars":1.0,"geography":"Nebraska statewide participating farms","account":"Operator direct + overhead + labor/management; owned-land and equity opportunity costs not established","sample_n":52.0,"full_economic_account":false}
],
"eligibility":[
{"year":2001,"eligible":true,"status":"verified_approximate_original","original_recovered":true,"source_url":"https://digitalcommons.unl.edu/cgi/viewcontent.cgi?article=3035&context=extensionhist","file":"unl_2001.pdf","sha256":"498daecae9221687f51958187452e1ff908f5894ec222b2b12445b5921949b4b","publication_year":2001.0,"publication_title":"Nebraska Crop Budgets 2001","review_date":"2026-09-29","review_method":"Original PDF text and rendered-page visual inspection","strict_system_match":false,"review_note":"All dryland corn budgets reviewed. Conventional corn is continuous; corn after soybean is no-till. No selected-system match.","budget_number":15.0,"pdf_page":29.0,"printed_page":15.0,"title":"Corn, Dryland, No-Till, After Soybean","assumed_yield_bu_ac":95.0,"crop":null,"water":null,"tillage":"No-till","rotation":"Corn after soybean","geography":"Geography not explicitly Eastern Nebraska","repository_record_id":2024.0,"repository_online_date":"2012-01-13","landing_url":"https://digitalcommons.unl.edu/extensionhist/2024/","strict_eligible":false,"calculation_eligible":true,"match_designation":"Approximate","selection_rationale":"User-authorized priority: dryland corn after soybean; retain original production year; no invented tillage adjustment","mismatch_fields":"tillage: no-till instead of conventional; geography: not specifically Eastern Nebraska","actual_system":"Corn, Dryland, No-Till, After Soybean","policy":"closest_rotation","unl_full_return_available":true},
{"year":2003,"eligible":false,"status":"matching_original_not_recovered","original_recovered":false,"source_url":null,"file":null,"sha256":null,"publication_year":null,"publication_title":null,"review_date":"2026-09-29","review_method":"Archive indexes and targeted publication searches","strict_system_match":false,"review_note":"EC03-872-S is cited on Robert Klein's UNL biography; original PDF not recovered. Bibliographic evidence does not enable calculations.","budget_number":null,"pdf_page":null,"printed_page":null,"title":null,"assumed_yield_bu_ac":null,"crop":null,"water":null,"tillage":null,"rotation":null,"geography":null,"repository_record_id":null,"repository_online_date":null,"landing_url":null,"strict_eligible":false,"calculation_eligible":false,"match_designation":"Unavailable","selection_rationale":null,"mismatch_fields":null,"actual_system":null,"policy":"closest_rotation","unl_full_return_available":null},
{"year":2005,"eligible":false,"status":"matching_original_not_recovered","original_recovered":false,"source_url":null,"file":null,"sha256":null,"publication_year":null,"publication_title":null,"review_date":"2026-09-29","review_method":"Archive indexes and targeted publication searches","strict_system_match":false,"review_note":"Original exact-year EC872 PDF not recovered. Search hits for adjacent-year editions or EC05-838 alternative crops are ineligible; existence is not ruled out.","budget_number":null,"pdf_page":null,"printed_page":null,"title":null,"assumed_yield_bu_ac":null,"crop":null,"water":null,"tillage":null,"rotation":null,"geography":null,"repository_record_id":null,"repository_online_date":null,"landing_url":null,"strict_eligible":false,"calculation_eligible":false,"match_designation":"Unavailable","selection_rationale":null,"mismatch_fields":null,"actual_system":null,"policy":"closest_rotation","unl_full_return_available":null},
{"year":2007,"eligible":false,"status":"matching_original_not_recovered","original_recovered":false,"source_url":null,"file":null,"sha256":null,"publication_year":null,"publication_title":null,"review_date":"2026-09-29","review_method":"Archive indexes and targeted publication searches","strict_system_match":false,"review_note":"Original exact-year EC872 PDF not recovered. Search hits for adjacent-year editions or EC05-838 alternative crops are ineligible; existence is not ruled out.","budget_number":null,"pdf_page":null,"printed_page":null,"title":null,"assumed_yield_bu_ac":null,"crop":null,"water":null,"tillage":null,"rotation":null,"geography":null,"repository_record_id":null,"repository_online_date":null,"landing_url":null,"strict_eligible":false,"calculation_eligible":false,"match_designation":"Unavailable","selection_rationale":null,"mismatch_fields":null,"actual_system":null,"policy":"closest_rotation","unl_full_return_available":null},
{"year":2009,"eligible":true,"status":"verified_approximate_original","original_recovered":true,"source_url":"https://cap.unl.edu/sites/unl.edu.ianr.agecon.center-for-ag-profitability/files/media/file/Crop-Budgets-ec09-872.pdf","file":"unl_2009.pdf","sha256":"1c8b75dbfd4a0d4279a8cc5c063c8bad553b4b0ea3753ceeebe1df76d8532e80","publication_year":2009.0,"publication_title":"Nebraska Crop Budgets 2009","review_date":"2026-09-29","review_method":"Original PDF text and rendered-page visual inspection","strict_system_match":false,"review_note":"All dryland corn budgets reviewed. Conventional corn is continuous; corn after soybean is no-till. No selected-system match.","budget_number":13.0,"pdf_page":19.0,"printed_page":17.0,"title":"Corn, Rainfed, No-Till, Bt ECB After Soybean","assumed_yield_bu_ac":110.0,"crop":null,"water":null,"tillage":"No-till","rotation":"Corn after soybean","geography":"State/rainfed","repository_record_id":null,"repository_online_date":null,"landing_url":null,"strict_eligible":false,"calculation_eligible":true,"match_designation":"Approximate","selection_rationale":"User-authorized priority: dryland corn after soybean; retain original production year; no invented tillage adjustment","mismatch_fields":"tillage: no-till instead of conventional; geography: not specifically Eastern Nebraska","actual_system":"Corn, Rainfed, No-Till, Bt ECB After Soybean","policy":"closest_rotation","unl_full_return_available":false},
{"year":2011,"eligible":true,"status":"verified_approximate_original","original_recovered":true,"source_url":"https://cap.unl.edu/sites/unl.edu.ianr.agecon.center-for-ag-profitability/files/media/file/Crop-Budgets-EC11-872.pdf","file":"unl_2011.pdf","sha256":"b8a2152dcc047ac3b2274d4353517f6ffb1f543bc5c93068b79cb9548e255ac9","publication_year":2011.0,"publication_title":"Nebraska Crop Budgets 2011","review_date":"2026-09-29","review_method":"Original PDF text and rendered-page visual inspection","strict_system_match":false,"review_note":"All dryland corn budgets reviewed. Conventional corn is continuous; corn after soybean is no-till. No selected-system match.","budget_number":11.0,"pdf_page":19.0,"printed_page":19.0,"title":"Corn, No-Till, Bt ECB After Soybean, Rainfed","assumed_yield_bu_ac":115.0,"crop":null,"water":null,"tillage":"No-till","rotation":"Corn after soybean","geography":"State/rainfed","repository_record_id":null,"repository_online_date":null,"landing_url":null,"strict_eligible":false,"calculation_eligible":true,"match_designation":"Approximate","selection_rationale":"User-authorized priority: dryland corn after soybean; retain original production year; no invented tillage adjustment","mismatch_fields":"tillage: no-till instead of conventional; geography: not specifically Eastern Nebraska","actual_system":"Corn, No-Till, Bt ECB After Soybean, Rainfed","policy":"closest_rotation","unl_full_return_available":true},
{"year":2013,"eligible":true,"status":"verified_approximate_original","original_recovered":true,"source_url":"https://digitalcommons.unl.edu/cgi/viewcontent.cgi?article=5325&context=extensionhist","file":"unl_2013.pdf","sha256":"ffed1c52df62b67f7248ac74401b9ea85fd39ad4ec2730c1277998734f856994","publication_year":2013.0,"publication_title":"Nebraska Crop Budgets 2013","review_date":"2026-09-29","review_method":"Original PDF text and rendered-page visual inspection","strict_system_match":false,"review_note":"All dryland corn budgets reviewed. Conventional corn is continuous; corn after soybean is no-till. No selected-system match.","budget_number":11.0,"pdf_page":20.0,"printed_page":19.0,"title":"Corn, No-Till, Bt ECB After Soybean, Dryland","assumed_yield_bu_ac":115.0,"crop":null,"water":null,"tillage":"No-till","rotation":"Corn after soybean","geography":"Dryland (State)","repository_record_id":null,"repository_online_date":null,"landing_url":null,"strict_eligible":false,"calculation_eligible":true,"match_designation":"Approximate","selection_rationale":"User-authorized priority: dryland corn after soybean; retain original production year; no invented tillage adjustment","mismatch_fields":"tillage: no-till instead of conventional; geography: not specifically Eastern Nebraska","actual_system":"Corn, No-Till, Bt ECB After Soybean, Dryland","policy":"closest_rotation","unl_full_return_available":true},
{"year":2015,"eligible":true,"status":"verified_approximate_original","original_recovered":true,"source_url":"https://cap.unl.edu/sites/unl.edu.ianr.agecon.center-for-ag-profitability/files/media/file/2015-Crop-Budget-EC872.pdf","file":"unl_2015.pdf","sha256":"f1b374b5075e3e9ed08b42576466fef8fbd5afccebf45fd4e5a0b9c4f0c67445","publication_year":2015.0,"publication_title":"Nebraska Crop Budgets 2015","review_date":"2026-09-29","review_method":"Original PDF text and rendered-page visual inspection","strict_system_match":false,"review_note":"All dryland corn budgets reviewed. Conventional corn is continuous; corn after soybean is no-till. No selected-system match.","budget_number":18.0,"pdf_page":27.0,"printed_page":26.0,"title":"Corn, No-Till, Bt ECB After Soybean, Dryland","assumed_yield_bu_ac":125.0,"crop":null,"water":null,"tillage":"No-till","rotation":"Corn after soybean","geography":"Dryland (State)","repository_record_id":null,"repository_online_date":null,"landing_url":null,"strict_eligible":false,"calculation_eligible":true,"match_designation":"Approximate","selection_rationale":"User-authorized priority: dryland corn after soybean; retain original production year; no invented tillage adjustment","mismatch_fields":"tillage: no-till instead of conventional; geography: not specifically Eastern Nebraska","actual_system":"Corn, No-Till, Bt ECB After Soybean, Dryland","policy":"closest_rotation","unl_full_return_available":true},
{"year":2017,"eligible":true,"status":"verified_approximate_original","original_recovered":true,"source_url":"https://cap.unl.edu/sites/unl.edu.ianr.agecon.center-for-ag-profitability/files/media/file/2017-crop-budgets.pdf","file":"unl_2017.pdf","sha256":"8543fc37829cd7e5dd1d2f903578dad96ffc6831c17d2f61e0715e790d86d395","publication_year":2017.0,"publication_title":"Nebraska Crop Budgets 2017","review_date":"2026-09-29","review_method":"Original PDF text and rendered-page visual inspection","strict_system_match":false,"review_note":"All dryland corn budgets reviewed. Conventional corn is continuous; corn after soybean is no-till. No selected-system match.","budget_number":22.0,"pdf_page":74.0,"printed_page":33.0,"title":"Corn, Eastern Nebraska No-Till, Bt & ECB, after Soybeans, Dryland","assumed_yield_bu_ac":170.0,"crop":null,"water":null,"tillage":"No-till","rotation":"Corn after soybean","geography":"Eastern Nebraska","repository_record_id":null,"repository_online_date":null,"landing_url":null,"strict_eligible":false,"calculation_eligible":true,"match_designation":"Approximate","selection_rationale":"User-authorized priority: dryland corn after soybean; retain original production year; no invented tillage adjustment","mismatch_fields":"tillage: no-till instead of conventional","actual_system":"Corn, Eastern Nebraska No-Till, Bt & ECB, after Soybeans, Dryland","policy":"closest_rotation","unl_full_return_available":true},
{"year":2019,"eligible":true,"status":"verified_exact_original","original_recovered":true,"source_url":"https://cap.unl.edu/sites/unl.edu.ianr.agecon.center-for-ag-profitability/files/media/file/2019-nebraska-crop-budgets%20%281%29.pdf","file":"unl_2019.pdf","sha256":"6a0693e0c7f8c0f6bcee620595b45fa1214e342147fbd0de40df2e60eab5dd09","publication_year":2019.0,"publication_title":"Nebraska Crop Budgets 2019","review_date":"2026-09-29","review_method":"Original PDF text and rendered-page visual inspection","strict_system_match":true,"review_note":"Verified original Eastern Nebraska dryland conventional-tillage corn after soybean.","budget_number":18.0,"pdf_page":36.0,"printed_page":30.0,"title":"2019 Budget 18 Corn, Eastern Nebraska, Conventional Tillage, in Corn/Soybean Rotation, Dryland","assumed_yield_bu_ac":160.0,"crop":"corn","water":"dryland","tillage":"conventional","rotation":"corn-soybean","geography":"Eastern Nebraska","repository_record_id":null,"repository_online_date":null,"landing_url":null,"strict_eligible":true,"calculation_eligible":true,"match_designation":"Exact","selection_rationale":"Exact selected production system","mismatch_fields":null,"actual_system":"2019 Budget 18 Corn, Eastern Nebraska, Conventional Tillage, in Corn/Soybean Rotation, Dryland","policy":"closest_rotation","unl_full_return_available":true},
{"year":2021,"eligible":true,"status":"verified_exact_original","original_recovered":true,"source_url":"https://cap.unl.edu/sites/unl.edu.ianr.agecon.center-for-ag-profitability/files/media/file/2021-all-nebraska-crop-budgets-updated-021521%20%282%29.pdf","file":"unl_2021.pdf","sha256":"6f8182a9f7cb98b806308a3c378d4e7c9a2ed78b974aad95f93bf9ea87b0e6b4","publication_year":2021.0,"publication_title":"Nebraska Crop Budgets 2021","review_date":"2026-09-29","review_method":"Original PDF text and rendered-page visual inspection","strict_system_match":true,"review_note":"Verified original Eastern Nebraska dryland conventional-tillage corn after soybean.","budget_number":18.0,"pdf_page":30.0,"printed_page":30.0,"title":"2021 Budget 18 Corn, Eastern Nebraska, Conventional Tillage, in Corn/Soybean Rotation, Dryland","assumed_yield_bu_ac":170.0,"crop":"corn","water":"dryland","tillage":"conventional","rotation":"corn-soybean","geography":"Eastern Nebraska","repository_record_id":null,"repository_online_date":null,"landing_url":null,"strict_eligible":true,"calculation_eligible":true,"match_designation":"Exact","selection_rationale":"Exact selected production system","mismatch_fields":null,"actual_system":"2021 Budget 18 Corn, Eastern Nebraska, Conventional Tillage, in Corn/Soybean Rotation, Dryland","policy":"closest_rotation","unl_full_return_available":true}
],
"sensitivity":[
[2019,"M1_fixed","UNL",0.85,0.85,352962.18,144884.16,88240.59,88240.59,56643.57,-0.5804453550402492,-506257.78753074334,480.11155464495965,171.4085546449597,160.6590909090909,10.084195956721867,-64.81320735844271,6.0076984049172495,71.67889864342379],
[2019,"M1_fixed","UNL",0.85,1.0,352962.18,341933.4,88240.59,88240.59,253692.81,-85.40844535504023,-74492267.37094796,480.11155464495965,116.93155464495952,189.01069518716577,11.863759949084548,-149.64120735844276,-78.82030159508278,-13.14910135657624],
[2019,"M1_fixed","UNL",0.85,1.15,352962.18,352585.44,88240.59,88240.59,264344.85,-170.23644535504042,-148478276.95436534,480.11155464495965,62.45455464495968,217.36229946524065,13.64332394144723,-234.46920735844276,-163.64830159508276,-97.9771013565762],
[2019,"M1_fixed","UNL",1.0,0.85,352962.18,16637.399999999998,88240.59,16637.399999999998,71603.19,84.14512311171734,73390412.18632223,564.8371231117172,256.1341231117173,136.56022727272725,8.571566563213585,8.577167813596834,91.89588047637324,169.15611605108683],
[2019,"M1_fixed","UNL",1.0,1.0,352962.18,144884.16,88240.59,88240.59,56643.57,-0.6828768882826706,-595597.3970950135,564.8371231117172,201.6571231117172,160.6590909090909,10.084195956721867,-76.2508321864032,7.067880476373205,84.32811605108681],
[2019,"M1_fixed","UNL",1.0,1.15,352962.18,335572.29,88240.59,88240.59,247331.7,-85.5108768882827,-74581606.98051226,564.8371231117172,147.18012311171736,184.7579545454545,11.596825350230146,-161.07883218640316,-77.76011952362677,-0.4998839489131662],
[2019,"M1_fixed","UNL",1.15,0.85,352962.18,14563.53,88240.59,14563.53,73677.06,168.87069157847498,147287082.16017523,649.5626915784751,340.859691578475,118.748023715415,7.453536141924857,81.96754298563627,177.78406254782914,266.63333345874975],
[2019,"M1_fixed","UNL",1.15,1.0,352962.18,18032.4,88240.59,18032.4,70208.19,84.04269157847477,73301072.57675783,649.5626915784751,286.38269157847475,139.70355731225297,8.768866049323362,-2.8604570143637584,92.9560625478291,181.80533345874971],
[2019,"M1_fixed","UNL",1.15,1.15,352962.18,144884.16,88240.59,88240.59,56643.57,-0.7853084215250977,-684937.0066592887,649.5626915784751,231.90569157847483,160.6590909090909,10.084195956721867,-87.68845701436373,8.128062547829131,96.97733345874975],
[2019,"M1_fixed","ERS_Heartland",0.85,0.85,352962.18,351499.41,88240.59,88240.59,263258.82,-135.95994535504022,-118582706.41767916,480.11155464495965,null,205.90625,12.924254469289222,-200.19270735844268,-129.3718015950827,-63.70060135657616],
[2019,"M1_fixed","ERS_Heartland",0.85,1.0,352962.18,352962.18,88240.59,88240.59,264721.59,-244.6784453550403,-213405736.34759325,480.11155464495965,null,242.2426470588235,15.20500525798732,-308.9112073584427,-238.0903015950828,-172.41910135657622],
[2019,"M1_fixed","ERS_Heartland",0.85,1.15,352962.18,352962.18,88240.59,88240.59,264721.59,-353.3969453550406,-308228766.2775075,480.11155464495965,null,278.579044117647,17.485756046685417,-417.62970735844266,-346.80880159508274,-281.13760135657617],
[2019,"M1_fixed","ERS_Heartland",1.0,0.85,352962.18,305278.11,88240.59,88240.59,217037.52,-51.23437688828251,-44686036.443826094,564.8371231117172,null,175.02031249999996,10.985616298895838,-126.80233218640312,-43.48361952362672,33.77661605108689],
[2019,"M1_fixed","ERS_Heartland",1.0,1.0,352962.18,351499.41,88240.59,88240.59,263258.82,-159.95287688828273,-139509066.3737403,564.8371231117172,null,205.90625,12.924254469289224,-235.5208321864032,-152.20211952362678,-74.94188394891317],
[2019,"M1_fixed","ERS_Heartland",1.0,1.15,352962.18,352954.44,88240.59,88240.59,264713.85,-268.6713768882827,-234332096.30365425,564.8371231117172,null,236.7921875,14.862892639682606,-344.23933218640315,-260.9206195236267,-183.66038394891316],
[2019,"M1_fixed","ERS_Heartland",1.15,0.85,352962.18,49162.86,88240.59,49162.86,39077.73,33.49119157847499,29210633.5300268,649.5626915784751,null,152.1915760869565,9.552709825126817,-53.41195701436368,42.40456254782919,131.25383345874982],
[2019,"M1_fixed","ERS_Heartland",1.15,1.0,352962.18,321645.78,88240.59,88240.59,233405.19,-75.22730842152502,-65612396.399887234,649.5626915784751,null,179.04891304347825,11.23848214720802,-162.13045701436374,-66.31393745217088,22.53533345874976],
[2019,"M1_fixed","ERS_Heartland",1.15,1.15,352962.18,351499.41,88240.59,88240.59,263258.82,-183.94580842152516,-160435426.32980132,649.5626915784751,null,205.90625,12.924254469289222,-270.8489570143637,-175.03243745217085,-86.18316654125019],
[2019,"M1_fixed","FINBIN_county",0.85,0.85,146321.72999999998,104890.14,43003.08,43003.08,61887.06,-26.108411511896623,-9439988.823984597,442.66658848810295,42.62258848810336,167.99928840192615,10.544923012128107,-242.07713905616475,-16.78363342918658,44.38919386482616],
[2019,"M1_fixed","FINBIN_county",0.85,1.0,146321.72999999998,144897.3,43003.08,43003.08,101894.22,-108.83341151189664,-39350773.51911201,442.66658848810295,-27.97341151189663,197.6462216493249,12.405791778974246,-324.8021390561648,-99.5086334291866,-38.33580613517386],
[2019,"M1_fixed","FINBIN_county",0.85,1.15,146321.72999999998,146297.79,43003.08,43003.08,103294.71,-191.55841151189648,-69261558.21423936,442.66658848810295,-98.56941151189666,227.2931548967236,14.26666054582038,-407.5271390561647,-182.2336334291865,-121.06080613517378],
[2019,"M1_fixed","FINBIN_county",1.0,0.85,146321.72999999998,11530.35,43003.08,11530.35,31472.73,52.00922175070989,18804915.49043966,520.7842217507094,120.74022175070976,142.79939514163723,8.963184560308893,-202.07163418372323,62.97954890683934,134.94758101744256],
[2019,"M1_fixed","FINBIN_county",1.0,1.0,146321.72999999998,104890.14,43003.08,43003.08,61887.06,-30.71577824929016,-11105869.204687769,520.7842217507094,50.14422175070987,167.99928840192618,10.54492301212811,-284.79663418372326,-19.74545109316068,52.22258101744254],
[2019,"M1_fixed","FINBIN_county",1.0,1.15,146321.72999999998,143818.47,43003.08,43003.08,100815.39,-113.44077824929003,-41016653.899815135,520.7842217507094,-20.45177824929015,193.19918166221507,12.126661463947324,-367.5216341837232,-102.4704510931606,-30.50241898255737],
[2019,"M1_fixed","FINBIN_county",1.15,0.85,146321.72999999998,8008.65,43003.08,8008.65,34994.43,130.1268550133163,47049819.80486388,598.9018550133161,198.85785501331628,124.17338707968456,7.794073530703385,-162.06612931128177,142.74273124286515,225.5059681700588],
[2019,"M1_fixed","FINBIN_county",1.15,1.0,146321.72999999998,14389.47,43003.08,14389.47,28613.61,47.40185501331628,17139035.109736465,598.9018550133161,128.26185501331642,146.08633774080536,9.169498271415748,-244.7911293112818,60.017731242865125,142.7809681700588],
[2019,"M1_fixed","FINBIN_county",1.15,1.15,146321.72999999998,104890.14,43003.08,43003.08,61887.06,-35.32314498668364,-12771749.585390914,598.9018550133161,57.66585501331627,167.99928840192615,10.544923012128107,-327.5161293112817,-22.707268757134784,60.0559681700589],
[2019,"M1_fixed","FINBIN_state",0.85,0.85,352962.18,350994.51,88240.59,88240.59,262753.92,-117.30931794111918,-102315842.89875728,437.62168205888094,-30.048317941119095,203.4795292474941,12.771934874661614,-175.85748050722046,-111.30422490391786,-51.44492588651914],
[2019,"M1_fixed","FINBIN_state",0.85,1.0,352962.18,352960.11,88240.59,88240.59,264719.52,-215.23831794111905,-187728394.56205776,437.62168205888094,-112.5783179411192,239.3876814676401,15.025805734896018,-273.78648050722046,-209.23322490391783,-149.37392588651912],
[2019,"M1_fixed","FINBIN_state",0.85,1.15,352962.18,352962.18,88240.59,88240.59,264721.59,-313.167317941119,-273140946.2253584,437.62168205888094,-195.108317941119,275.2958336877861,17.279676595130418,-371.7154805072204,-307.16222490391783,-247.3029258865191],
[2019,"M1_fixed","FINBIN_state",1.0,0.85,352962.18,293261.76,88240.59,88240.59,205021.17,-40.081962283669554,-34959028.21759023,514.8490377163306,47.179037716330456,172.95759986036998,10.856144643462372,-108.9621535379064,-33.017146945785726,37.40555778056574],
[2019,"M1_fixed","FINBIN_state",1.0,1.0,352962.18,350994.51,88240.59,88240.59,262753.92,-138.0109622836695,-120371579.8808908,514.8490377163306,-35.35096228366956,203.4795292474941,12.771934874661614,-206.8911535379064,-130.9461469457857,-60.52344221943423],
[2019,"M1_fixed","FINBIN_state",1.0,1.15,352962.18,352951.11,88240.59,88240.59,264710.52,-235.9399622836693,-205784131.54419127,514.8490377163306,-117.88096228366966,234.00145863461825,14.687725105860856,-304.8201535379063,-228.87514694578567,-158.4524422194342],
[2019,"M1_fixed","FINBIN_state",1.15,0.85,352962.18,39437.55,88240.59,39437.55,48803.04,37.14539337377996,32397786.46357673,592.0763933737803,124.40639337377996,150.39791292206084,9.4401257769238,-42.066826568592425,45.26993101234632,126.2560414476505],
[2019,"M1_fixed","FINBIN_state",1.15,1.0,352962.18,314010.45,88240.59,88240.59,225769.86,-60.78360662622005,-53014765.19972391,592.0763933737803,41.876393373779926,176.93872108477746,11.106030325792709,-139.9958265685924,-52.65906898765365,28.327041447650533],
[2019,"M1_fixed","FINBIN_state",1.15,1.15,352962.18,350994.51,88240.59,88240.59,262753.92,-158.71260662622,-138427316.8630245,592.0763933737803,-40.65360662621999,203.4795292474941,12.771934874661614,-237.9248265685924,-150.58806898765363,-69.60195855234944],
[2019,"M2_HI_sensitivity","UNL",0.85,0.85,352962.18,235025.01,88240.59,88240.59,146784.41999999998,-18.016102612720815,-15713438.258129282,462.67589738727895,153.97289738727926,160.6590909090909,10.084195956721867,-79.91620810099069,-11.667225228198362,51.619075227912674],
[2019,"M2_HI_sensitivity","UNL",0.85,1.0,352962.18,348091.02,88240.59,88240.59,259850.43,-102.84410261272082,-89699447.84154652,462.67589738727895,99.49589738727916,189.01069518716577,11.863759949084548,-164.7442081009907,-96.4952252281984,-33.20892477208736],
[2019,"M2_HI_sensitivity","UNL",0.85,1.15,352962.18,352863.45,88240.59,88240.59,264622.86,-187.6721026127209,-163685457.4249638,462.67589738727895,45.018897387279175,217.36229946524065,13.64332394144723,-249.57220810099068,-181.3232252281984,-118.03692477208732],
[2019,"M2_HI_sensitivity","UNL",1.0,0.85,352962.18,19457.64,88240.59,19457.64,68782.95,63.63258516150492,55499611.6326769,544.3245851615051,235.621585161505,136.56022727272725,8.571566563213585,-9.191068354106708,71.10185267270782,145.55632379754428],
[2019,"M2_HI_sensitivity","UNL",1.0,1.0,352962.18,235025.01,88240.59,88240.59,146784.41999999998,-21.19541483849512,-18486397.950740363,544.3245851615051,181.1445851615049,160.6590909090909,10.084195956721867,-94.01906835410674,-13.72614732729221,60.72832379754425],
[2019,"M2_HI_sensitivity","UNL",1.0,1.15,352962.18,344809.26,88240.59,88240.59,256568.67,-106.02341483849506,-92472407.53415754,544.3245851615051,126.66758516150496,184.7579545454545,11.596825350230146,-178.8470683541067,-98.55414732729218,-24.09967620245573],
[2019,"M2_HI_sensitivity","UNL",1.15,0.85,352962.18,14800.95,88240.59,14800.95,73439.64,145.28127293573073,126712661.52348313,625.9732729357302,317.2702729357304,118.748023715415,7.453536141924857,61.534071392777214,153.87093057361392,239.4935723671759],
[2019,"M2_HI_sensitivity","UNL",1.15,1.0,352962.18,23368.41,88240.59,23368.41,64872.18,60.45327293573055,52726651.94006576,625.9732729357302,262.79327293573044,139.70355731225297,8.768866049323362,-23.293928607222817,69.04293057361389,154.66557236717586],
[2019,"M2_HI_sensitivity","UNL",1.15,1.15,352962.18,235025.01,88240.59,88240.59,146784.41999999998,-24.37472706426937,-21259357.6433514,625.9732729357302,208.31627293573075,160.6590909090909,10.084195956721867,-108.12192860722278,-15.785069426386087,69.83757236717588],
[2019,"M2_HI_sensitivity","ERS_Heartland",0.85,0.85,352962.18,352382.58,88240.59,88240.59,264141.99,-153.39560261272078,-133789886.88827768,462.67589738727895,null,205.90625,12.924254469289222,-215.29570810099065,-147.0467252281983,-83.76042477208728],
[2019,"M2_HI_sensitivity","ERS_Heartland",0.85,1.0,352962.18,352962.18,88240.59,88240.59,264721.59,-262.11410261272084,-228612916.81819177,462.67589738727895,null,242.2426470588235,15.20500525798732,-324.0142081009907,-255.7652252281984,-192.4789247720873],
[2019,"M2_HI_sensitivity","ERS_Heartland",0.85,1.15,352962.18,352962.18,88240.59,88240.59,264721.59,-370.8326026127205,-323435946.74810547,462.67589738727895,null,278.579044117647,17.485756046685417,-432.7327081009906,-364.4837252281983,-301.1974247720873],
[2019,"M2_HI_sensitivity","ERS_Heartland",1.0,0.85,352962.18,328878.27,88240.59,88240.59,240637.68,-71.74691483849504,-62576836.99747151,544.3245851615051,null,175.02031249999996,10.985616298895838,-144.57056835410663,-64.27764732729213,10.17682379754433],
[2019,"M2_HI_sensitivity","ERS_Heartland",1.0,1.0,352962.18,352382.58,88240.59,88240.59,264141.99,-180.46541483849504,-157399866.92738554,544.3245851615051,null,205.90625,12.924254469289224,-253.28906835410672,-172.9961473272922,-98.54167620245572],
[2019,"M2_HI_sensitivity","ERS_Heartland",1.0,1.15,352962.18,352962.18,88240.59,88240.59,264721.59,-289.183914838495,-252222896.8572996,544.3245851615051,null,236.7921875,14.862892639682606,-362.0075683541067,-281.71464732729214,-207.26017620245568],
[2019,"M2_HI_sensitivity","ERS_Heartland",1.15,0.85,352962.18,104829.21,88240.59,88240.59,16588.62,9.901772935730662,8636212.893334633,625.9732729357302,null,152.1915760869565,9.552709825126817,-73.84542860722273,18.491430573613968,104.11407236717594],
[2019,"M2_HI_sensitivity","ERS_Heartland",1.15,1.0,352962.18,337363.38,88240.59,88240.59,249122.79,-98.8167270642694,-86186817.03657945,625.9732729357302,null,179.04891304347825,11.23848214720802,-182.5639286072228,-90.2270694263861,-4.604427632824127],
[2019,"M2_HI_sensitivity","ERS_Heartland",1.15,1.15,352962.18,352382.58,88240.59,88240.59,264141.99,-207.53522706426944,-181009846.9664935,625.9732729357302,null,205.90625,12.924254469289222,-291.2824286072228,-198.94556942638604,-113.32292763282408],
[2019,"M2_HI_sensitivity","FINBIN_county",0.85,0.85,146321.72999999998,125321.04,43003.08,43003.08,82317.95999999999,-42.18422315482545,-15252501.859355606,426.5907768451745,26.546776845174595,167.99928840192615,10.544923012128107,-250.3098705623046,-33.19807753766827,25.753210149571004],
[2019,"M2_HI_sensitivity","FINBIN_county",0.85,1.0,146321.72999999998,145768.86,43003.08,43003.08,102765.78,-124.90922315482548,-45163286.55448302,426.5907768451745,-44.04922315482545,197.6462216493249,12.405791778974246,-333.0348705623046,-115.92307753766828,-56.97178985042902],
[2019,"M2_HI_sensitivity","FINBIN_county",0.85,1.15,146321.72999999998,146313.63,43003.08,43003.08,103310.55,-207.6342231548253,-75074071.24961038,426.5907768451745,-114.64522315482546,227.2931548967236,14.26666054582038,-415.7598705623045,-198.6480775376682,-139.69678985042893],
[2019,"M2_HI_sensitivity","FINBIN_county",1.0,0.85,146321.72999999998,17309.34,43003.08,17309.34,25693.74,33.09650217079364,11966664.860591425,501.8715021707936,101.82750217079358,142.79939514163723,8.963184560308893,-211.7572006615348,43.66843819097846,113.02289429361292],
[2019,"M2_HI_sensitivity","FINBIN_county",1.0,1.0,146321.72999999998,125321.04,43003.08,43003.08,82317.95999999999,-49.62849782920637,-17944119.83453599,501.8715021707936,31.231502170793608,167.99928840192618,10.54492301212811,-294.4822006615348,-39.05656180902156,30.297894293612888],
[2019,"M2_HI_sensitivity","FINBIN_county",1.0,1.15,146321.72999999998,145338.3,43003.08,43003.08,102335.22,-132.35349782920636,-47854904.5296634,501.8715021707936,-39.36449782920637,193.19918166221507,12.126661463947324,-377.2072006615347,-121.78156180902148,-52.42710570638702],
[2019,"M2_HI_sensitivity","FINBIN_county",1.15,0.85,146321.72999999998,8216.369999999999,43003.08,8216.369999999999,34786.71,108.37722749641264,39185831.580538414,577.1522274964125,177.10822749641264,124.17338707968456,7.794073530703385,-173.20453076076507,120.5349539196252,200.2925784376548],
[2019,"M2_HI_sensitivity","FINBIN_county",1.15,1.0,146321.72999999998,24561.72,43003.08,24561.72,18441.36,25.6522274964126,9275046.885410994,577.1522274964125,106.51222749641258,146.08633774080536,9.169498271415748,-255.9295307607651,37.80995391962517,117.5675784376548],
[2019,"M2_HI_sensitivity","FINBIN_county",1.15,1.15,146321.72999999998,125321.04,43003.08,43003.08,82317.95999999999,-57.07277250358732,-20635737.809716385,577.1522274964125,35.91622749641261,167.99928840192615,10.544923012128107,-338.654530760765,-44.91504608037474,34.842578437654886],
[2019,"M2_HI_sensitivity","FINBIN_state",0.85,0.85,352962.18,352180.98,88240.59,88240.59,263940.39,-133.201919531495,-116177187.89770782,421.72908046850455,-45.94091953149497,203.4795292474941,12.771934874661614,-189.62386568405296,-127.41491779550272,-69.72945492975754],
[2019,"M2_HI_sensitivity","FINBIN_state",0.85,1.0,352962.18,352962.18,88240.59,88240.59,264721.59,-231.13091953149487,-201589739.56100836,421.72908046850455,-128.470919531495,239.3876814676401,15.025805734896018,-287.5528656840529,-225.3439177955027,-167.6584549297575],
[2019,"M2_HI_sensitivity","FINBIN_state",0.85,1.15,352962.18,352962.18,88240.59,88240.59,264721.59,-329.0599195314948,-287002291.22430897,421.72908046850455,-211.0009195314948,275.2958336877861,17.279676595130418,-385.4818656840529,-323.2729177955027,-265.5874549297575],
[2019,"M2_HI_sensitivity","FINBIN_state",1.0,0.85,352962.18,322990.02,88240.59,88240.59,234749.43,-58.77914062528818,-51266492.92223795,496.1518593747117,28.48185937471183,172.95759986036998,10.856144643462372,-125.1579008047682,-51.97090328882675,15.894347141461708],
[2019,"M2_HI_sensitivity","FINBIN_state",1.0,1.0,352962.18,352180.98,88240.59,88240.59,263940.39,-156.70814062528817,-136679044.58553857,496.1518593747117,-54.04814062528818,203.4795292474941,12.771934874661614,-223.08690080476816,-149.89990328882672,-82.03465285853827],
[2019,"M2_HI_sensitivity","FINBIN_state",1.0,1.15,352962.18,352962.18,88240.59,88240.59,264721.59,-254.63714062528817,-222091596.2488392,496.1518593747117,-136.57814062528817,234.00145863461825,14.687725105860856,-321.01590080476814,-247.8289032888267,-179.96365285853824],
[2019,"M2_HI_sensitivity","FINBIN_state",1.15,0.85,352962.18,82091.87999999999,88240.59,82091.87999999999,6148.71,15.64363828091855,13644202.053231863,570.5746382809185,102.9046382809186,150.39791292206084,9.4401257769238,-60.69193592548349,23.47311121784918,101.5181492126809],
[2019,"M2_HI_sensitivity","FINBIN_state",1.15,1.0,352962.18,333380.61,88240.59,88240.59,245140.02,-82.28536171908146,-71768349.61006878,570.5746382809185,20.374638280918514,176.93872108477746,11.106030325792709,-158.62093592548348,-74.4558887821508,3.5891492126809226],
[2019,"M2_HI_sensitivity","FINBIN_state",1.15,1.15,352962.18,352180.98,88240.59,88240.59,263940.39,-180.2143617190815,-157180901.27336943,570.5746382809185,-62.155361719081405,203.4795292474941,12.771934874661614,-256.54993592548345,-172.38488878215077,-94.33985078731904],
[2021,"M1_fixed","UNL",0.85,0.85,175770.99,2.16,43942.77,2.16,43940.61,445.2718083601328,193399168.1576264,931.6248083601346,637.7883083601333,96.00335570469798,6.025906445448868,348.6397809813585,442.9681747766614,554.4215471570618],
[2021,"M1_fixed","UNL",0.85,1.0,175770.99,7.38,43942.77,7.38,43935.39,359.4448083601333,156121105.42422417,931.6248083601346,585.9348083601337,112.94512435846822,7.089301700528081,262.8127809813585,357.1411747766614,468.5945471570618],
[2021,"M1_fixed","UNL",0.85,1.15,175770.99,24.03,43942.77,24.03,43918.74,273.61780836013327,118843042.69082163,931.6248083601346,534.081308360133,129.88689301223846,8.152696955607293,176.98578098135852,271.3141747766614,382.7675471570618],
[2021,"M1_fixed","UNL",1.0,0.85,175770.99,0.4499999999999999,43942.77,0.4499999999999999,43942.32,609.6761863060391,264806495.860022,1096.0291863060384,802.1926863060386,81.60285234899328,5.122020478631538,495.991448213363,606.9660291490135,738.0876437141904],
[2021,"M1_fixed","UNL",1.0,1.0,175770.99,2.16,43942.77,2.16,43940.61,523.8491863060385,227528433.1266193,1096.0291863060384,750.3391863060382,96.00335570469798,6.025906445448868,410.164448213363,521.1390291490135,652.2606437141905],
[2021,"M1_fixed","UNL",1.0,1.15,175770.99,6.48,43942.77,6.48,43936.29,438.02218630603926,190250370.39321712,1096.0291863060384,698.4856863060388,110.40385906040268,6.929792412266198,324.337448213363,435.3120291490135,566.4336437141905],
[2021,"M1_fixed","UNL",1.15,0.85,175770.99,0.09,43942.77,0.09,43942.68,774.0805642519449,336213823.56241745,1260.4335642519452,966.597064251945,70.95900204260286,4.453930850983946,643.3431154453674,770.9638835213653,921.7537402713187],
[2021,"M1_fixed","UNL",1.15,1.0,175770.99,0.8999999999999999,43942.77,0.8999999999999999,43941.87,688.2535642519451,298935760.8290151,1260.4335642519452,914.743564251945,83.48117887365042,5.239918648216407,557.5161154453674,685.1368835213653,835.9267402713189],
[2021,"M1_fixed","UNL",1.15,1.15,175770.99,2.16,43942.77,2.16,43940.61,602.4265642519451,261657698.0956126,1260.4335642519452,862.8900642519445,96.003355704698,6.025906445448869,471.6891154453674,599.3098835213654,750.0997402713189],
[2021,"M1_fixed","ERS_Heartland",0.85,0.85,175770.99,30.6,43942.77,30.6,43912.17,265.5733083601331,115348997.97693367,931.6248083601346,null,131.47483221476512,8.252368191109928,168.94128098135843,263.2696747766613,374.7230471570617],
[2021,"M1_fixed","ERS_Heartland",0.85,1.0,175770.99,1882.98,43942.77,1882.98,42059.79,148.0348083601332,64297375.79987954,931.6248083601346,null,154.6762731938413,9.708668460129328,51.40278098135843,145.7311747766613,257.18454715706173],
[2021,"M1_fixed","ERS_Heartland",0.85,1.15,175770.99,50068.53,43942.77,43942.77,6125.76,30.49630836013326,13245753.622825388,931.6248083601346,null,177.87771417291748,11.164968729148724,-66.13571901864145,28.19267477666142,139.64604715706184],
[2021,"M1_fixed","ERS_Heartland",1.0,0.85,175770.99,7.109999999999999,43942.77,7.109999999999999,43935.66,429.9776863060394,186756325.6793293,1096.0291863060384,null,111.75360738255034,7.01451296244344,316.29294821336293,427.2675291490134,558.3891437141904],
[2021,"M1_fixed","ERS_Heartland",1.0,1.0,175770.99,30.6,43942.77,30.6,43912.17,312.439186306039,135704703.50227493,1096.0291863060384,null,131.47483221476512,8.252368191109928,198.7544482133629,309.7290291490134,440.8506437141904],
[2021,"M1_fixed","ERS_Heartland",1.0,1.15,175770.99,1048.68,43942.77,1048.68,42894.09,194.9006863060392,84653081.32522084,1096.0291863060384,null,151.19605704697986,9.490223419776417,81.21594821336305,192.1905291490135,323.3121437141905],
[2021,"M1_fixed","ERS_Heartland",1.15,0.85,175770.99,2.43,43942.77,2.43,43940.34,594.3820642519446,258163653.3817244,1260.4335642519452,null,97.17704989786988,6.099576489081253,463.6446154453673,591.2653835213653,742.0552402713188],
[2021,"M1_fixed","ERS_Heartland",1.15,1.0,175770.99,8.01,43942.77,8.01,43934.76,476.8435642519449,207112031.2046704,1260.4335642519452,null,114.3259410563175,7.175972340095592,346.1061154453673,473.72688352136527,624.5167402713188],
[2021,"M1_fixed","ERS_Heartland",1.15,1.15,175770.99,30.6,43942.77,30.6,43912.17,359.3050642519449,156060409.0276162,1260.4335642519452,null,131.47483221476512,8.252368191109928,228.56761544536744,356.1883835213654,506.9782402713189],
[2021,"M1_fixed","FINBIN_state",0.85,0.85,175770.99,34.29,43942.77,34.29,43908.48,237.4506509526728,103134214.90091692,846.1016509526728,324.5416509526726,132.28836743229843,8.303431896903849,149.68944368726972,235.35849093216385,336.58044372804346],
[2021,"M1_fixed","FINBIN_state",0.85,1.0,175770.99,2186.55,43942.77,2186.55,41756.22,130.04165095267288,56482235.452351466,846.1016509526728,232.50165095267292,155.63337344976284,9.768743408122171,42.28044368726973,127.94949093216384,229.17144372804347],
[2021,"M1_fixed","FINBIN_state",0.85,1.15,175770.99,56735.55,43942.77,43942.77,12792.78,22.63265095267301,9830256.00378606,846.1016509526728,140.46165095267295,178.97837946722726,11.2340549193405,-65.12855631273015,20.540490932163948,121.7624437280436],
[2021,"M1_fixed","FINBIN_state",1.0,0.85,175770.99,7.38,43942.77,7.38,43935.39,386.7627070031443,167986349.92023236,995.413707003144,473.85370700314417,112.44511231745366,7.057917112368271,283.5142278673762,384.301342273134,503.3859926212276],
[2021,"M1_fixed","FINBIN_state",1.0,1.0,175770.99,34.29,43942.77,34.29,43908.48,279.35370700314473,121334370.47166708,995.413707003144,381.8137070031448,132.28836743229843,8.303431896903849,176.1052278673762,276.892342273134,395.9769926212276],
[2021,"M1_fixed","FINBIN_state",1.0,1.15,175770.99,1234.89,43942.77,1234.89,42707.88,171.94470700314469,74682391.02310157,995.413707003144,289.7737070031445,152.13162254714317,9.548946681439425,68.69622786737631,169.4833422731341,288.56799262122775],
[2021,"M1_fixed","FINBIN_state",1.15,0.85,175770.99,2.7,43942.77,2.7,43940.07,536.0747630536163,232838484.939548,1144.7257630536158,623.1657630536168,97.77835853691624,6.137319228146323,417.3390120474826,533.2441936141039,670.1915415144117],
[2021,"M1_fixed","FINBIN_state",1.15,1.0,175770.99,8.1,43942.77,8.1,43934.67,428.66576305361633,186186505.49098253,1144.7257630536158,531.1257630536161,115.03336298460736,7.220375562525087,309.9300120474826,425.8351936141039,562.7825415144117],
[2021,"M1_fixed","FINBIN_state",1.15,1.15,175770.99,34.29,43942.77,34.29,43908.48,321.25676305361645,139534526.04241714,1144.7257630536158,439.0857630536165,132.28836743229843,8.303431896903849,202.5210120474827,318.426193614104,455.37354151441184],
[2021,"M2_HI_sensitivity","UNL",0.85,0.85,175770.99,2.16,43942.77,2.16,43940.61,445.2718083601328,193399168.1576264,931.6248083601346,637.7883083601333,96.00335570469798,6.025906445448868,348.6397809813585,442.9681747766614,554.4215471570618],
[2021,"M2_HI_sensitivity","UNL",0.85,1.0,175770.99,7.38,43942.77,7.38,43935.39,359.4448083601333,156121105.42422417,931.6248083601346,585.9348083601337,112.94512435846822,7.089301700528081,262.8127809813585,357.1411747766614,468.5945471570618],
[2021,"M2_HI_sensitivity","UNL",0.85,1.15,175770.99,24.03,43942.77,24.03,43918.74,273.61780836013327,118843042.69082163,931.6248083601346,534.081308360133,129.88689301223846,8.152696955607293,176.98578098135852,271.3141747766614,382.7675471570618],
[2021,"M2_HI_sensitivity","UNL",1.0,0.85,175770.99,0.4499999999999999,43942.77,0.4499999999999999,43942.32,609.6761863060391,264806495.860022,1096.0291863060384,802.1926863060386,81.60285234899328,5.122020478631538,495.991448213363,606.9660291490135,738.0876437141904],
[2021,"M2_HI_sensitivity","UNL",1.0,1.0,175770.99,2.16,43942.77,2.16,43940.61,523.8491863060385,227528433.1266193,1096.0291863060384,750.3391863060382,96.00335570469798,6.025906445448868,410.164448213363,521.1390291490135,652.2606437141905],
[2021,"M2_HI_sensitivity","UNL",1.0,1.15,175770.99,6.48,43942.77,6.48,43936.29,438.02218630603926,190250370.39321712,1096.0291863060384,698.4856863060388,110.40385906040268,6.929792412266198,324.337448213363,435.3120291490135,566.4336437141905],
[2021,"M2_HI_sensitivity","UNL",1.15,0.85,175770.99,0.09,43942.77,0.09,43942.68,774.0805642519449,336213823.56241745,1260.4335642519452,966.597064251945,70.95900204260286,4.453930850983946,643.3431154453674,770.9638835213653,921.7537402713187],
[2021,"M2_HI_sensitivity","UNL",1.15,1.0,175770.99,0.8999999999999999,43942.77,0.8999999999999999,43941.87,688.2535642519451,298935760.8290151,1260.4335642519452,914.743564251945,83.48117887365042,5.239918648216407,557.5161154453674,685.1368835213653,835.9267402713189],
[2021,"M2_HI_sensitivity","UNL",1.15,1.15,175770.99,2.16,43942.77,2.16,43940.61,602.4265642519451,261657698.0956126,1260.4335642519452,862.8900642519445,96.003355704698,6.025906445448869,471.6891154453674,599.3098835213654,750.0997402713189],
[2021,"M2_HI_sensitivity","ERS_Heartland",0.85,0.85,175770.99,30.6,43942.77,30.6,43912.17,265.5733083601331,115348997.97693367,931.6248083601346,null,131.47483221476512,8.252368191109928,168.94128098135843,263.2696747766613,374.7230471570617],
[2021,"M2_HI_sensitivity","ERS_Heartland",0.85,1.0,175770.99,1882.98,43942.77,1882.98,42059.79,148.0348083601332,64297375.79987954,931.6248083601346,null,154.6762731938413,9.708668460129328,51.40278098135843,145.7311747766613,257.18454715706173],
[2021,"M2_HI_sensitivity","ERS_Heartland",0.85,1.15,175770.99,50068.53,43942.77,43942.77,6125.76,30.49630836013326,13245753.622825388,931.6248083601346,null,177.87771417291748,11.164968729148724,-66.13571901864145,28.19267477666142,139.64604715706184],
[2021,"M2_HI_sensitivity","ERS_Heartland",1.0,0.85,175770.99,7.109999999999999,43942.77,7.109999999999999,43935.66,429.9776863060394,186756325.6793293,1096.0291863060384,null,111.75360738255034,7.01451296244344,316.29294821336293,427.2675291490134,558.3891437141904],
[2021,"M2_HI_sensitivity","ERS_Heartland",1.0,1.0,175770.99,30.6,43942.77,30.6,43912.17,312.439186306039,135704703.50227493,1096.0291863060384,null,131.47483221476512,8.252368191109928,198.7544482133629,309.7290291490134,440.8506437141904],
[2021,"M2_HI_sensitivity","ERS_Heartland",1.0,1.15,175770.99,1048.68,43942.77,1048.68,42894.09,194.9006863060392,84653081.32522084,1096.0291863060384,null,151.19605704697986,9.490223419776417,81.21594821336305,192.1905291490135,323.3121437141905],
[2021,"M2_HI_sensitivity","ERS_Heartland",1.15,0.85,175770.99,2.43,43942.77,2.43,43940.34,594.3820642519446,258163653.3817244,1260.4335642519452,null,97.17704989786988,6.099576489081253,463.6446154453673,591.2653835213653,742.0552402713188],
[2021,"M2_HI_sensitivity","ERS_Heartland",1.15,1.0,175770.99,8.01,43942.77,8.01,43934.76,476.8435642519449,207112031.2046704,1260.4335642519452,null,114.3259410563175,7.175972340095592,346.1061154453673,473.72688352136527,624.5167402713188],
[2021,"M2_HI_sensitivity","ERS_Heartland",1.15,1.15,175770.99,30.6,43942.77,30.6,43912.17,359.3050642519449,156060409.0276162,1260.4335642519452,null,131.47483221476512,8.252368191109928,228.56761544536744,356.1883835213654,506.9782402713189],
[2021,"M2_HI_sensitivity","FINBIN_state",0.85,0.85,175770.99,34.29,43942.77,34.29,43908.48,237.4506509526728,103134214.90091692,846.1016509526728,324.5416509526726,132.28836743229843,8.303431896903849,149.68944368726972,235.35849093216385,336.58044372804346],
[2021,"M2_HI_sensitivity","FINBIN_state",0.85,1.0,175770.99,2186.55,43942.77,2186.55,41756.22,130.04165095267288,56482235.452351466,846.1016509526728,232.50165095267292,155.63337344976284,9.768743408122171,42.28044368726973,127.94949093216384,229.17144372804347],
[2021,"M2_HI_sensitivity","FINBIN_state",0.85,1.15,175770.99,56735.55,43942.77,43942.77,12792.78,22.63265095267301,9830256.00378606,846.1016509526728,140.46165095267295,178.97837946722726,11.2340549193405,-65.12855631273015,20.540490932163948,121.7624437280436],
[2021,"M2_HI_sensitivity","FINBIN_state",1.0,0.85,175770.99,7.38,43942.77,7.38,43935.39,386.7627070031443,167986349.92023236,995.413707003144,473.85370700314417,112.44511231745366,7.057917112368271,283.5142278673762,384.301342273134,503.3859926212276],
[2021,"M2_HI_sensitivity","FINBIN_state",1.0,1.0,175770.99,34.29,43942.77,34.29,43908.48,279.35370700314473,121334370.47166708,995.413707003144,381.8137070031448,132.28836743229843,8.303431896903849,176.1052278673762,276.892342273134,395.9769926212276],
[2021,"M2_HI_sensitivity","FINBIN_state",1.0,1.15,175770.99,1234.89,43942.77,1234.89,42707.88,171.94470700314469,74682391.02310157,995.413707003144,289.7737070031445,152.13162254714317,9.548946681439425,68.69622786737631,169.4833422731341,288.56799262122775],
[2021,"M2_HI_sensitivity","FINBIN_state",1.15,0.85,175770.99,2.7,43942.77,2.7,43940.07,536.0747630536163,232838484.939548,1144.7257630536158,623.1657630536168,97.77835853691624,6.137319228146323,417.3390120474826,533.2441936141039,670.1915415144117],
[2021,"M2_HI_sensitivity","FINBIN_state",1.15,1.0,175770.99,8.1,43942.77,8.1,43934.67,428.66576305361633,186186505.49098253,1144.7257630536158,531.1257630536161,115.03336298460736,7.220375562525087,309.9300120474826,425.8351936141039,562.7825415144117],
[2021,"M2_HI_sensitivity","FINBIN_state",1.15,1.15,175770.99,34.29,43942.77,34.29,43908.48,321.25676305361645,139534526.04241714,1144.7257630536158,439.0857630536165,132.28836743229843,8.303431896903849,202.5210120474827,318.426193614104,455.37354151441184],
[2001,"M1_fixed","UNL",0.85,0.85,317267.64,68255.37,79316.91,68255.37,11061.539999999999,6.237736129192789,4890294.129778047,203.4122361291927,null,119.5721649484536,7.505265562544312,-98.7629814639211,14.836431473016688,43.68003453656831],
[2001,"M1_fixed","UNL",0.85,1.0,317267.64,283936.86,79316.91,79316.91,204619.94999999998,-28.557763870807257,-22388870.276734337,203.4122361291927,null,140.67313523347482,8.829724191228602,-133.5584814639211,-19.959068526983316,8.884534536568303],
[2001,"M1_fixed","UNL",0.85,1.15,317267.64,315858.06,79316.91,79316.91,236541.15,-63.35326387080722,-49668034.68324666,203.4122361291927,null,161.77410551849604,10.154182819912892,-168.35398146392106,-54.75456852698329,-25.910965463431673],
[2001,"M1_fixed","UNL",1.0,0.85,317267.64,30840.75,79316.91,30840.75,48476.159999999996,42.13401309316798,33032451.61801593,239.30851309316782,null,101.63634020618557,6.3794757281626655,-81.39624289873069,52.25012526237256,86.18377592537449],
[2001,"M1_fixed","UNL",1.0,1.0,317267.64,68255.37,79316.91,68255.37,11061.539999999999,7.338513093167979,5753287.211503578,239.30851309316782,null,119.5721649484536,7.505265562544312,-116.1917428987307,17.45462526237256,51.38827592537449],
[2001,"M1_fixed","UNL",1.0,1.15,317267.64,265035.6,79316.91,79316.91,185718.69,-27.456986906831993,-21525877.19500875,239.30851309316782,null,137.50798969072164,8.631055396925959,-150.98724289873067,-17.340874737627416,16.59277592537451],
[2001,"M1_fixed","UNL",1.15,0.85,317267.64,27381.239999999998,79316.91,27381.239999999998,51935.67,78.03029005714313,61174609.10625378,275.20479005714316,null,88.37942626624832,5.547370198402318,-64.0295043335403,89.66381905172844,128.68751731418064],
[2001,"M1_fixed","UNL",1.15,1.0,317267.64,32118.75,79316.91,32118.75,47198.159999999996,43.23479005714315,33895444.699741445,275.20479005714316,null,103.97579560735097,6.526317880473316,-98.8250043335403,54.868319051728434,93.89201731418063],
[2001,"M1_fixed","UNL",1.15,1.15,317267.64,68255.37,79316.91,68255.37,11061.539999999999,8.439290057143175,6616280.293229115,275.20479005714316,null,119.5721649484536,7.505265562544312,-133.62050433354028,20.07281905172846,59.09651731418066],
[2001,"M1_fixed","ERS_Heartland",0.85,0.85,317267.64,317243.61,79316.91,79316.91,237926.69999999998,-89.77826387080717,-70384849.1978272,203.4122361291927,null,177.79896907216494,11.16002608306423,-194.77898146392107,-81.1795685269833,-52.335965463431684],
[2001,"M1_fixed","ERS_Heartland",0.85,1.0,317267.64,317267.64,79316.91,79316.91,237950.72999999998,-141.5177638708073,-110947862.42685825,203.4122361291927,null,209.17525773195877,13.1294424506638,-246.5184814639211,-132.91906852698332,-104.0754654634317],
[2001,"M1_fixed","ERS_Heartland",0.85,1.15,317267.64,317267.64,79316.91,79316.91,237950.72999999998,-193.25726387080718,-151510875.65588906,203.4122361291927,null,240.55154639175257,15.09885881826337,-298.25798146392106,-184.6585685269833,-155.81496546343166],
[2001,"M1_fixed","ERS_Heartland",1.0,0.85,317267.64,309509.73,79316.91,79316.91,230192.81999999998,-53.88198690683199,-42242691.70958933,239.30851309316782,null,151.1291237113402,9.486022170604597,-177.41224289873068,-43.76587473762743,-9.8322240746255],
[2001,"M1_fixed","ERS_Heartland",1.0,1.0,317267.64,317243.61,79316.91,79316.91,237926.69999999998,-105.621486906832,-82805704.93862028,239.30851309316782,null,177.79896907216497,11.160026083064231,-229.1517428987307,-95.50537473762745,-61.57172407462552],
[2001,"M1_fixed","ERS_Heartland",1.0,1.15,317267.64,317267.64,79316.91,79316.91,237950.72999999998,-157.36098690683198,-123368718.16765119,239.30851309316782,null,204.4688144329897,12.834029995523865,-280.89124289873064,-147.2448747376274,-113.31122407462549],
[2001,"M1_fixed","ERS_Heartland",1.15,0.85,317267.64,199015.11,79316.91,79316.91,119698.2,-17.985709942856833,-14100534.221351476,275.20479005714316,null,131.41662931420888,8.248714930960519,-160.0455043335403,-6.3521809482715526,32.67151731418065],
[2001,"M1_fixed","ERS_Heartland",1.15,1.0,317267.64,312620.76,79316.91,79316.91,233303.85,-69.7252099428569,-54663547.45038246,275.20479005714316,null,154.60779919318693,9.704370507012376,-211.78500433354031,-58.09168094827157,-19.067982685819374],
[2001,"M1_fixed","ERS_Heartland",1.15,1.15,317267.64,317243.61,79316.91,79316.91,237926.69999999998,-121.46470994285671,-95226560.67941324,275.20479005714316,null,177.79896907216494,11.16002608306423,-263.52450433354034,-109.83118094827154,-70.80748268581934],
[2001,"M1_fixed","FINBIN_county",0.85,0.85,122084.09999999999,92747.61,34310.79,34310.79,58436.82,-17.458371134989136,-5266778.222433452,162.0276288650108,10.63412886501086,133.74952178021906,8.39514514315759,-101.98026182580617,-8.656824793458355,14.118157102973928],
[2001,"M1_fixed","FINBIN_county",0.85,1.0,122084.09999999999,121344.12,34310.79,34310.79,87033.33,-49.13237113498914,-14822075.914726496,162.0276288650108,-16.082371134989124,157.3523785649636,9.876641344891283,-133.65426182580617,-40.33082479345836,-17.55584289702608],
[2001,"M1_fixed","FINBIN_county",0.85,1.15,122084.09999999999,122083.37999999999,34310.79,34310.79,87772.59,-80.8063711349891,-24377373.60701953,162.0276288650108,-42.7988711349891,180.95523534970812,11.358137546624974,-165.32826182580615,-72.00482479345834,-49.22984289702605],
[2001,"M1_fixed","FINBIN_county",1.0,0.85,122084.09999999999,19919.61,34310.79,19919.61,14391.18,11.134739841189257,3359088.0188419237,190.62073984118925,39.227239841189245,113.6870935131862,7.135873371683951,-88.30277861859548,21.489500242990175,48.28359659173404],
[2001,"M1_fixed","FINBIN_county",1.0,1.0,122084.09999999999,92747.61,34310.79,34310.79,58436.82,-20.53926015881076,-6196209.673451123,190.62073984118925,12.510739841189267,133.74952178021906,8.39514514315759,-119.97677861859549,-10.184499757009831,16.609596591734032],
[2001,"M1_fixed","FINBIN_county",1.0,1.15,122084.09999999999,120727.62,34310.79,34310.79,86416.83,-52.213260158810755,-15751507.365744162,190.62073984118925,-14.20576015881071,153.8119500472519,9.654416914631229,-151.65077861859547,-41.85849975700981,-15.064403408265944],
[2001,"M1_fixed","FINBIN_county",1.15,0.85,122084.09999999999,15008.939999999999,34310.79,15008.939999999999,19301.85,39.7278508173676,11984954.260117287,219.21385081736747,67.82035081736764,98.8583421853793,6.205107279725175,-74.62529541138481,51.63582527943868,82.44903608049412],
[2001,"M1_fixed","FINBIN_county",1.15,1.0,122084.09999999999,22939.649999999998,34310.79,22939.649999999998,11371.14,8.05385081736762,2429656.567824248,219.21385081736747,41.103850817367636,116.30393198279918,7.300126211441383,-106.29929541138482,19.96182527943867,50.77503608049412],
[2001,"M1_fixed","FINBIN_county",1.15,1.15,122084.09999999999,92747.61,34310.79,34310.79,58436.82,-23.620149182632357,-7125641.124468787,219.21385081736747,14.387350817367656,133.74952178021906,8.39514514315759,-137.97329541138478,-11.712174720561308,19.10103608049414],
[2001,"M1_fixed","FINBIN_state",0.85,0.85,317267.64,309786.66,79316.91,79316.91,230469.75,-36.37507016632527,-28517524.37429006,160.0854298336747,0.021929833674716688,151.3839583961016,9.502017548663579,-119.0106349121059,-29.607896930735848,-6.907981319720747],
[2001,"M1_fixed","FINBIN_state",0.85,1.0,317267.64,317245.86,79316.91,79316.91,237928.94999999998,-71.0445701663253,-55697906.61887859,160.0854298336747,-28.22457016632529,178.09877458364895,11.178844174898328,-153.6801349121059,-64.27739693073585,-41.57748131972075],
[2001,"M1_fixed","FINBIN_state",0.85,1.15,317267.64,317267.64,79316.91,79316.91,237950.72999999998,-105.71407016632531,-82878288.86346713,160.0854298336747,-56.47107016632527,204.81359077119626,12.855670801133076,-188.34963491210587,-98.94689693073582,-76.24698131972072],
[2001,"M1_fixed","FINBIN_state",1.0,0.85,317267.64,160143.3,79316.91,79316.91,80826.39,-8.12470019567679,-6369646.431046835,188.33579980432313,28.272299804323197,128.67636463668634,8.076714916364041,-105.34301166130105,-0.1633199185127978,26.542463153269736],
[2001,"M1_fixed","FINBIN_state",1.0,1.0,317267.64,309786.66,79316.91,79316.91,230469.75,-42.794200195676815,-33550028.67563538,188.33579980432313,0.025799804323204917,151.3839583961016,9.502017548663579,-140.01251166130106,-34.8328199185128,-8.127036846730263],
[2001,"M1_fixed","FINBIN_state",1.0,1.15,317267.64,317188.62,79316.91,79316.91,237871.71,-77.46370019567672,-60730410.920223825,188.33579980432313,-28.220700195676784,174.0915521555168,10.927320180963113,-174.68201166130103,-69.50231991851277,-42.796536846730234],
[2001,"M1_fixed","FINBIN_state",1.15,0.85,317267.64,41198.58,79316.91,41198.58,38118.33,20.12566977497166,15778231.512196356,216.58616977497155,56.522669774971675,111.89249098842292,7.023230362055688,-91.67538841049623,29.28125709371028,59.99290762626016],
[2001,"M1_fixed","FINBIN_state",1.15,1.0,317267.64,202077.81,79316.91,79316.91,122760.9,-14.543830225028325,-11402150.732392153,216.58616977497155,28.276169774971656,131.63822469226224,8.262623955359633,-126.34488841049622,-5.388242906289719,25.323407626260163],
[2001,"M1_fixed","FINBIN_state",1.15,1.15,317267.64,309786.66,79316.91,79316.91,230469.75,-49.21333022502833,-38582532.97698068,216.58616977497155,0.029669774971671125,151.38395839610158,9.502017548663577,-161.01438841049617,-40.05774290628969,-9.346092373739808],
[2001,"M2_HI_sensitivity","UNL",0.85,0.85,317267.64,68255.37,79316.91,68255.37,11061.539999999999,6.237736129192789,4890294.129778047,203.4122361291927,null,119.5721649484536,7.505265562544312,-98.7629814639211,14.836431473016688,43.68003453656831],
[2001,"M2_HI_sensitivity","UNL",0.85,1.0,317267.64,283936.86,79316.91,79316.91,204619.94999999998,-28.557763870807257,-22388870.276734337,203.4122361291927,null,140.67313523347482,8.829724191228602,-133.5584814639211,-19.959068526983316,8.884534536568303],
[2001,"M2_HI_sensitivity","UNL",0.85,1.15,317267.64,315858.06,79316.91,79316.91,236541.15,-63.35326387080722,-49668034.68324666,203.4122361291927,null,161.77410551849604,10.154182819912892,-168.35398146392106,-54.75456852698329,-25.910965463431673],
[2001,"M2_HI_sensitivity","UNL",1.0,0.85,317267.64,30840.75,79316.91,30840.75,48476.159999999996,42.13401309316798,33032451.61801593,239.30851309316782,null,101.63634020618557,6.3794757281626655,-81.39624289873069,52.25012526237256,86.18377592537449],
[2001,"M2_HI_sensitivity","UNL",1.0,1.0,317267.64,68255.37,79316.91,68255.37,11061.539999999999,7.338513093167979,5753287.211503578,239.30851309316782,null,119.5721649484536,7.505265562544312,-116.1917428987307,17.45462526237256,51.38827592537449],
[2001,"M2_HI_sensitivity","UNL",1.0,1.15,317267.64,265035.6,79316.91,79316.91,185718.69,-27.456986906831993,-21525877.19500875,239.30851309316782,null,137.50798969072164,8.631055396925959,-150.98724289873067,-17.340874737627416,16.59277592537451],
[2001,"M2_HI_sensitivity","UNL",1.15,0.85,317267.64,27381.239999999998,79316.91,27381.239999999998,51935.67,78.03029005714313,61174609.10625378,275.20479005714316,null,88.37942626624832,5.547370198402318,-64.0295043335403,89.66381905172844,128.68751731418064],
[2001,"M2_HI_sensitivity","UNL",1.15,1.0,317267.64,32118.75,79316.91,32118.75,47198.159999999996,43.23479005714315,33895444.699741445,275.20479005714316,null,103.97579560735097,6.526317880473316,-98.8250043335403,54.868319051728434,93.89201731418063],
[2001,"M2_HI_sensitivity","UNL",1.15,1.15,317267.64,68255.37,79316.91,68255.37,11061.539999999999,8.439290057143175,6616280.293229115,275.20479005714316,null,119.5721649484536,7.505265562544312,-133.62050433354028,20.07281905172846,59.09651731418066],
[2001,"M2_HI_sensitivity","ERS_Heartland",0.85,0.85,317267.64,317243.61,79316.91,79316.91,237926.69999999998,-89.77826387080717,-70384849.1978272,203.4122361291927,null,177.79896907216494,11.16002608306423,-194.77898146392107,-81.1795685269833,-52.335965463431684],
[2001,"M2_HI_sensitivity","ERS_Heartland",0.85,1.0,317267.64,317267.64,79316.91,79316.91,237950.72999999998,-141.5177638708073,-110947862.42685825,203.4122361291927,null,209.17525773195877,13.1294424506638,-246.5184814639211,-132.91906852698332,-104.0754654634317],
[2001,"M2_HI_sensitivity","ERS_Heartland",0.85,1.15,317267.64,317267.64,79316.91,79316.91,237950.72999999998,-193.25726387080718,-151510875.65588906,203.4122361291927,null,240.55154639175257,15.09885881826337,-298.25798146392106,-184.6585685269833,-155.81496546343166],
[2001,"M2_HI_sensitivity","ERS_Heartland",1.0,0.85,317267.64,309509.73,79316.91,79316.91,230192.81999999998,-53.88198690683199,-42242691.70958933,239.30851309316782,null,151.1291237113402,9.486022170604597,-177.41224289873068,-43.76587473762743,-9.8322240746255],
[2001,"M2_HI_sensitivity","ERS_Heartland",1.0,1.0,317267.64,317243.61,79316.91,79316.91,237926.69999999998,-105.621486906832,-82805704.93862028,239.30851309316782,null,177.79896907216497,11.160026083064231,-229.1517428987307,-95.50537473762745,-61.57172407462552],
[2001,"M2_HI_sensitivity","ERS_Heartland",1.0,1.15,317267.64,317267.64,79316.91,79316.91,237950.72999999998,-157.36098690683198,-123368718.16765119,239.30851309316782,null,204.4688144329897,12.834029995523865,-280.89124289873064,-147.2448747376274,-113.31122407462549],
[2001,"M2_HI_sensitivity","ERS_Heartland",1.15,0.85,317267.64,199015.11,79316.91,79316.91,119698.2,-17.985709942856833,-14100534.221351476,275.20479005714316,null,131.41662931420888,8.248714930960519,-160.0455043335403,-6.3521809482715526,32.67151731418065],
[2001,"M2_HI_sensitivity","ERS_Heartland",1.15,1.0,317267.64,312620.76,79316.91,79316.91,233303.85,-69.7252099428569,-54663547.45038246,275.20479005714316,null,154.60779919318693,9.704370507012376,-211.78500433354031,-58.09168094827157,-19.067982685819374],
[2001,"M2_HI_sensitivity","ERS_Heartland",1.15,1.15,317267.64,317243.61,79316.91,79316.91,237926.69999999998,-121.46470994285671,-95226560.67941324,275.20479005714316,null,177.79896907216494,11.16002608306423,-263.52450433354034,-109.83118094827154,-70.80748268581934],
[2001,"M2_HI_sensitivity","FINBIN_county",0.85,0.85,122084.09999999999,92747.61,34310.79,34310.79,58436.82,-17.458371134989136,-5266778.222433452,162.0276288650108,10.63412886501086,133.74952178021906,8.39514514315759,-101.98026182580617,-8.656824793458355,14.118157102973928],
[2001,"M2_HI_sensitivity","FINBIN_county",0.85,1.0,122084.09999999999,121344.12,34310.79,34310.79,87033.33,-49.13237113498914,-14822075.914726496,162.0276288650108,-16.082371134989124,157.3523785649636,9.876641344891283,-133.65426182580617,-40.33082479345836,-17.55584289702608],
[2001,"M2_HI_sensitivity","FINBIN_county",0.85,1.15,122084.09999999999,122083.37999999999,34310.79,34310.79,87772.59,-80.8063711349891,-24377373.60701953,162.0276288650108,-42.7988711349891,180.95523534970812,11.358137546624974,-165.32826182580615,-72.00482479345834,-49.22984289702605],
[2001,"M2_HI_sensitivity","FINBIN_county",1.0,0.85,122084.09999999999,19919.61,34310.79,19919.61,14391.18,11.134739841189257,3359088.0188419237,190.62073984118925,39.227239841189245,113.6870935131862,7.135873371683951,-88.30277861859548,21.489500242990175,48.28359659173404],
[2001,"M2_HI_sensitivity","FINBIN_county",1.0,1.0,122084.09999999999,92747.61,34310.79,34310.79,58436.82,-20.53926015881076,-6196209.673451123,190.62073984118925,12.510739841189267,133.74952178021906,8.39514514315759,-119.97677861859549,-10.184499757009831,16.609596591734032],
[2001,"M2_HI_sensitivity","FINBIN_county",1.0,1.15,122084.09999999999,120727.62,34310.79,34310.79,86416.83,-52.213260158810755,-15751507.365744162,190.62073984118925,-14.20576015881071,153.8119500472519,9.654416914631229,-151.65077861859547,-41.85849975700981,-15.064403408265944],
[2001,"M2_HI_sensitivity","FINBIN_county",1.15,0.85,122084.09999999999,15008.939999999999,34310.79,15008.939999999999,19301.85,39.7278508173676,11984954.260117287,219.21385081736747,67.82035081736764,98.8583421853793,6.205107279725175,-74.62529541138481,51.63582527943868,82.44903608049412],
[2001,"M2_HI_sensitivity","FINBIN_county",1.15,1.0,122084.09999999999,22939.649999999998,34310.79,22939.649999999998,11371.14,8.05385081736762,2429656.567824248,219.21385081736747,41.103850817367636,116.30393198279918,7.300126211441383,-106.29929541138482,19.96182527943867,50.77503608049412],
[2001,"M2_HI_sensitivity","FINBIN_county",1.15,1.15,122084.09999999999,92747.61,34310.79,34310.79,58436.82,-23.620149182632357,-7125641.124468787,219.21385081736747,14.387350817367656,133.74952178021906,8.39514514315759,-137.97329541138478,-11.712174720561308,19.10103608049414],
[2001,"M2_HI_sensitivity","FINBIN_state",0.85,0.85,317267.64,309786.66,79316.91,79316.91,230469.75,-36.37507016632527,-28517524.37429006,160.0854298336747,0.021929833674716688,151.3839583961016,9.502017548663579,-119.0106349121059,-29.607896930735848,-6.907981319720747],
[2001,"M2_HI_sensitivity","FINBIN_state",0.85,1.0,317267.64,317245.86,79316.91,79316.91,237928.94999999998,-71.0445701663253,-55697906.61887859,160.0854298336747,-28.22457016632529,178.09877458364895,11.178844174898328,-153.6801349121059,-64.27739693073585,-41.57748131972075],
[2001,"M2_HI_sensitivity","FINBIN_state",0.85,1.15,317267.64,317267.64,79316.91,79316.91,237950.72999999998,-105.71407016632531,-82878288.86346713,160.0854298336747,-56.47107016632527,204.81359077119626,12.855670801133076,-188.34963491210587,-98.94689693073582,-76.24698131972072],
[2001,"M2_HI_sensitivity","FINBIN_state",1.0,0.85,317267.64,160143.3,79316.91,79316.91,80826.39,-8.12470019567679,-6369646.431046835,188.33579980432313,28.272299804323197,128.67636463668634,8.076714916364041,-105.34301166130105,-0.1633199185127978,26.542463153269736],
[2001,"M2_HI_sensitivity","FINBIN_state",1.0,1.0,317267.64,309786.66,79316.91,79316.91,230469.75,-42.794200195676815,-33550028.67563538,188.33579980432313,0.025799804323204917,151.3839583961016,9.502017548663579,-140.01251166130106,-34.8328199185128,-8.127036846730263],
[2001,"M2_HI_sensitivity","FINBIN_state",1.0,1.15,317267.64,317188.62,79316.91,79316.91,237871.71,-77.46370019567672,-60730410.920223825,188.33579980432313,-28.220700195676784,174.0915521555168,10.927320180963113,-174.68201166130103,-69.50231991851277,-42.796536846730234],
[2001,"M2_HI_sensitivity","FINBIN_state",1.15,0.85,317267.64,41198.58,79316.91,41198.58,38118.33,20.12566977497166,15778231.512196356,216.58616977497155,56.522669774971675,111.89249098842292,7.023230362055688,-91.67538841049623,29.28125709371028,59.99290762626016],
[2001,"M2_HI_sensitivity","FINBIN_state",1.15,1.0,317267.64,202077.81,79316.91,79316.91,122760.9,-14.543830225028325,-11402150.732392153,216.58616977497155,28.276169774971656,131.63822469226224,8.262623955359633,-126.34488841049622,-5.388242906289719,25.323407626260163],
[2001,"M2_HI_sensitivity","FINBIN_state",1.15,1.15,317267.64,309786.66,79316.91,79316.91,230469.75,-49.21333022502833,-38582532.97698068,216.58616977497155,0.029669774971671125,151.38395839610158,9.502017548663577,-161.01438841049617,-40.05774290628969,-9.346092373739808],
[2009,"M1_fixed","ERS_Heartland",0.85,0.85,257156.19,160173.0,64289.159999999996,64289.159999999996,95883.84,-32.4196399744184,-20600955.96880332,444.2518600255816,null,156.64525139664804,9.832256623857035,-265.68396663029887,-11.12814794431847,53.314963205306924],
[2009,"M1_fixed","ERS_Heartland",0.85,1.0,257156.19,251450.72999999998,64289.159999999996,64289.159999999996,187161.57,-116.53813997441834,-74053786.29107678,444.2518600255816,null,184.28853105488002,11.567360733949451,-349.8024666302988,-95.24664794431845,-30.80353679469306],
[2009,"M1_fixed","ERS_Heartland",0.85,1.15,257156.19,256971.87,64289.159999999996,64289.159999999996,192682.71,-200.6566399744183,-127506616.61335026,444.2518600255816,null,211.93181071311201,13.302464844041868,-433.9209666302987,-179.36514794431838,-114.92203679469299],
[2009,"M1_fixed","ERS_Heartland",1.0,0.85,257156.19,37019.43,64289.159999999996,37019.43,27269.73,45.97774708891952,29216411.535446063,522.6492470889197,null,133.14846368715084,8.357418130278479,-228.4508725062339,71.0265612419783,146.84198612389054],
[2009,"M1_fixed","ERS_Heartland",1.0,1.0,257156.19,160173.0,64289.159999999996,64289.159999999996,95883.84,-38.14075291108046,-24236418.78682743,522.6492470889197,null,156.64525139664804,9.832256623857035,-312.5693725062339,-13.091938758021683,62.72348612389055],
[2009,"M1_fixed","ERS_Heartland",1.0,1.15,257156.19,249308.28,64289.159999999996,64289.159999999996,185019.12,-122.25925291108045,-77689249.10910091,522.6492470889197,null,180.1420391061452,11.307095117435587,-396.6878725062338,-97.21043875802161,-21.395013876109374],
[2009,"M1_fixed","ERS_Heartland",1.15,0.85,257156.19,26410.59,64289.159999999996,26410.59,37878.57,124.37513415225754,79033779.0396955,601.046634152257,null,115.78127277143551,7.267320113285634,-191.21777838216903,153.181270428275,240.36900904247403],
[2009,"M1_fixed","ERS_Heartland",1.15,1.0,257156.19,41931.36,64289.159999999996,41931.36,22357.8,40.2566341522574,25580948.717421915,601.046634152257,null,136.21326208404176,8.549788368571333,-275.336278382169,69.06277042827503,156.25050904247405],
[2009,"M1_fixed","ERS_Heartland",1.15,1.15,257156.19,160173.0,64289.159999999996,64289.159999999996,95883.84,-43.86186584774247,-27871881.604851507,601.046634152257,null,156.645251396648,9.832256623857033,-359.4547783821689,-15.055729571724896,72.13200904247412],
[2009,"M1_fixed","FINBIN_county",0.85,0.85,91253.7,15038.189999999999,31555.71,15038.189999999999,16517.52,25.922729532788537,5845388.956407135,347.61372953278857,92.64772953278853,130.6091966875249,8.198034270543118,-155.95816183713367,44.49394373724675,99.7256321152045],
[2009,"M1_fixed","FINBIN_county",0.85,1.0,91253.7,58570.2,31555.71,31555.71,27014.489999999998,-30.846270467211472,-6955612.00479761,347.61372953278857,47.65372953278852,153.65787845591166,9.644746200638963,-212.72716183713368,-12.275056262753253,42.9566321152045],
[2009,"M1_fixed","FINBIN_county",0.85,1.15,91253.7,88420.86,31555.71,31555.71,56865.15,-87.61527046721145,-19756612.96600235,347.61372953278857,2.6597295327885466,176.70656022429839,11.091458130734807,-269.4961618371336,-69.0440562627532,-13.812367884795448],
[2009,"M1_fixed","FINBIN_county",1.0,0.85,91253.7,11290.949999999999,31555.71,11290.949999999999,20264.76,87.26632886210409,19677929.145213123,408.9573288621042,153.99132886210413,111.0178171843962,6.968329129961653,-126.71119039662786,109.11481616146676,174.09327307671123],
[2009,"M1_fixed","FINBIN_county",1.0,1.0,91253.7,15038.189999999999,31555.71,15038.189999999999,16517.52,30.497328862104148,6876928.1840083925,408.9573288621042,108.9973288621041,130.60919668752493,8.19803427054312,-183.48019039662788,52.34581616146676,117.32427307671121],
[2009,"M1_fixed","FINBIN_county",1.0,1.15,91253.7,49487.22,31555.71,31555.71,17931.51,-26.271671137895797,-5924072.777196341,408.9573288621042,64.00332886210418,150.20057619065366,9.427739411124588,-240.24919039662782,-4.423183838533191,60.555273076711266],
[2009,"M1_fixed","FINBIN_county",1.15,0.85,91253.7,10623.06,31555.71,10623.06,20932.649999999998,148.60992819141964,33510469.33401911,470.30092819141964,215.33492819141975,96.53723233425755,6.059416634749263,-97.46421895612208,173.73568858568675,248.46091403821785],
[2009,"M1_fixed","FINBIN_county",1.15,1.0,91253.7,11534.13,31555.71,11534.13,20021.579999999998,91.84092819141972,20709468.372814383,470.30092819141964,170.34092819141975,113.57321451089125,7.128725452646192,-154.2332189561221,116.96668858568674,191.69191403821785],
[2009,"M1_fixed","FINBIN_county",1.15,1.15,91253.7,15038.189999999999,31555.71,15038.189999999999,16517.52,35.07192819141976,7908467.411609648,470.30092819141964,125.34692819141978,130.60919668752493,8.19803427054312,-211.00221895612205,60.19768858568679,134.9229140382179],
[2009,"M1_fixed","FINBIN_state",0.85,0.85,257156.19,57344.04,64289.159999999996,57344.04,6945.12,11.502775703327346,7309401.830811616,370.37277570332736,78.44027570332734,141.4573118554093,8.878945126536534,-182.96969342968018,29.25349260882166,82.97971437426435],
[2009,"M1_fixed","FINBIN_state",0.85,1.0,257156.19,228518.81999999998,64289.159999999996,64289.159999999996,164229.66,-51.82722429667269,-32933443.016749654,370.37277570332736,26.922775703327368,166.42036688871684,10.445817795925334,-246.29969342968016,-34.076507391178325,19.649714374264363],
[2009,"M1_fixed","FINBIN_state",0.85,1.15,257156.19,253940.03999999998,64289.159999999996,64289.159999999996,189650.88,-115.1572242966726,-73176287.86431085,370.37277570332736,-24.594724296672624,191.38342192202435,12.012690465314135,-309.6296934296802,-97.40650739117831,-43.68028562573562],
[2009,"M1_fixed","FINBIN_state",1.0,0.85,257156.19,27979.11,64289.159999999996,27979.11,36310.049999999996,76.8626772980322,48842141.11910434,435.732677298032,143.80017729803214,120.23871507709792,7.547103357556055,-151.92846285844723,97.7458736574373,160.95319338148755],
[2009,"M1_fixed","FINBIN_state",1.0,1.0,257156.19,57344.04,64289.159999999996,57344.04,6945.12,13.532677298032198,8599296.271543093,435.732677298032,92.28267729803216,141.4573118554093,8.878945126536534,-215.25846285844722,34.41587365743732,97.62319338148757],
[2009,"M1_fixed","FINBIN_state",1.0,1.15,257156.19,210411.27,64289.159999999996,64289.159999999996,146122.11,-49.79732270196777,-31643548.576018132,435.732677298032,40.76517729803221,162.6759086337207,10.210786895517014,-278.5884628584472,-28.914126342562668,34.29319338148758],
[2009,"M1_fixed","FINBIN_state",1.15,0.85,257156.19,24377.76,64289.159999999996,24377.76,39911.4,142.22257889273698,90374880.407397,501.09257889273715,209.16007889273698,104.55540441486775,6.562698571787873,-120.88723228721435,166.23825470605289,238.92667238871059],
[2009,"M1_fixed","FINBIN_state",1.15,1.0,257156.19,29233.89,64289.159999999996,29233.89,35055.27,78.89257889273699,50132035.559835784,501.09257889273715,157.64257889273702,123.00635813513853,7.720821849162204,-184.21723228721433,102.9082547060529,175.5966723887106],
[2009,"M1_fixed","FINBIN_state",1.15,1.15,257156.19,57344.04,64289.159999999996,57344.04,6945.12,15.56257889273701,9889190.712274546,501.09257889273715,106.125078892737,141.4573118554093,8.878945126536534,-247.5472322872143,39.57825470605292,112.26667238871062],
[2009,"M2_HI_sensitivity","ERS_Heartland",0.85,0.85,257156.19,160173.0,64289.159999999996,64289.159999999996,95883.84,-32.4196399744184,-20600955.96880332,444.2518600255816,null,156.64525139664804,9.832256623857035,-265.68396663029887,-11.12814794431847,53.314963205306924],
[2009,"M2_HI_sensitivity","ERS_Heartland",0.85,1.0,257156.19,251450.72999999998,64289.159999999996,64289.159999999996,187161.57,-116.53813997441834,-74053786.29107678,444.2518600255816,null,184.28853105488002,11.567360733949451,-349.8024666302988,-95.24664794431845,-30.80353679469306],
[2009,"M2_HI_sensitivity","ERS_Heartland",0.85,1.15,257156.19,256971.87,64289.159999999996,64289.159999999996,192682.71,-200.6566399744183,-127506616.61335026,444.2518600255816,null,211.93181071311201,13.302464844041868,-433.9209666302987,-179.36514794431838,-114.92203679469299],
[2009,"M2_HI_sensitivity","ERS_Heartland",1.0,0.85,257156.19,37019.43,64289.159999999996,37019.43,27269.73,45.97774708891952,29216411.535446063,522.6492470889197,null,133.14846368715084,8.357418130278479,-228.4508725062339,71.0265612419783,146.84198612389054],
[2009,"M2_HI_sensitivity","ERS_Heartland",1.0,1.0,257156.19,160173.0,64289.159999999996,64289.159999999996,95883.84,-38.14075291108046,-24236418.78682743,522.6492470889197,null,156.64525139664804,9.832256623857035,-312.5693725062339,-13.091938758021683,62.72348612389055],
[2009,"M2_HI_sensitivity","ERS_Heartland",1.0,1.15,257156.19,249308.28,64289.159999999996,64289.159999999996,185019.12,-122.25925291108045,-77689249.10910091,522.6492470889197,null,180.1420391061452,11.307095117435587,-396.6878725062338,-97.21043875802161,-21.395013876109374],
[2009,"M2_HI_sensitivity","ERS_Heartland",1.15,0.85,257156.19,26410.59,64289.159999999996,26410.59,37878.57,124.37513415225754,79033779.0396955,601.046634152257,null,115.78127277143551,7.267320113285634,-191.21777838216903,153.181270428275,240.36900904247403],
[2009,"M2_HI_sensitivity","ERS_Heartland",1.15,1.0,257156.19,41931.36,64289.159999999996,41931.36,22357.8,40.2566341522574,25580948.717421915,601.046634152257,null,136.21326208404176,8.549788368571333,-275.336278382169,69.06277042827503,156.25050904247405],
[2009,"M2_HI_sensitivity","ERS_Heartland",1.15,1.15,257156.19,160173.0,64289.159999999996,64289.159999999996,95883.84,-43.86186584774247,-27871881.604851507,601.046634152257,null,156.645251396648,9.832256623857033,-359.4547783821689,-15.055729571724896,72.13200904247412],
[2009,"M2_HI_sensitivity","FINBIN_county",0.85,0.85,91253.7,15038.189999999999,31555.71,15038.189999999999,16517.52,25.922729532788537,5845388.956407135,347.61372953278857,92.64772953278853,130.6091966875249,8.198034270543118,-155.95816183713367,44.49394373724675,99.7256321152045],
[2009,"M2_HI_sensitivity","FINBIN_county",0.85,1.0,91253.7,58570.2,31555.71,31555.71,27014.489999999998,-30.846270467211472,-6955612.00479761,347.61372953278857,47.65372953278852,153.65787845591166,9.644746200638963,-212.72716183713368,-12.275056262753253,42.9566321152045],
[2009,"M2_HI_sensitivity","FINBIN_county",0.85,1.15,91253.7,88420.86,31555.71,31555.71,56865.15,-87.61527046721145,-19756612.96600235,347.61372953278857,2.6597295327885466,176.70656022429839,11.091458130734807,-269.4961618371336,-69.0440562627532,-13.812367884795448],
[2009,"M2_HI_sensitivity","FINBIN_county",1.0,0.85,91253.7,11290.949999999999,31555.71,11290.949999999999,20264.76,87.26632886210409,19677929.145213123,408.9573288621042,153.99132886210413,111.0178171843962,6.968329129961653,-126.71119039662786,109.11481616146676,174.09327307671123],
[2009,"M2_HI_sensitivity","FINBIN_county",1.0,1.0,91253.7,15038.189999999999,31555.71,15038.189999999999,16517.52,30.497328862104148,6876928.1840083925,408.9573288621042,108.9973288621041,130.60919668752493,8.19803427054312,-183.48019039662788,52.34581616146676,117.32427307671121],
[2009,"M2_HI_sensitivity","FINBIN_county",1.0,1.15,91253.7,49487.22,31555.71,31555.71,17931.51,-26.271671137895797,-5924072.777196341,408.9573288621042,64.00332886210418,150.20057619065366,9.427739411124588,-240.24919039662782,-4.423183838533191,60.555273076711266],
[2009,"M2_HI_sensitivity","FINBIN_county",1.15,0.85,91253.7,10623.06,31555.71,10623.06,20932.649999999998,148.60992819141964,33510469.33401911,470.30092819141964,215.33492819141975,96.53723233425755,6.059416634749263,-97.46421895612208,173.73568858568675,248.46091403821785],
[2009,"M2_HI_sensitivity","FINBIN_county",1.15,1.0,91253.7,11534.13,31555.71,11534.13,20021.579999999998,91.84092819141972,20709468.372814383,470.30092819141964,170.34092819141975,113.57321451089125,7.128725452646192,-154.2332189561221,116.96668858568674,191.69191403821785],
[2009,"M2_HI_sensitivity","FINBIN_county",1.15,1.15,91253.7,15038.189999999999,31555.71,15038.189999999999,16517.52,35.07192819141976,7908467.411609648,470.30092819141964,125.34692819141978,130.60919668752493,8.19803427054312,-211.00221895612205,60.19768858568679,134.9229140382179],
[2009,"M2_HI_sensitivity","FINBIN_state",0.85,0.85,257156.19,57344.04,64289.159999999996,57344.04,6945.12,11.502775703327346,7309401.830811616,370.37277570332736,78.44027570332734,141.4573118554093,8.878945126536534,-182.96969342968018,29.25349260882166,82.97971437426435],
[2009,"M2_HI_sensitivity","FINBIN_state",0.85,1.0,257156.19,228518.81999999998,64289.159999999996,64289.159999999996,164229.66,-51.82722429667269,-32933443.016749654,370.37277570332736,26.922775703327368,166.42036688871684,10.445817795925334,-246.29969342968016,-34.076507391178325,19.649714374264363],
[2009,"M2_HI_sensitivity","FINBIN_state",0.85,1.15,257156.19,253940.03999999998,64289.159999999996,64289.159999999996,189650.88,-115.1572242966726,-73176287.86431085,370.37277570332736,-24.594724296672624,191.38342192202435,12.012690465314135,-309.6296934296802,-97.40650739117831,-43.68028562573562],
[2009,"M2_HI_sensitivity","FINBIN_state",1.0,0.85,257156.19,27979.11,64289.159999999996,27979.11,36310.049999999996,76.8626772980322,48842141.11910434,435.732677298032,143.80017729803214,120.23871507709792,7.547103357556055,-151.92846285844723,97.7458736574373,160.95319338148755],
[2009,"M2_HI_sensitivity","FINBIN_state",1.0,1.0,257156.19,57344.04,64289.159999999996,57344.04,6945.12,13.532677298032198,8599296.271543093,435.732677298032,92.28267729803216,141.4573118554093,8.878945126536534,-215.25846285844722,34.41587365743732,97.62319338148757],
[2009,"M2_HI_sensitivity","FINBIN_state",1.0,1.15,257156.19,210411.27,64289.159999999996,64289.159999999996,146122.11,-49.79732270196777,-31643548.576018132,435.732677298032,40.76517729803221,162.6759086337207,10.210786895517014,-278.5884628584472,-28.914126342562668,34.29319338148758],
[2009,"M2_HI_sensitivity","FINBIN_state",1.15,0.85,257156.19,24377.76,64289.159999999996,24377.76,39911.4,142.22257889273698,90374880.407397,501.09257889273715,209.16007889273698,104.55540441486775,6.562698571787873,-120.88723228721435,166.23825470605289,238.92667238871059],
[2009,"M2_HI_sensitivity","FINBIN_state",1.15,1.0,257156.19,29233.89,64289.159999999996,29233.89,35055.27,78.89257889273699,50132035.559835784,501.09257889273715,157.64257889273702,123.00635813513853,7.720821849162204,-184.21723228721433,102.9082547060529,175.5966723887106],
[2009,"M2_HI_sensitivity","FINBIN_state",1.15,1.15,257156.19,57344.04,64289.159999999996,57344.04,6945.12,15.56257889273701,9889190.712274546,501.09257889273715,106.125078892737,141.4573118554093,8.878945126536534,-247.5472322872143,39.57825470605292,112.26667238871062],
[2011,"M1_fixed","UNL",0.85,0.85,336546.99,49201.83,84136.77,49201.83,34934.94,89.04156250123603,74049253.83272192,384.73956250123564,172.96206250123595,56.93617021276595,3.5737504438867314,-148.9999387305453,111.57240247092506,218.75669426680878],
[2011,"M1_fixed","UNL",0.85,1.0,336546.99,60505.2,84136.77,60505.2,23631.57,36.859562501236084,30653360.331353363,384.73956250123564,135.58956250123606,66.9837296620776,4.2044122869255665,-201.1819387305453,59.39040247092504,166.57469426680876],
[2011,"M1_fixed","UNL",0.85,1.15,336546.99,150923.25,84136.77,84136.77,66786.48,-15.322437498763914,-12742533.170015248,384.73956250123564,98.217062501236,77.03128911138923,4.835074129964402,-253.36393873054527,7.20840247092508,114.3926942668088],
[2011,"M1_fixed","UNL",1.0,0.85,336546.99,48622.049999999996,84136.77,48622.049999999996,35514.72,156.93677941321883,130512662.71633555,452.63477941321906,240.85727941321917,48.39574468085106,3.0376878773037217,-123.1120455653474,183.44364996579418,309.5428167844809],
[2011,"M1_fixed","UNL",1.0,1.0,336546.99,49201.83,84136.77,49201.83,34934.94,104.75477941321886,87116769.21496697,452.63477941321906,203.484779413219,56.93617021276595,3.5737504438867314,-175.2940455653474,131.26164996579416,257.3608167844809],
[2011,"M1_fixed","UNL",1.0,1.15,336546.99,55699.29,84136.77,55699.29,28437.48,52.57277941321894,43720875.71359842,452.63477941321906,166.1122794132187,65.47659574468084,4.109813010469741,-227.47604556534736,79.0796499657942,205.17881678448094],
[2011,"M1_fixed","UNL",1.15,0.85,336546.99,45783.27,84136.77,45783.27,38353.5,224.83199632520157,186976071.59994912,520.5299963252015,308.7524963252017,42.08325624421832,2.6414677193945413,-97.22415240014952,255.31489746066325,400.328939302153],
[2011,"M1_fixed","UNL",1.15,1.0,336546.99,48808.08,84136.77,48808.08,35328.69,172.64999632520167,143580178.0985806,520.5299963252015,271.37999632520143,49.50971322849214,3.1076090816406365,-149.40615240014955,203.13289746066323,348.146939302153],
[2011,"M1_fixed","UNL",1.15,1.15,336546.99,49201.83,84136.77,49201.83,34934.94,120.46799632520177,100184284.59721209,520.5299963252015,234.00749632520174,56.93617021276596,3.573750443886732,-201.5881524001495,150.95089746066327,295.964939302153],
[2011,"M1_fixed","ERS_Heartland",0.85,0.85,336546.99,327364.92,84136.77,84136.77,243228.15,-157.47543749876388,-130960624.63642223,384.73956250123564,null,104.4026186579378,6.553108566618794,-395.51693873054523,-134.94459752907488,-27.76030573319116],
[2011,"M1_fixed","ERS_Heartland",0.85,1.0,336546.99,335870.1,84136.77,84136.77,251733.33,-253.16043749876403,-210534731.98528704,384.73956250123564,null,122.82661018580917,7.709539490139758,-491.2019387305453,-230.62959752907494,-123.44530573319122],
[2011,"M1_fixed","ERS_Heartland",0.85,1.15,336546.99,336539.16,84136.77,84136.77,252402.38999999998,-348.8454374987636,-290108839.3341513,384.73956250123564,null,141.25060171368054,8.86597041366072,-586.8869387305452,-326.3145975290749,-219.13030573319116],
[2011,"M1_fixed","ERS_Heartland",1.0,0.85,336546.99,284131.44,84136.77,84136.77,199994.66999999998,-89.5802205867811,-74497215.75280865,452.63477941321906,null,88.74222585924711,5.570142281625974,-369.6290455653474,-63.07335003420576,63.02581678448098],
[2011,"M1_fixed","ERS_Heartland",1.0,1.0,336546.99,327364.92,84136.77,84136.77,243228.15,-185.26522058678106,-154071323.10167325,452.63477941321906,null,104.4026186579378,6.553108566618794,-465.31404556534744,-158.75835003420582,-32.65918321551908],
[2011,"M1_fixed","ERS_Heartland",1.0,1.15,336546.99,335466.63,84136.77,84136.77,251329.86,-280.95022058678103,-233645430.45053786,452.63477941321906,null,120.06301145662846,7.5360748516116125,-560.9990455653474,-254.44335003420576,-128.34418321551902],
[2011,"M1_fixed","ERS_Heartland",1.15,0.85,336546.99,152582.04,84136.77,84136.77,68445.27,-21.685003674798224,-18033806.869194943,520.5299963252015,null,77.16715292108447,4.8436019840225875,-343.7411524001494,8.797897460663307,153.81193930215306],
[2011,"M1_fixed","ERS_Heartland",1.15,1.0,336546.99,295105.76999999996,84136.77,84136.77,210969.0,-117.37000367479831,-97607914.21805969,520.5299963252015,null,90.78488578951114,5.698355275320691,-439.4261524001495,-86.88710253933675,58.126939302153005],
[2011,"M1_fixed","ERS_Heartland",1.15,1.15,336546.99,327364.92,84136.77,84136.77,243228.15,-213.05500367479831,-177182021.56692433,520.5299963252015,null,104.40261865793781,6.5531085666187945,-535.1111524001494,-182.5721025393367,-37.55806069784694],
[2011,"M1_fixed","FINBIN_county",0.85,0.85,140630.58,105227.73,44497.35,44497.35,60730.38,-53.48237301413609,-18585431.138903122,308.490126985864,6.629626985863928,83.4697217675941,5.239199512424494,-244.92349459286993,-29.77718873937141,56.55761565797033],
[2011,"M1_fixed","FINBIN_county",0.85,1.0,140630.58,134928.0,44497.35,44497.35,90430.65,-117.35987301413608,-40783228.48161816,308.490126985864,-46.63987301413606,98.19967266775777,6.163764132264111,-308.8009945928699,-93.65468873937141,-7.319884342029664],
[2011,"M1_fixed","FINBIN_county",0.85,1.15,140630.58,139904.19,44497.35,44497.35,95406.84,-181.23737301413598,-62981025.82433315,308.490126985864,-99.90937301413607,112.92962356792142,7.0883287521037275,-372.67849459286987,-157.53218873937135,-71.19738434202961],
[2011,"M1_fixed","FINBIN_county",1.0,0.85,140630.58,44628.57,44497.35,44497.35,131.22,0.9570611598399537,332584.2381231434,362.92956115983986,61.06906115983996,70.94926350245498,4.45331958556082,-224.2677877563176,28.845513247798323,130.41587136231806],
[2011,"M1_fixed","FINBIN_county",1.0,1.0,140630.58,105227.73,44497.35,44497.35,60730.38,-62.920438840159996,-21865213.104591873,362.92956115983986,7.799561159839933,83.46972176759411,5.239199512424495,-288.1452877563176,-35.031986752201675,66.53837136231806],
[2011,"M1_fixed","FINBIN_county",1.0,1.15,140630.58,133139.07,44497.35,44497.35,88641.72,-126.79793884015996,-44063010.447306894,362.92956115983986,-45.46993884016006,95.9901800327332,6.025079439288168,-352.02278775631754,-98.90948675220162,2.66087136231812],
[2011,"M1_fixed","FINBIN_county",1.15,0.85,140630.58,26129.61,44497.35,26129.61,18367.739999999998,55.39649533381592,19250599.615149383,417.3689953338157,115.50849533381582,61.69501174126521,3.8724518135311485,-203.61208091976525,87.468215234968,204.27412706666567],
[2011,"M1_fixed","FINBIN_county",1.15,1.0,140630.58,51304.59,44497.35,44497.35,6807.24,-8.481004666184088,-2947197.727565652,417.3689953338157,62.2389953338159,72.58236675442966,4.5558256629778215,-267.4895809197653,23.590715234968002,140.39662706666567],
[2011,"M1_fixed","FINBIN_county",1.15,1.15,140630.58,105227.73,44497.35,44497.35,60730.38,-72.35850466618405,-25144995.07028067,417.3689953338157,8.969495333815882,83.4697217675941,5.239199512424494,-331.3670809197652,-40.28678476503194,76.51912706666573],
[2011,"M1_fixed","FINBIN_state",0.85,0.85,336546.99,306242.1,84136.77,84136.77,222105.33,-83.04858996148869,-69065343.70870402,314.7939100385112,-15.966589961488676,93.62494254082952,5.876619005349584,-277.8141462693321,-64.61385669828911,23.08433084910294],
[2011,"M1_fixed","FINBIN_state",0.85,1.0,336546.99,331981.56,84136.77,84136.77,247844.78999999998,-153.25608996148873,-127451706.68822451,314.7939100385112,-74.33608996148871,110.14699122450533,6.913669418058334,-348.02164626933217,-134.82135669828915,-47.1231691508971],
[2011,"M1_fixed","FINBIN_state",0.85,1.15,336546.99,336222.54,84136.77,84136.77,252085.77,-223.46358996148854,-185838069.66774482,314.7939100385112,-132.7055899614886,126.66903990818112,7.950719830767084,-418.2291462693321,-205.02885669828908,-117.33066915089702],
[2011,"M1_fixed","FINBIN_state",1.0,0.85,336546.99,183580.56,84136.77,84136.77,99443.79,-27.49672348410431,-22866982.560131304,370.34577651589575,39.58527651589575,79.58120115970509,4.995126154547146,-256.63267208156725,-5.808801997987246,97.36553629306226],
[2011,"M1_fixed","FINBIN_state",1.0,1.0,336546.99,306242.1,84136.77,84136.77,222105.33,-97.70422348410436,-81253345.5396518,370.34577651589575,-18.78422348410432,93.62494254082952,5.876619005349584,-326.8401720815673,-76.01630199798728,27.158036293062224],
[2011,"M1_fixed","FINBIN_state",1.0,1.15,336546.99,330319.8,84136.77,84136.77,246183.03,-167.91172348410436,-139639708.51917225,370.34577651589575,-77.15372348410429,107.66868392195394,6.758111856152021,-397.0476720815672,-146.2238019979872,-43.0494637069377],
[2011,"M1_fixed","FINBIN_state",1.15,0.85,336546.99,71624.61,84136.77,71624.61,12512.16,28.05514299327998,23331378.588441335,425.8976429932802,95.13714299328005,69.20104448670008,4.343587960475779,-235.45119789380234,52.99625270231462,171.64674173702156],
[2011,"M1_fixed","FINBIN_state",1.15,1.0,336546.99,208771.74,84136.77,84136.77,124634.97,-42.15235700672002,-35054984.39107912,425.8976429932802,36.767642993280006,81.4129935137648,5.110103482912682,-305.65869789380235,-17.211247297685418,101.43924173702152],
[2011,"M1_fixed","FINBIN_state",1.15,1.15,336546.99,306242.1,84136.77,84136.77,222105.33,-112.35985700671995,-93441347.37059954,425.8976429932802,-21.601857006719968,93.62494254082951,5.876619005349583,-375.86619789380234,-87.41874729768534,31.231741737021594],
[2011,"M2_HI_sensitivity","UNL",0.85,0.85,336546.99,49231.979999999996,84136.77,49231.979999999996,34904.79,83.73631379657422,69637272.5405948,379.4343137965742,167.65681379657394,56.93617021276595,3.5737504438867314,-151.02278987867658,105.9564785293988,211.66277308786852],
[2011,"M2_HI_sensitivity","UNL",0.85,1.0,336546.99,64542.6,84136.77,64542.6,19594.17,31.554313796574185,26241379.03922616,379.4343137965742,130.28431379657428,66.9837296620776,4.2044122869255665,-203.2047898786766,53.77447852939878,159.4807730878685],
[2011,"M2_HI_sensitivity","UNL",0.85,1.15,336546.99,164296.71,84136.77,84136.77,80159.94,-20.62768620342582,-17154514.462142453,379.4343137965742,92.91181379657407,77.03128911138923,4.835074129964402,-255.38678987867655,1.592478529398818,107.29877308786854],
[2011,"M2_HI_sensitivity","UNL",1.0,0.85,336546.99,48740.4,84136.77,48740.4,35396.369999999995,150.6953103489108,125322096.4903036,446.3933103489111,234.6158103489107,48.39574468085106,3.0376878773037217,-125.49187044550185,176.83668062282214,301.19702716219825],
[2011,"M2_HI_sensitivity","UNL",1.0,1.0,336546.99,49231.979999999996,84136.77,49231.979999999996,34904.79,98.51331034891078,81926202.988935,446.3933103489111,197.24331034891077,56.93617021276595,3.5737504438867314,-177.67387044550185,124.65468062282213,249.01502716219824],
[2011,"M2_HI_sensitivity","UNL",1.0,1.15,336546.99,58392.36,84136.77,58392.36,25744.41,46.33131034891084,38530309.48756644,446.3933103489111,159.8708103489108,65.47659574468084,4.109813010469741,-229.8558704455018,72.47268062282217,196.83302716219828],
[2011,"M2_HI_sensitivity","UNL",1.15,0.85,336546.99,46241.82,84136.77,46241.82,37894.95,217.65430690124754,181006920.4400126,513.3523069012474,301.57480690124714,42.08325624421832,2.6414677193945413,-99.96095101232714,247.71688271624544,390.73128123652793],
[2011,"M2_HI_sensitivity","UNL",1.15,1.0,336546.99,48888.54,84136.77,48888.54,35248.229999999996,165.47230690124724,137611026.93864372,513.3523069012474,264.2023069012472,49.50971322849214,3.1076090816406365,-152.14295101232716,195.53488271624542,338.5492812365279],
[2011,"M2_HI_sensitivity","UNL",1.15,1.15,336546.99,49231.979999999996,84136.77,49231.979999999996,34904.79,113.29030690124732,94215133.43727519,513.3523069012474,226.82980690124737,56.93617021276596,3.573750443886732,-204.32495101232712,143.35288271624546,286.36728123652796],
[2011,"M2_HI_sensitivity","ERS_Heartland",0.85,0.85,336546.99,328825.44,84136.77,84136.77,244688.66999999998,-162.78068620342603,-135372605.92854968,379.4343137965742,null,104.4026186579378,6.553108566618794,-397.5397898786765,-140.56052147060115,-34.85422691213142],
[2011,"M2_HI_sensitivity","ERS_Heartland",0.85,1.0,336546.99,336057.75,84136.77,84136.77,251920.97999999998,-258.4656862034257,-214946713.27741405,379.4343137965742,null,122.82661018580917,7.709539490139758,-493.2247898786766,-236.2455214706012,-130.53922691213148],
[2011,"M2_HI_sensitivity","ERS_Heartland",0.85,1.15,336546.99,336543.20999999996,84136.77,84136.77,252406.44,-354.1506862034261,-294520820.626279,379.4343137965742,null,141.25060171368054,8.86597041366072,-588.9097898786765,-331.93052147060115,-226.22422691213143],
[2011,"M2_HI_sensitivity","ERS_Heartland",1.0,0.85,336546.99,291152.07,84136.77,84136.77,207015.3,-95.82168965108909,-79687781.97884053,446.3933103489111,null,88.74222585924711,5.570142281625974,-372.00887044550177,-69.6803193771778,54.680027162198314],
[2011,"M2_HI_sensitivity","ERS_Heartland",1.0,1.0,336546.99,328825.44,84136.77,84136.77,244688.66999999998,-191.5066896510892,-159261889.3277053,446.3933103489111,null,104.4026186579378,6.553108566618794,-467.69387044550183,-165.36531937717785,-41.004972837801745],
[2011,"M2_HI_sensitivity","ERS_Heartland",1.0,1.15,336546.99,335735.91,84136.77,84136.77,251599.13999999998,-287.19168965108923,-238835996.67656997,446.3933103489111,null,120.06301145662846,7.5360748516116125,-563.3788704455018,-261.0503193771778,-136.6899728378017],
[2011,"M2_HI_sensitivity","ERS_Heartland",1.15,0.85,336546.99,166059.9,84136.77,84136.77,81923.12999999999,-28.86269309875257,-24002958.029131755,513.3523069012474,null,77.16715292108447,4.8436019840225875,-346.4779510123271,1.1998827162454972,144.214281236528],
[2011,"M2_HI_sensitivity","ERS_Heartland",1.15,1.0,336546.99,300547.17,84136.77,84136.77,216410.4,-124.5476930987526,-103577065.37799644,513.3523069012474,null,90.78488578951114,5.698355275320691,-442.16295101232714,-94.48511728375456,48.529281236527936],
[2011,"M2_HI_sensitivity","ERS_Heartland",1.15,1.15,336546.99,328825.44,84136.77,84136.77,244688.66999999998,-220.23269309875275,-183151172.72686124,513.3523069012474,null,104.40261865793781,6.5531085666187945,-537.847951012327,-190.1701172837545,-47.15571876347201],
[2011,"M2_HI_sensitivity","FINBIN_county",0.85,0.85,140630.58,110235.69,44497.35,44497.35,65738.34,-57.73620340887476,-20063661.580493517,304.2362965911252,2.3757965911252024,83.4697217675941,5.239199512424494,-246.53750340062334,-34.35790070592233,50.78642724063204],
[2011,"M2_HI_sensitivity","FINBIN_county",0.85,1.0,140630.58,135850.5,44497.35,44497.35,91353.15,-121.61370340887474,-42261458.92320854,304.2362965911252,-50.893703408874764,98.19967266775777,6.163764132264111,-310.41500340062333,-98.23540070592233,-13.09107275936796],
[2011,"M2_HI_sensitivity","FINBIN_county",0.85,1.15,140630.58,140055.84,44497.35,44497.35,95558.48999999999,-185.49120340887458,-64459256.26592353,304.2362965911252,-104.16320340887481,112.92962356792142,7.0883287521037275,-374.2925034006233,-162.11290070592227,-76.9685727593679],
[2011,"M2_HI_sensitivity","FINBIN_county",1.0,0.85,140630.58,48554.82,44497.35,44497.35,4057.47,-4.047445186911479,-1406510.3990420473,357.92505481308876,56.064554813088506,70.94926350245498,4.45331958556082,-226.16662164779217,23.456440345973732,123.62623793015536],
[2011,"M2_HI_sensitivity","FINBIN_county",1.0,1.0,140630.58,110235.69,44497.35,44497.35,65738.34,-67.92494518691151,-23604307.74175709,357.92505481308876,2.795054813088479,83.46972176759411,5.239199512424495,-290.0441216477921,-40.421059654026266,59.74873793015536],
[2011,"M2_HI_sensitivity","FINBIN_county",1.0,1.15,140630.58,134271.27,44497.35,44497.35,89773.92,-131.80244518691146,-45802105.084472105,357.92505481308876,-50.47444518691151,95.9901800327332,6.025079439288168,-353.92162164779205,-104.2985596540262,-4.128762069844583],
[2011,"M2_HI_sensitivity","FINBIN_county",1.15,0.85,140630.58,26679.51,44497.35,26679.51,17817.84,49.64131303505174,17250640.782409403,411.613813035052,109.75331303505176,61.69501174126521,3.8724518135311485,-205.795739894961,81.27078139786974,196.46604861967856],
[2011,"M2_HI_sensitivity","FINBIN_county",1.15,1.0,140630.58,55932.03,44497.35,44497.35,11434.68,-14.236186964948233,-4947156.560305621,411.613813035052,56.48381303505175,72.58236675442966,4.5558256629778215,-269.673239894961,17.393281397869742,132.58854861967856],
[2011,"M2_HI_sensitivity","FINBIN_county",1.15,1.15,140630.58,110235.69,44497.35,44497.35,65738.34,-78.11368696494816,-27144953.903020628,411.613813035052,3.21431303505174,83.4697217675941,5.239199512424494,-333.55073989496094,-46.4842186021302,68.71104861967864],
[2011,"M2_HI_sensitivity","FINBIN_state",0.85,0.85,336546.99,310249.70999999996,84136.77,84136.77,226112.94,-87.38934445164304,-72675226.80192249,310.4531555483567,-20.307344451643036,93.62494254082952,5.876619005349584,-279.46924307873314,-69.20880566724594,17.280084540493988],
[2011,"M2_HI_sensitivity","FINBIN_state",0.85,1.0,336546.99,332807.22,84136.77,84136.77,248670.44999999998,-157.59684445164314,-131061589.78144301,310.4531555483567,-78.67684445164305,110.14699122450533,6.913669418058334,-349.6767430787332,-139.41630566724598,-52.92741545950605],
[2011,"M2_HI_sensitivity","FINBIN_state",0.85,1.15,336546.99,336328.64999999997,84136.77,84136.77,252191.88,-227.80434445164298,-189447952.76096338,310.4531555483567,-137.04634445164294,126.66903990818112,7.950719830767084,-419.8842430787331,-209.6238056672459,-123.13491545950598],
[2011,"M2_HI_sensitivity","FINBIN_state",1.0,0.85,336546.99,198826.74,84136.77,84136.77,114689.97,-32.6034934725212,-27113903.846270677,365.2390065274787,34.4785065274788,79.58120115970509,4.995126154547146,-258.5798447985096,-11.214624314406933,90.53701122411059],
[2011,"M2_HI_sensitivity","FINBIN_state",1.0,1.0,336546.99,310249.70999999996,84136.77,84136.77,226112.94,-102.81099347252135,-85500266.82579127,365.2390065274787,-23.890993472521227,93.62494254082952,5.876619005349584,-328.78734479850965,-81.42212431440697,20.329511224110547],
[2011,"M2_HI_sensitivity","FINBIN_state",1.0,1.15,336546.99,331378.2,84136.77,84136.77,247241.43,-173.0184934725213,-143886629.80531168,365.2390065274787,-82.26049347252123,107.66868392195394,6.758111856152021,-398.9948447985096,-151.6296243144069,-49.87798877588938],
[2011,"M2_HI_sensitivity","FINBIN_state",1.15,0.85,336546.99,78244.2,84136.77,78244.2,5892.57,22.18235750660058,18447419.10938108,420.02485750660037,89.26435750660059,69.20104448670008,4.343587960475779,-237.69044651828608,46.77955703843196,163.79393790772713],
[2011,"M2_HI_sensitivity","FINBIN_state",1.15,1.0,336546.99,224138.78999999998,84136.77,84136.77,140002.02,-48.02514249339948,-39938943.87013943,420.02485750660037,30.894857506600584,81.4129935137648,5.110103482912682,-307.89794651828606,-23.42794296156808,93.58643790772709],
[2011,"M2_HI_sensitivity","FINBIN_state",1.15,1.15,336546.99,310249.70999999996,84136.77,84136.77,226112.94,-118.23264249339944,-98325306.84965986,420.02485750660037,-27.47464249339942,93.62494254082951,5.876619005349583,-378.10544651828604,-93.635442961568,23.378937907727163],
[2013,"M1_fixed","UNL",0.85,0.85,301600.89,271702.89,75400.29,75400.29,196302.6,-72.79534626232812,-54252335.464760005,309.8661537376718,34.525653737671924,100.71364653243849,6.321560400984833,-261.91278655468193,-50.47235115046033,21.259283759289815],
[2013,"M1_fixed","UNL",0.85,1.0,301600.89,298757.7,75400.29,75400.29,223357.41,-140.32384626232803,-104579437.72525103,309.8661537376718,-14.063846262328102,118.4866429793394,7.437129883511568,-329.44128655468194,-118.00085115046033,-46.26921624071019],
[2013,"M1_fixed","UNL",0.85,1.15,301600.89,301544.82,75400.29,75400.29,226144.53,-207.85234626232818,-154906539.98574227,309.8661537376718,-62.6533462623281,136.25963942624028,8.552699366038302,-396.9697865546819,-185.5293511504603,-113.79771624071014],
[2013,"M1_fixed","UNL",1.0,0.85,301600.89,129069.09,75400.29,75400.29,53668.799999999996,-18.11308383803304,-13499174.756873582,364.5484161619672,89.20791616196686,85.6065995525727,5.3733263408371075,-240.6041900643317,8.149263352399657,92.53942206975273],
[2013,"M1_fixed","UNL",1.0,1.0,301600.89,271702.89,75400.29,75400.29,196302.6,-85.64158383803303,-63826277.01736467,364.5484161619672,40.61841616196699,100.71364653243849,6.321560400984833,-308.1326900643317,-59.37923664760035,25.010922069752723],
[2013,"M1_fixed","UNL",1.0,1.15,301600.89,297306.63,75400.29,75400.29,221906.34,-153.17008383803304,-114153379.27785577,364.5484161619672,-7.971083838033049,115.82069351230425,7.269794461132557,-375.66119006433166,-126.9077366476003,-42.51757793024723],
[2013,"M1_fixed","UNL",1.15,0.85,301600.89,52062.119999999995,75400.29,52062.119999999995,23338.17,36.569178586261955,27253985.951012786,419.2306785862618,143.89017858626224,74.44052135006324,4.672457687684442,-219.29559357398148,66.77087785525958,163.8195603802156],
[2013,"M1_fixed","UNL",1.15,1.0,301600.89,152635.41,75400.29,75400.29,77235.12,-30.95932141373804,-23073116.309478313,419.2306785862618,95.30067858626192,87.57708394125086,5.4970090443346376,-286.8240935739815,-0.7576221447404237,96.29106038021558],
[2013,"M1_fixed","UNL",1.15,1.15,301600.89,271702.89,75400.29,75400.29,196302.6,-98.48782141373798,-73400218.56996936,419.2306785862618,46.711178586261916,100.71364653243847,6.321560400984832,-354.35259357398144,-68.28612214474038,28.762560380215632],
[2013,"M1_fixed","ERS_Heartland",0.85,0.85,301600.89,301600.89,75400.29,75400.29,226200.6,-292.66484626232824,-218114924.00830907,309.8661537376718,null,158.58165548098435,9.953800186237164,-481.7822865546819,-270.3418511504603,-198.61021624071014],
[2013,"M1_fixed","ERS_Heartland",0.85,1.0,301600.89,301600.89,75400.29,75400.29,226200.6,-398.9938462623281,-297358953.65883815,309.8661537376718,null,186.56665350704043,11.710353160279016,-588.111286554682,-376.67085115046035,-304.9392162407102],
[2013,"M1_fixed","ERS_Heartland",0.85,1.15,301600.89,301600.89,75400.29,75400.29,226200.6,-505.32284626232774,-376602983.30936706,309.8661537376718,null,214.55165153309648,13.466906134320869,-694.440286554682,-482.9998511504603,-411.26821624071016],
[2013,"M1_fixed","ERS_Heartland",1.0,0.85,301600.89,301518.45,75400.29,75400.29,226118.16,-237.98258383803292,-177361763.3004225,364.5484161619672,null,134.7944071588367,8.460730158301589,-460.47369006433166,-211.7202366476003,-127.33007793024723],
[2013,"M1_fixed","ERS_Heartland",1.0,1.0,301600.89,301600.89,75400.29,75400.29,226200.6,-344.31158383803296,-256605792.9509517,364.5484161619672,null,158.58165548098435,9.953800186237164,-566.8026900643317,-318.04923664760037,-233.6590779302473],
[2013,"M1_fixed","ERS_Heartland",1.0,1.15,301600.89,301600.89,75400.29,75400.29,226200.6,-450.6405838380331,-335849822.60148096,364.5484161619672,null,182.36890380313199,11.446870214172737,-673.1316900643317,-424.3782366476003,-339.98807793024724],
[2013,"M1_fixed","ERS_Heartland",1.15,0.85,301600.89,298117.35,75400.29,75400.29,222717.06,-183.3003214137381,-136608602.59253624,419.2306785862618,null,117.21252796420582,7.357156659392686,-439.16509357398144,-153.09862214474038,-56.04993961978437],
[2013,"M1_fixed","ERS_Heartland",1.15,1.0,301600.89,301565.79,75400.29,75400.29,226165.5,-289.62932141373807,-215852632.2430654,419.2306785862618,null,137.8970917225951,8.655478422814925,-545.4940935739814,-259.42762214474044,-162.37893961978443],
[2013,"M1_fixed","ERS_Heartland",1.15,1.15,301600.89,301600.89,75400.29,75400.29,226200.6,-395.9583214137379,-295096661.89359444,419.2306785862618,null,158.58165548098435,9.953800186237164,-651.8230935739814,-365.7566221447404,-268.7079396197844],
[2013,"M1_fixed","FINBIN_county",0.85,0.85,120834.0,120810.59999999999,39791.79,39791.79,81018.81,-179.69747441844484,-53655386.69395409,259.1065255815553,-110.01447441844495,132.0337634456454,8.28745099922639,-337.7757961596641,-154.80677558519398,-93.19475003818907],
[2013,"M1_fixed","FINBIN_county",0.85,1.0,120834.0,120834.0,39791.79,39791.79,81042.20999999999,-257.1334744184449,-76776794.1454467,259.1065255815553,-175.15347441844492,155.33383934781813,9.749942352031047,-415.2117961596641,-232.242775585194,-170.63075003818912],
[2013,"M1_fixed","FINBIN_county",0.85,1.15,120834.0,120834.0,39791.79,39791.79,81042.20999999999,-334.5694744184447,-99898201.59693922,259.1065255815553,-240.29247441844498,178.63391524999082,11.212433704835702,-492.64779615966404,-309.67877558519393,-248.06675003818904],
[2013,"M1_fixed","FINBIN_county",1.0,0.85,120834.0,119042.81999999999,39791.79,39791.79,79251.03,-133.97279343346457,-40002576.89433577,304.8312065665354,-64.2897934334646,112.2286989287986,7.044333349342431,-319.9472895996048,-104.68961833552231,-32.2048823978695],
[2013,"M1_fixed","FINBIN_county",1.0,1.0,120834.0,120810.59999999999,39791.79,39791.79,81018.81,-211.40879343346455,-63123984.345828354,304.8312065665354,-129.42879343346453,132.0337634456454,8.28745099922639,-397.38328959960484,-182.12561833552235,-109.64088239786953],
[2013,"M1_fixed","FINBIN_county",1.0,1.15,120834.0,120834.0,39791.79,39791.79,81042.20999999999,-288.8447934334644,-86245391.7973209,304.8312065665354,-194.5677934334646,151.83882796249222,9.530568649110348,-474.81928959960476,-259.56161833552227,-187.07688239786944],
[2013,"M1_fixed","FINBIN_county",1.15,0.85,120834.0,106596.09,39791.79,39791.79,66804.3,-88.24811244848429,-26349767.094717447,350.55588755151587,-18.56511244848432,97.59017298156401,6.125507260297767,-302.1187830395455,-54.572461085850705,28.784985242450077],
[2013,"M1_fixed","FINBIN_county",1.15,1.0,120834.0,119659.95,39791.79,39791.79,79868.16,-165.68411244848434,-49471174.54621004,350.55588755151587,-83.70411244848434,114.81196821360473,7.20647912976208,-379.55478303954555,-132.00846108585074,-48.65101475754996],
[2013,"M1_fixed","FINBIN_county",1.15,1.15,120834.0,120810.59999999999,39791.79,39791.79,81018.81,-243.12011244848418,-72592581.99770258,350.55588755151587,-148.84311244848422,132.0337634456454,8.28745099922639,-456.9907830395455,-209.44446108585066,-126.08701475754988],
[2013,"M1_fixed","FINBIN_state",0.85,0.85,301600.89,301600.8,75400.29,75400.29,226200.50999999998,-237.3272205533032,-176873339.374993,262.11577944669665,-149.68372055330332,155.39622228340252,9.753857983217735,-397.3016632966054,-218.44419898817432,-157.7664090180167],
[2013,"M1_fixed","FINBIN_state",0.85,1.0,301600.89,301600.89,75400.29,75400.29,226200.6,-325.4642205533031,-242559380.26043987,262.11577944669665,-222.35422055330307,182.81908503929708,11.475127039079688,-485.4386632966054,-306.5811989881743,-245.9034090180167],
[2013,"M1_fixed","FINBIN_state",0.85,1.15,301600.89,301600.89,75400.29,75400.29,226200.6,-413.6012205533028,-308245421.14588666,262.11577944669665,-295.0247205533033,210.24194779519163,13.19639609494164,-573.5756632966054,-394.71819898817427,-334.04040901801665],
[2013,"M1_fixed","FINBIN_state",1.0,0.85,301600.89,301428.08999999997,75400.29,75400.29,226027.8,-191.07149476859203,-142400240.73219192,308.37150523140787,-103.42799476859207,132.08678894089215,8.290779285735075,-379.2767215254181,-168.8561752802051,-97.47054002119609],
[2013,"M1_fixed","FINBIN_state",1.0,1.0,301600.89,301600.8,75400.29,75400.29,226200.50999999998,-279.20849476859223,-208086281.617639,308.37150523140787,-176.09849476859213,155.39622228340252,9.753857983217735,-467.4137215254181,-256.9931752802051,-185.6075400211961],
[2013,"M1_fixed","FINBIN_state",1.0,1.15,301600.89,301600.89,75400.29,75400.29,226200.6,-367.3454947685923,-273772322.503086,308.37150523140787,-248.7689947685923,178.70565562591287,11.216936680700393,-555.5507215254181,-345.13017528020504,-273.74454002119603],
[2013,"M1_fixed","FINBIN_state",1.15,0.85,301600.89,296660.88,75400.29,75400.29,221260.59,-144.81576898388093,-107927142.08939086,354.62723101611874,-57.17226898388101,114.85807733990622,7.209373291943543,-361.2517797542309,-119.26815157223587,-37.174671024375584],
[2013,"M1_fixed","FINBIN_state",1.15,1.0,301600.89,301524.83999999997,75400.29,75400.29,226124.55,-232.95276898388084,-173613182.97483778,354.62723101611874,-129.84276898388103,135.1271498116544,8.48161563758064,-449.3887797542309,-207.40515157223587,-125.31167102437558],
[2013,"M1_fixed","FINBIN_state",1.15,1.15,301600.89,301600.8,75400.29,75400.29,226200.50999999998,-321.0897689838809,-239299223.86028475,354.62723101611874,-202.51326898388086,155.39622228340252,9.753857983217735,-537.5257797542308,-295.5421515722358,-213.44867102437553],
[2013,"M2_HI_sensitivity","UNL",0.85,0.85,301600.89,188941.86,75400.29,75400.29,113541.56999999999,-37.43688602910608,-27900664.03816422,345.2246139708943,69.884113970894,100.71364653243849,6.321560400984833,-248.13429046857837,-12.56663805110469,67.35021090776286],
[2013,"M2_HI_sensitivity","UNL",0.85,1.0,301600.89,286592.58,75400.29,75400.29,211192.28999999998,-104.96538602910601,-78227766.29865527,345.2246139708943,21.29461397089387,118.4866429793394,7.437129883511568,-315.66279046857835,-80.0951380511047,-0.17828909223715073],
[2013,"M2_HI_sensitivity","UNL",0.85,1.15,301600.89,300136.05,75400.29,75400.29,224735.75999999998,-172.49388602910608,-128554868.55914643,345.2246139708943,-27.29488602910607,136.25963942624028,8.552699366038302,-383.19129046857836,-147.62363805110465,-67.7067890922371],
[2013,"M2_HI_sensitivity","UNL",1.0,0.85,301600.89,58998.329999999994,75400.29,58998.329999999994,16401.96,23.485104671639913,17502791.627356734,406.14660467164015,130.80610467163984,85.6065995525727,5.3733263408371075,-224.39419466891573,52.74421993987687,146.7640422444269],
[2013,"M2_HI_sensitivity","UNL",1.0,1.0,301600.89,188941.86,75400.29,75400.29,113541.56999999999,-44.043395328360035,-32824310.63313433,406.14660467164015,82.21660467164,100.71364653243849,6.321560400984833,-291.9226946689157,-14.784280060123137,79.23554224442688],
[2013,"M2_HI_sensitivity","UNL",1.0,1.15,301600.89,281463.39,75400.29,75400.29,206063.1,-111.57189532836003,-83151412.89362544,406.14660467164015,33.627104671639884,115.82069351230425,7.269794461132557,-359.4511946689157,-82.31278006012309,11.70704224442693],
[2013,"M2_HI_sensitivity","UNL",1.15,0.85,301600.89,47433.6,75400.29,47433.6,27966.69,84.40709537238584,62906247.29287764,467.0685953723856,191.72809537238584,74.44052135006324,4.672457687684442,-200.65409886925312,118.05507793085837,226.17787358109086],
[2013,"M2_HI_sensitivity","UNL",1.15,1.0,301600.89,67398.20999999999,75400.29,67398.20999999999,8002.08,16.878595372385895,12579145.032386575,467.0685953723856,143.1385953723858,87.57708394125086,5.4970090443346376,-268.1825988692531,50.526577930858366,158.64937358109086],
[2013,"M2_HI_sensitivity","UNL",1.15,1.15,301600.89,188941.86,75400.29,75400.29,113541.56999999999,-50.64990462761406,-37747957.228104495,467.0685953723856,94.54909537238576,100.71364653243847,6.321560400984832,-335.7110988692531,-17.001922069141585,91.1208735810909],
[2013,"M2_HI_sensitivity","ERS_Heartland",0.85,0.85,301600.89,301592.16,75400.29,75400.29,226191.87,-257.30638602910597,-191763252.5817131,345.2246139708943,null,158.58165548098435,9.953800186237164,-468.00379046857836,-232.43613805110465,-152.5192890922371],
[2013,"M2_HI_sensitivity","ERS_Heartland",0.85,1.0,301600.89,301600.89,75400.29,75400.29,226200.6,-363.6353860291058,-271007282.23224217,345.2246139708943,null,186.56665350704043,11.710353160279016,-574.3327904685784,-338.7651380511047,-258.84828909223717],
[2013,"M2_HI_sensitivity","ERS_Heartland",0.85,1.15,301600.89,301600.89,75400.29,75400.29,226200.6,-469.96438602910644,-350251311.8827718,345.2246139708943,null,214.55165153309648,13.466906134320869,-680.6617904685784,-445.09413805110466,-365.1772890922371],
[2013,"M2_HI_sensitivity","ERS_Heartland",1.0,0.85,301600.89,299743.74,75400.29,75400.29,224343.44999999998,-196.38439532836006,-146359796.91619223,406.14660467164015,null,134.7944071588367,8.460730158301589,-444.2636946689157,-167.1252800601231,-73.10545775557307],
[2013,"M2_HI_sensitivity","ERS_Heartland",1.0,1.0,301600.89,301592.16,75400.29,75400.29,226191.87,-302.71339532836004,-225603826.56672135,406.14660467164015,null,158.58165548098435,9.953800186237164,-550.5926946689158,-273.45428006012315,-179.43445775557313],
[2013,"M2_HI_sensitivity","ERS_Heartland",1.0,1.15,301600.89,301600.89,75400.29,75400.29,226200.6,-409.0423953283598,-304847856.2172504,406.14660467164015,null,182.36890380313199,11.446870214172737,-656.9216946689157,-379.7832800601231,-285.7634577555731],
[2013,"M2_HI_sensitivity","ERS_Heartland",1.15,0.85,301600.89,284311.89,75400.29,75400.29,208911.6,-135.46240462761406,-100956341.2506713,467.0685953723856,null,117.21252796420582,7.357156659392686,-420.5235988692531,-101.81442206914159,6.308373581090905],
[2013,"M2_HI_sensitivity","ERS_Heartland",1.15,1.0,301600.89,300488.67,75400.29,75400.29,225088.38,-241.791404627614,-180200370.9012004,467.0685953723856,null,137.8970917225951,8.655478422814925,-526.8525988692531,-208.14342206914165,-100.02062641890916],
[2013,"M2_HI_sensitivity","ERS_Heartland",1.15,1.15,301600.89,301592.16,75400.29,75400.29,226191.87,-348.1204046276141,-259444400.55172962,467.0685953723856,null,158.58165548098435,9.953800186237164,-633.1815988692531,-314.4724220691416,-206.3496264189091],
[2013,"M2_HI_sensitivity","FINBIN_county",0.85,0.85,120834.0,120243.06,39791.79,39791.79,80451.27,-150.13113530760822,-44827252.835920945,288.6728646923915,-80.44813530760828,132.0337634456454,8.28745099922639,-326.24759150080314,-122.40017313814673,-53.75767969097138],
[2013,"M2_HI_sensitivity","FINBIN_county",0.85,1.0,120834.0,120831.93,39791.79,39791.79,81040.14,-227.56713530760834,-67948660.28741357,288.6728646923915,-145.58713530760826,155.33383934781813,9.749942352031047,-403.6835915008032,-199.83617313814676,-131.1936796909714],
[2013,"M2_HI_sensitivity","FINBIN_county",0.85,1.15,120834.0,120834.0,39791.79,39791.79,81042.20999999999,-305.0031353076083,-91070067.73890613,288.6728646923915,-210.72613530760827,178.63391524999082,11.212433704835702,-481.1195915008031,-277.2721731381467,-208.62967969097133],
[2013,"M2_HI_sensitivity","FINBIN_county",1.0,0.85,120834.0,111486.33,39791.79,39791.79,71694.54,-99.1888650677744,-29616537.061355595,339.61513493222543,-29.5058650677744,112.2286989287986,7.044333349342431,-306.3846958832978,-66.56420369193734,14.191670951798395],
[2013,"M2_HI_sensitivity","FINBIN_county",1.0,1.0,120834.0,120243.06,39791.79,39791.79,80451.27,-176.62486506777452,-52737944.51284821,339.61513493222543,-94.64486506777445,132.0337634456454,8.28745099922639,-383.82069588329784,-144.00020369193737,-63.24432904820164],
[2013,"M2_HI_sensitivity","FINBIN_county",1.0,1.15,120834.0,120828.78,39791.79,39791.79,81036.98999999999,-254.06086506777433,-75859351.96434075,339.61513493222543,-159.78386506777449,151.83882796249222,9.530568649110348,-461.25669588329777,-221.4362036919373,-140.68032904820157],
[2013,"M2_HI_sensitivity","FINBIN_county",1.15,0.85,120834.0,70065.18,39791.79,39791.79,30273.39,-48.24659482794058,-14405821.286790237,390.55740517205925,21.436405172059416,97.59017298156401,6.125507260297767,-286.52180026579254,-10.728234245728004,82.14102159456812],
[2013,"M2_HI_sensitivity","FINBIN_county",1.15,1.0,120834.0,113968.53,39791.79,39791.79,74176.73999999999,-125.68259482794059,-37527228.73828283,390.55740517205925,-43.70259482794061,114.81196821360473,7.20647912976208,-363.95780026579257,-88.16423424572804,4.70502159456808],
[2013,"M2_HI_sensitivity","FINBIN_county",1.15,1.15,120834.0,120243.06,39791.79,39791.79,80451.27,-203.11859482794046,-60648636.18977538,390.55740517205925,-108.84159482794053,132.0337634456454,8.28745099922639,-441.3938002657925,-165.60023424572796,-72.73097840543184],
[2013,"M2_HI_sensitivity","FINBIN_state",0.85,0.85,301600.89,301578.83999999997,75400.29,75400.29,226178.55,-207.4174990420209,-154582460.5152358,292.025500957979,-119.77399904202069,155.39622228340252,9.753857983217735,-385.6464334573704,-186.3797562774294,-118.77809374312335],
[2013,"M2_HI_sensitivity","FINBIN_state",0.85,1.0,301600.89,301600.89,75400.29,75400.29,226200.6,-295.5544990420206,-220268501.40068254,292.025500957979,-192.44449904202085,182.81908503929708,11.475127039079688,-473.7834334573704,-274.5167562774294,-206.91509374312335],
[2013,"M2_HI_sensitivity","FINBIN_state",0.85,1.15,301600.89,301600.89,75400.29,75400.29,226200.6,-383.69149904202055,-285954542.2861295,292.025500957979,-265.11499904202077,210.24194779519163,13.19639609494164,-561.9204334573703,-362.65375627742935,-295.0520937431233],
[2013,"M2_HI_sensitivity","FINBIN_state",1.0,0.85,301600.89,298790.82,75400.29,75400.29,223390.53,-155.88358710825966,-116175677.36777148,343.55941289174024,-68.24008710825973,132.08678894089215,8.290779285735075,-365.56468642043575,-131.1333015028581,-51.601933815439224],
[2013,"M2_HI_sensitivity","FINBIN_state",1.0,1.0,301600.89,301578.83999999997,75400.29,75400.29,226178.55,-244.02058710825983,-181861718.25321856,343.55941289174024,-140.9105871082597,155.39622228340252,9.753857983217735,-453.70168642043575,-219.2703015028581,-139.73893381543922],
[2013,"M2_HI_sensitivity","FINBIN_state",1.0,1.15,301600.89,301600.89,75400.29,75400.29,226200.6,-332.1575871082596,-247547759.13866532,343.55941289174024,-213.58108710825982,178.70565562591287,11.216936680700393,-541.8386864204357,-307.40730150285805,-227.87593381543917],
[2013,"M2_HI_sensitivity","FINBIN_state",1.15,0.85,301600.89,279244.89,75400.29,75400.29,203844.6,-104.34967517449866,-77768894.22030734,395.09332482550155,-16.70617517449874,114.85807733990622,7.209373291943543,-345.48293938350116,-75.88684672828686,15.574226112244844],
[2013,"M2_HI_sensitivity","FINBIN_state",1.15,1.0,301600.89,299845.52999999997,75400.29,75400.29,224445.24,-192.4866751744987,-143454935.10575432,395.09332482550155,-89.37667517449874,135.1271498116544,8.48161563758064,-433.61993938350116,-164.02384672828686,-72.56277388775516],
[2013,"M2_HI_sensitivity","FINBIN_state",1.15,1.15,301600.89,301578.83999999997,75400.29,75400.29,226178.55,-280.62367517449843,-209140975.99120107,395.09332482550155,-162.04717517449882,155.39622228340252,9.753857983217735,-521.756939383501,-252.1608467282868,-160.6997738877551],
[2015,"M1_fixed","UNL",0.85,0.85,306756.72,53779.59,76689.18,53779.59,22909.59,23.191125905388464,17579160.15123906,429.4996259053879,174.13412590538863,133.89635854341736,8.40436174388254,-218.6399361411524,54.31317662218552,123.41113662366827],
[2015,"M1_fixed","UNL",0.85,1.0,306756.72,212000.85,76689.18,76689.18,135311.66999999998,-48.51037409461157,-36771463.30388184,429.4996259053879,129.06962590538845,157.52512769813808,9.887484404567694,-290.3414361411524,-17.388323377814487,51.70963662366825],
[2015,"M1_fixed","UNL",0.85,1.15,306756.72,298735.01999999996,76689.18,76689.18,222045.84,-120.21187409461152,-91122086.75900267,429.4996259053879,84.00512590538845,181.1538968528588,11.370607065252848,-362.04293614115244,-89.0898233778145,-19.991863376331754],
[2015,"M1_fixed","UNL",1.0,0.85,306756.72,46241.009999999995,76689.18,46241.009999999995,30448.17,98.98517753575118,75031988.33893156,505.293677535751,249.92817753575133,113.81190476190476,7.143707482300159,-185.52195428370868,135.59935484963006,216.89107249843326],
[2015,"M1_fixed","UNL",1.0,1.0,306756.72,53779.59,76689.18,53779.59,22909.59,27.28367753575116,20681364.88381068,505.293677535751,204.86367753575118,133.89635854341736,8.40436174388254,-257.2234542837087,63.89785484963005,145.18957249843325],
[2015,"M1_fixed","UNL",1.0,1.15,306756.72,175786.11,76689.18,76689.18,99096.93,-44.417822464248815,-33669258.57131018,505.293677535751,159.79917753575126,153.98081232492999,9.665016005464922,-328.9249542837087,-7.8036451503699595,73.48807249843325],
[2015,"M1_fixed","UNL",1.15,0.85,306756.72,44386.56,76689.18,44386.56,32302.62,174.77922916611382,132484816.52662401,581.0877291661144,325.72222916611366,98.96687370600415,6.211919549826225,-152.403972426265,216.8855330770745,310.37100837319826],
[2015,"M1_fixed","UNL",1.15,1.0,306756.72,46774.619999999995,76689.18,46774.619999999995,29914.559999999998,103.0777291661138,78134193.07150313,581.0877291661144,280.6577291661138,116.43161612471077,7.308140646854383,-224.105472426265,145.1840330770745,238.66950837319823],
[2015,"M1_fixed","UNL",1.15,1.15,306756.72,53779.59,76689.18,53779.59,22909.59,31.37622916611379,23783569.61638225,581.0877291661144,235.5932291661135,133.8963585434174,8.404361743882541,-295.806972426265,73.48253307707449,166.96800837319822],
[2015,"M1_fixed","ERS_Heartland",0.85,0.85,306756.72,305849.07,76689.18,76689.18,229159.88999999998,-172.64037409461145,-130863537.93947728,429.4996259053879,null,198.4313725490196,12.455073867422003,-414.4714361411524,-141.51832337781448,-72.42036337633174],
[2015,"M1_fixed","ERS_Heartland",0.85,1.0,306756.72,306756.72,76689.18,76689.18,230067.53999999998,-278.9003740946116,-211409931.64590114,429.4996259053879,null,233.44867358708188,14.653028079320002,-520.7314361411524,-247.77832337781447,-178.68036337633174],
[2015,"M1_fixed","ERS_Heartland",0.85,1.15,306756.72,306756.72,76689.18,76689.18,230067.53999999998,-385.16037409461126,-291956325.35232466,429.4996259053879,null,268.46597462514416,16.850982291218003,-626.9914361411522,-354.0383233778143,-284.9403633763316],
[2015,"M1_fixed","ERS_Heartland",1.0,0.85,306756.72,278761.23,76689.18,76689.18,202072.05,-96.84632246424884,-73410709.75178486,505.293677535751,null,168.66666666666666,10.586812787308702,-381.3534542837087,-60.232145150369945,21.05957249843327],
[2015,"M1_fixed","ERS_Heartland",1.0,1.0,306756.72,305849.07,76689.18,76689.18,229159.88999999998,-203.1063224642489,-153957103.45820868,505.293677535751,null,198.4313725490196,12.455073867422003,-487.6134542837087,-166.49214515036994,-85.20042750156672],
[2015,"M1_fixed","ERS_Heartland",1.0,1.15,306756.72,306756.72,76689.18,76689.18,230067.53999999998,-309.366322464249,-234503497.16463247,505.293677535751,null,228.1960784313725,14.323334947535301,-593.8734542837085,-272.7521451503698,-191.4604275015666],
[2015,"M1_fixed","ERS_Heartland",1.15,0.85,306756.72,107023.14,76689.18,76689.18,30333.96,-21.052270833886215,-15957881.564092426,581.0877291661144,null,146.66666666666669,9.205924162877134,-348.235472426265,21.054033077074507,114.53950837319823],
[2015,"M1_fixed","ERS_Heartland",1.15,1.0,306756.72,288004.68,76689.18,76689.18,211315.5,-127.31227083388613,-96504275.27051611,581.0877291661144,null,172.54901960784315,10.830499015149568,-454.495472426265,-85.20596692292548,8.279508373198246],
[2015,"M1_fixed","ERS_Heartland",1.15,1.15,306756.72,305849.07,76689.18,76689.18,229159.88999999998,-233.57227083388617,-177050668.97693992,581.0877291661144,null,198.4313725490196,12.455073867422003,-560.7554724262649,-191.46596692292536,-97.98049162680164],
[2015,"M1_fixed","FINBIN_county",0.85,0.85,128283.48,97117.65,41447.34,41447.34,55670.31,-57.40883932309944,-18198336.98661451,370.9996606769007,7.072160676900558,155.3469098907169,9.750762759485776,-261.5067716803708,-21.281567493028717,39.280415144930025],
[2015,"M1_fixed","FINBIN_county",0.85,1.0,128283.48,126924.12,41447.34,41447.34,85476.78,-133.01033932309952,-42163663.405258074,370.9996606769007,-57.150339323099445,182.7610704596669,11.471485599395029,-337.10827168037076,-96.8830674930287,-36.32108485506996],
[2015,"M1_fixed","FINBIN_county",0.85,1.15,128283.48,128279.79,41447.34,41447.34,86832.45,-208.61183932309945,-66128989.82390159,370.9996606769007,-121.37283932309943,210.17523102861693,13.192208439304283,-412.70977168037075,-172.4845674930287,-111.92258485506994],
[2015,"M1_fixed","FINBIN_county",1.0,0.85,128283.48,28189.079999999998,41447.34,28189.079999999998,13258.26,8.061689031647674,2555518.199097039,436.47018903164764,72.54268903164775,132.04487340710932,8.288148345562908,-232.05352550631858,50.564361772907404,121.81375311168246],
[2015,"M1_fixed","FINBIN_county",1.0,1.0,128283.48,97117.65,41447.34,41447.34,55670.31,-67.5398109683523,-21409808.21954649,436.47018903164764,8.320189031647718,155.34690989071686,9.750762759485774,-307.65502550631857,-25.037138227092584,46.21225311168248],
[2015,"M1_fixed","FINBIN_county",1.0,1.15,128283.48,126005.04,41447.34,41447.34,84557.7,-143.14131096835231,-45375134.63819003,436.47018903164764,-55.902310968352275,178.6489463743244,11.213377173408642,-383.25652550631855,-100.63863822709257,-29.389246888317512],
[2015,"M1_fixed","FINBIN_county",1.15,0.85,128283.48,25713.36,41447.34,25713.36,15733.98,73.53221738639479,23309373.38480859,501.9407173863947,138.01321738639484,114.82162904966032,7.207085517880792,-202.6002793322664,122.41029103884341,204.34709107843477],
[2015,"M1_fixed","FINBIN_county",1.15,1.0,128283.48,29430.899999999998,41447.34,29430.899999999998,12016.439999999999,-2.069282613605192,-655953.0338349405,501.9407173863947,73.79071738639482,135.0842694701886,8.478924138683283,-278.20177933226637,46.808791038843424,128.74559107843479],
[2015,"M1_fixed","FINBIN_county",1.15,1.15,128283.48,97117.65,41447.34,41447.34,55670.31,-77.67078261360518,-24621279.452478472,501.9407173863947,9.56821738639484,155.3469098907169,9.750762759485776,-353.80327933226636,-28.792708961156563,53.144091078434805],
[2015,"M1_fixed","FINBIN_state",0.85,0.85,306756.72,303984.26999999996,76689.18,76689.18,227295.09,-129.35772538749296,-98054755.11037509,373.5787746125066,-47.72372538749305,190.54897194564188,11.96031398894851,-339.7023831555743,-102.28776567402298,-42.186360064733265],
[2015,"M1_fixed","FINBIN_state",0.85,1.0,306756.72,306756.18,76689.18,76689.18,230067.0,-218.11122538749305,-165331005.38162568,373.5787746125066,-122.07122538749309,224.17526111251988,14.070957634057072,-428.4558831555743,-191.041265674023,-130.9398600647333],
[2015,"M1_fixed","FINBIN_state",0.85,1.15,306756.72,306756.72,76689.18,76689.18,230067.53999999998,-306.8647253874929,-232607255.65287614,373.5787746125066,-196.41872538749288,257.8015502793978,16.18160127916563,-517.2093831555742,-279.7947656740229,-219.6933600647332],
[2015,"M1_fixed","FINBIN_state",1.0,0.85,306756.72,248236.74,76689.18,76689.18,171547.56,-63.432059279403546,-48082285.152720205,439.5044407205961,18.20194072059641,161.9666261537956,10.166266890606233,-310.89636253596973,-31.5850478517917,39.12248815913734],
[2015,"M1_fixed","FINBIN_state",1.0,1.0,306756.72,303984.26999999996,76689.18,76689.18,227295.09,-152.18555927940363,-115358535.42397082,439.5044407205961,-56.14555927940357,190.5489719456419,11.960313988948512,-399.64986253596976,-120.33854785179173,-49.63101184086269],
[2015,"M1_fixed","FINBIN_state",1.0,1.15,306756.72,306751.68,76689.18,76689.18,230062.5,-240.93905927940352,-182634785.69522125,439.5044407205961,-130.49305927940358,219.13131773748816,13.754361087290786,-488.4033625359697,-209.09204785179165,-138.38451184086261],
[2015,"M1_fixed","FINBIN_state",1.15,0.85,306756.72,69919.56,76689.18,69919.56,6769.62,2.4936068286858606,1890184.804934671,505.430106828686,84.12760682868586,140.8405444815614,8.84023207878803,-282.0903419163652,39.117669970439465,120.43133638300792],
[2015,"M1_fixed","FINBIN_state",1.15,1.0,306756.72,268091.1,76689.18,76689.18,191401.91999999998,-86.25989317131415,-65386065.46631587,505.430106828686,9.780106828685794,165.69475821360166,10.40027303386827,-370.84384191636525,-49.635830029560566,31.67783638300788],
[2015,"M1_fixed","FINBIN_state",1.15,1.15,306756.72,303984.26999999996,76689.18,76689.18,227295.09,-175.01339317131416,-132662315.73756643,505.430106828686,-64.56739317131415,190.5489719456419,11.960313988948512,-459.59734191636517,-138.38933002956048,-57.07566361699204],
[2015,"M2_HI_sensitivity","UNL",0.85,0.85,306756.72,47396.07,76689.18,47396.07,29293.11,76.64411374222753,58097185.77791626,482.9526137422277,227.58711374222753,133.89635854341736,8.40436174388254,-195.28381482866888,111.63945359343387,189.33691993105577],
[2015,"M2_HI_sensitivity","UNL",0.85,1.0,306756.72,66837.42,76689.18,66837.42,9851.76,4.942613742227584,3746562.32279544,482.9526137422277,182.52261374222763,157.52512769813808,9.887484404567694,-266.9853148286689,39.93795359343386,117.63541993105576],
[2015,"M2_HI_sensitivity","UNL",0.85,1.15,306756.72,242303.49,76689.18,76689.18,165614.31,-66.75888625777245,-50604061.13232545,482.9526137422277,137.45811374222762,181.1538968528588,11.370607065252848,-338.6868148286689,-31.76354640656615,45.93391993105575],
[2015,"M2_HI_sensitivity","UNL",1.0,0.85,306756.72,44536.229999999996,76689.18,44536.229999999996,32152.949999999997,161.87104557909132,122700253.78208128,568.1795455790913,312.8140455790913,113.81190476190476,7.143707482300159,-158.0441645043163,203.04203363933397,294.450817565948],
[2015,"M2_HI_sensitivity","UNL",1.0,1.0,306756.72,47396.07,76689.18,47396.07,29293.11,90.16954557909129,68349630.32696037,568.1795455790913,267.74954557909126,133.89635854341736,8.40436174388254,-229.74566450431632,131.34053363933396,222.749317565948],
[2015,"M2_HI_sensitivity","UNL",1.0,1.15,306756.72,58005.99,76689.18,58005.99,18683.19,18.468045579091296,13999006.87183951,568.1795455790913,222.68504557909145,153.98081232492999,9.665016005464922,-301.44716450431633,59.639033639333945,151.04781756594798],
[2015,"M2_HI_sensitivity","UNL",1.15,0.85,306756.72,44055.18,76689.18,44055.18,32634.0,247.0979774159548,187303321.78624603,653.4064774159554,398.0409774159551,98.96687370600415,6.211919549826225,-120.8045141799638,294.444613685234,399.5647152008401],
[2015,"M2_HI_sensitivity","UNL",1.15,1.0,306756.72,44751.78,76689.18,44751.78,31937.399999999998,175.3964774159551,132952698.3311254,653.4064774159554,352.9764774159546,116.43161612471077,7.308140646854383,-192.5060141799638,222.743113685234,327.8632152008401],
[2015,"M2_HI_sensitivity","UNL",1.15,1.15,306756.72,47396.07,76689.18,47396.07,29293.11,103.69497741595497,78602074.87600443,653.4064774159554,307.91197741595516,133.8963585434174,8.404361743882541,-264.2075141799638,151.04161368523398,256.1617152008401],
[2015,"M2_HI_sensitivity","ERS_Heartland",0.85,0.85,306756.72,293999.31,76689.18,76689.18,217310.13,-119.18738625777247,-90345512.31280015,482.9526137422277,null,198.4313725490196,12.455073867422003,-391.1153148286689,-84.19204640656613,-6.494580068944237],
[2015,"M2_HI_sensitivity","ERS_Heartland",0.85,1.0,306756.72,306598.5,76689.18,76689.18,229909.31999999998,-225.4473862577723,-170891906.01922378,482.9526137422277,null,233.44867358708188,14.653028079320002,-497.3753148286689,-190.45204640656613,-112.75458006894422],
[2015,"M2_HI_sensitivity","ERS_Heartland",0.85,1.15,306756.72,306756.72,76689.18,76689.18,230067.53999999998,-331.7073862577725,-251438299.7256477,482.9526137422277,null,268.46597462514416,16.850982291218003,-603.6353148286687,-296.712046406566,-219.0145800689441],
[2015,"M2_HI_sensitivity","ERS_Heartland",1.0,0.85,306756.72,135955.08,76689.18,76689.18,59265.899999999994,-33.9604544209087,-25742444.308635157,568.1795455790913,null,168.66666666666666,10.586812787308702,-353.8756645043163,7.21053363933396,98.61931756594798],
[2015,"M2_HI_sensitivity","ERS_Heartland",1.0,1.0,306756.72,293999.31,76689.18,76689.18,217310.13,-140.2204544209087,-106288838.01505893,568.1795455790913,null,198.4313725490196,12.455073867422003,-460.1356645043163,-99.04946636066603,-7.640682434052005],
[2015,"M2_HI_sensitivity","ERS_Heartland",1.0,1.15,306756.72,306326.33999999997,76689.18,76689.18,229637.16,-246.48045442090867,-186835231.72148263,568.1795455790913,null,228.1960784313725,14.323334947535301,-566.3956645043162,-205.3094663606659,-113.90068243405189],
[2015,"M2_HI_sensitivity","ERS_Heartland",1.15,0.85,306756.72,51253.38,76689.18,51253.38,25435.8,51.2664774159549,38860623.69552971,653.4064774159554,null,146.66666666666669,9.205924162877134,-316.6360141799638,98.613113685234,203.7332152008401],
[2015,"M2_HI_sensitivity","ERS_Heartland",1.15,1.0,306756.72,170292.06,76689.18,76689.18,93602.87999999999,-54.99352258404505,-41685770.01089403,653.4064774159554,null,172.54901960784315,10.830499015149568,-422.8960141799638,-7.646886314765993,97.4732152008401],
[2015,"M2_HI_sensitivity","ERS_Heartland",1.15,1.15,306756.72,293999.31,76689.18,76689.18,217310.13,-161.25352258404487,-122232163.71731766,653.4064774159554,null,198.4313725490196,12.455073867422003,-529.1560141799637,-113.90688631476587,-8.786784799159774],
[2015,"M2_HI_sensitivity","FINBIN_county",0.85,0.85,128283.48,32204.969999999998,41447.34,32204.969999999998,9242.369999999999,-11.236411795712446,-3561890.6563830795,417.17208820428755,53.2445882042876,155.3469098907169,9.750762759485776,-240.73516560563527,29.387032441006,97.48620914734374],
[2015,"M2_HI_sensitivity","FINBIN_county",0.85,1.0,128283.48,114517.62,41447.34,41447.34,73070.28,-86.83791179571246,-27527217.07502662,417.17208820428755,-10.97791179571242,182.7610704596669,11.471485599395029,-316.33666560563523,-46.21446755899399,21.884709147343752],
[2015,"M2_HI_sensitivity","FINBIN_county",0.85,1.15,128283.48,127514.7,41447.34,41447.34,86067.36,-162.43941179571237,-51492543.49367012,417.17208820428755,-75.20041179571236,210.17523102861693,13.192208439304283,-391.9381656056352,-121.81596755899398,-53.71679085265624],
[2015,"M2_HI_sensitivity","FINBIN_county",1.0,0.85,128283.48,25968.78,41447.34,25968.78,15478.56,62.38219200504419,19774866.82289874,490.79069200504387,126.86319200504421,132.04487340710932,8.288148345562908,-207.61634188898267,110.17447934236003,190.2911578204045],
[2015,"M2_HI_sensitivity","FINBIN_county",1.0,1.0,128283.48,32204.969999999998,41447.34,32204.969999999998,9242.369999999999,-13.219307994955795,-4190459.595744791,490.79069200504387,62.6406920050442,155.34690989071686,9.750762759485774,-283.21784188898266,34.57297934236004,114.68965782040449],
[2015,"M2_HI_sensitivity","FINBIN_county",1.0,1.15,128283.48,107534.61,41447.34,41447.34,66087.27,-88.82080799495577,-28155786.014388323,490.79069200504387,-1.5818079949557498,178.6489463743244,11.213377173408642,-358.81934188898265,-41.028520657639945,39.08815782040451],
[2015,"M2_HI_sensitivity","FINBIN_county",1.15,0.85,128283.48,24824.34,41447.34,24824.34,16623.0,136.00079580580083,43111624.30218056,564.4092958058006,200.48179580580074,114.82162904966032,7.207085517880792,-174.49751817233008,190.961926243714,283.0961064934651],
[2015,"M2_HI_sensitivity","FINBIN_county",1.15,1.0,128283.48,26255.61,41447.34,26255.61,15191.73,60.39929580580075,19146297.883537,564.4092958058006,136.25929580580083,135.0842694701886,8.478924138683283,-250.09901817233006,115.36042624371402,207.49460649346506],
[2015,"M2_HI_sensitivity","FINBIN_county",1.15,1.15,128283.48,32204.969999999998,41447.34,32204.969999999998,9242.369999999999,-15.202204194199192,-4819028.535106518,564.4092958058006,72.03679580580085,155.3469098907169,9.750762759485776,-325.70051817233,39.75892624371403,131.89310649346507],
[2015,"M2_HI_sensitivity","FINBIN_state",0.85,0.85,306756.72,281035.08,76689.18,76689.18,204345.9,-82.86431656701035,-62812176.42029125,420.07218343298933,-1.2303165670103915,190.54897194564188,11.96031398894851,-319.3872288379761,-52.425369964431155,15.155886256032405],
[2015,"M2_HI_sensitivity","FINBIN_state",0.85,1.0,306756.72,305970.75,76689.18,76689.18,229281.56999999998,-171.61781656701044,-130088426.69154184,420.07218343298933,-75.5778165670104,224.17526111251988,14.070957634057072,-408.14072883797616,-141.1788699644312,-73.59761374396763],
[2015,"M2_HI_sensitivity","FINBIN_state",0.85,1.15,306756.72,306756.72,76689.18,76689.18,230067.53999999998,-260.37131656701024,-197364676.96279222,420.07218343298933,-149.92531656701036,257.8015502793978,16.18160127916563,-496.8942288379761,-229.9323699644311,-162.35111374396755],
[2015,"M2_HI_sensitivity","FINBIN_state",1.0,0.85,306756.72,87891.20999999999,76689.18,76689.18,11202.029999999999,-8.733931255306315,-6620427.870268608,494.20256874469385,72.90006874469363,161.9666261537956,10.166266890606233,-286.99618098585427,27.076594159492743,106.58395441886167],
[2015,"M2_HI_sensitivity","FINBIN_state",1.0,1.0,306756.72,281035.08,76689.18,76689.18,204345.9,-97.48743125530635,-73896678.14151917,494.20256874469385,-1.4474312553063704,190.5489719456419,11.960313988948512,-375.7496809858543,-61.67690584050729,17.83045441886164],
[2015,"M2_HI_sensitivity","FINBIN_state",1.0,1.15,306756.72,305203.5,76689.18,76689.18,228514.31999999998,-186.24093125530615,-141172928.41276956,494.20256874469385,-75.79493125530635,219.13131773748816,13.754361087290786,-464.5031809858542,-150.4304058405072,-70.92304558113828],
[2015,"M2_HI_sensitivity","FINBIN_state",1.15,0.85,306756.72,49113.0,76689.18,49113.0,27576.18,65.3964540563977,49571320.67975402,568.3329540563975,147.03045405639776,140.8405444815614,8.84023207878803,-254.60513313373244,106.57855828341661,198.01202258169084],
[2015,"M2_HI_sensitivity","FINBIN_state",1.15,1.0,306756.72,112567.59,76689.18,76689.18,35878.409999999996,-23.357045943602312,-17704929.59149652,568.3329540563975,72.6829540563976,165.69475821360166,10.40027303386827,-343.3586331337325,17.82505828341658,109.25852258169083],
[2015,"M2_HI_sensitivity","FINBIN_state",1.15,1.15,306756.72,281035.08,76689.18,76689.18,204345.9,-112.1105459436022,-84981179.86274697,568.3329540563975,-1.6645459436023522,190.5489719456419,11.960313988948512,-432.1121331337324,-70.92844171658334,20.50502258169091],
[2017,"M1_fixed","UNL",0.85,0.85,314033.94,314028.81,78508.53,78508.53,235520.28,-182.87284068563537,-141908367.10101113,373.44365931436414,61.29815931436449,195.37014925373134,12.26292802990798,-389.9416947578372,-146.71013726390436,-96.2744299818491],
[2017,"M1_fixed","UNL",0.85,1.0,314033.94,314033.94,78508.53,78508.53,235525.41,-281.0463406856353,-218090489.1993935,373.44365931436414,6.213659314364531,229.84723441615452,14.426974152832917,-488.1151947578372,-244.88363726390435,-194.4479299818491],
[2017,"M1_fixed","UNL",0.85,1.15,314033.94,314033.94,78508.53,78508.53,235525.41,-379.2198406856355,-294272611.2977761,373.44365931436414,-48.87084068563549,264.3243195785777,16.591020275757852,-586.2886947578372,-343.05713726390434,-292.6214299818491],
[2017,"M1_fixed","UNL",1.0,0.85,314033.94,305936.91,78508.53,78508.53,227428.38,-116.97101845368873,-90768898.0204542,439.3454815463111,127.19998154631118,166.06462686567164,10.423488825421783,-360.5814350092202,-74.42666148694627,-15.090535272763645],
[2017,"M1_fixed","UNL",1.0,1.0,314033.94,314028.81,78508.53,78508.53,235520.28,-215.14451845368868,-166951020.1188366,439.3454815463111,72.1154815463112,195.37014925373134,12.26292802990798,-458.75493500922016,-172.60016148694626,-113.26403527276364],
[2017,"M1_fixed","UNL",1.0,1.15,314033.94,314033.94,78508.53,78508.53,235525.41,-313.31801845368864,-243133142.21721902,439.3454815463111,17.030981546311192,224.67567164179104,14.102367234394176,-556.9284350092203,-270.77366148694625,-211.43753527276363],
[2017,"M1_fixed","UNL",1.15,0.85,314033.94,162412.74,78508.53,78508.53,83904.20999999999,-51.06919622174216,-39629428.93989736,505.2473037782579,193.10180377825804,144.40402336145362,9.063903326453726,-331.2211752606032,-2.143185709988302,66.09335943632175],
[2017,"M1_fixed","UNL",1.15,1.0,314033.94,309515.58,78508.53,78508.53,231007.05,-149.24269622174214,-115811551.03827979,505.2473037782579,138.0173037782578,169.88708630759248,10.663415678180852,-429.3946752606032,-100.31668570998829,-32.08014056367824],
[2017,"M1_fixed","UNL",1.15,1.15,314033.94,314028.81,78508.53,78508.53,235520.28,-247.41619622174218,-191993673.13666227,505.2473037782579,82.93280377825785,195.37014925373137,12.262928029907982,-527.5681752606033,-198.49018570998828,-130.25364056367823],
[2017,"M1_fixed","ERS_Heartland",0.85,0.85,314033.94,314033.94,78508.53,78508.53,235525.41,-220.5618406856354,-171154833.81316802,373.44365931436414,null,208.60597014925372,13.093709598528005,-427.63069475783715,-184.39913726390432,-133.96342998184906],
[2017,"M1_fixed","ERS_Heartland",0.85,1.0,314033.94,314033.94,78508.53,78508.53,235525.41,-325.3863406856353,-252498097.09604868,373.44365931436414,null,245.41878841088675,15.404364233562358,-532.4551947578373,-289.2236372639044,-238.78792998184912],
[2017,"M1_fixed","ERS_Heartland",0.85,1.15,314033.94,314033.94,78508.53,78508.53,235525.41,-430.21084068563556,-333841360.37892956,373.44365931436414,null,282.2316066725197,17.715018868596708,-637.2796947578372,-394.0481372639043,-343.61242998184906],
[2017,"M1_fixed","ERS_Heartland",1.0,0.85,314033.94,312859.17,78508.53,78508.53,234350.63999999998,-154.66001845368868,-120015364.73261108,439.3454815463111,null,177.31507462686565,11.129653158748802,-398.27043500922014,-112.11566148694624,-52.77953527276361],
[2017,"M1_fixed","ERS_Heartland",1.0,1.0,314033.94,314033.94,78508.53,78508.53,235525.41,-259.4845184536888,-201358628.0154919,439.3454815463111,null,208.60597014925375,13.093709598528006,-503.0949350092202,-216.9401614869463,-157.60403527276367],
[2017,"M1_fixed","ERS_Heartland",1.0,1.15,314033.94,314033.94,78508.53,78508.53,235525.41,-364.30901845368885,-282701891.2983727,439.3454815463111,null,239.8968656716418,15.057766038307205,-607.9194350092203,-321.76466148694624,-262.4285352727636],
[2017,"M1_fixed","ERS_Heartland",1.15,0.85,314033.94,264060.27,78508.53,78508.53,185551.74,-88.75819622174208,-68875895.65205419,505.2473037782579,null,154.18702141466582,9.677959268477222,-368.9101752606032,-39.832185709988266,28.404359436321784],
[2017,"M1_fixed","ERS_Heartland",1.15,1.0,314033.94,313580.88,78508.53,78508.53,235072.35,-193.58269622174222,-150219158.93493503,505.2473037782579,null,181.3964957819598,11.385834433502614,-473.73467526060324,-144.65668570998832,-76.42014056367827],
[2017,"M1_fixed","ERS_Heartland",1.15,1.15,314033.94,314033.94,78508.53,78508.53,235525.41,-298.40719622174225,-231562422.2178158,505.2473037782579,null,208.60597014925375,13.093709598528006,-578.5591752606033,-249.48118570998827,-181.24464056367822],
[2017,"M1_fixed","FINBIN_state",0.85,0.85,314033.94,314033.85,78508.53,78508.53,235525.31999999998,-181.0910206739414,-140525684.09909907,332.21547932605876,-93.94052067394136,202.6367711800709,12.719036918822857,-365.29947325657196,-148.92067970996936,-104.05307451185297],
[2017,"M1_fixed","FINBIN_state",0.85,1.0,314033.94,314033.94,78508.53,78508.53,235525.41,-271.67452067394123,-210818005.92829752,332.21547932605876,-169.14452067394146,238.39620138831867,14.963572845673948,-455.8829732565719,-239.50417970996932,-194.63657451185293],
[2017,"M1_fixed","FINBIN_state",0.85,1.15,314033.94,314033.94,78508.53,78508.53,235525.41,-362.2580206739414,-281110327.75749624,332.21547932605876,-244.34852067394138,274.1556315965665,17.20810877252504,-546.4664732565718,-330.0876797099693,-285.2200745118529],
[2017,"M1_fixed","FINBIN_state",1.0,0.85,314033.94,310983.39,78508.53,78508.53,232474.86,-122.46475961640162,-95032012.40503561,390.84174038359845,-35.31425961640152,172.24125550306027,10.81118138099943,-339.1805861842023,-84.61729965878743,-31.831881778650597],
[2017,"M1_fixed","FINBIN_state",1.0,1.0,314033.94,314033.85,78508.53,78508.53,235525.31999999998,-213.04825961640137,-165324334.234234,390.84174038359845,-110.51825961640152,202.6367711800709,12.719036918822857,-429.76408618420226,-175.2007996587874,-122.41538177865056],
[2017,"M1_fixed","FINBIN_state",1.0,1.15,314033.94,314033.94,78508.53,78508.53,235525.41,-303.63175961640155,-235616656.0634327,390.84174038359845,-185.72225961640146,233.03228685708152,14.626892456646285,-520.3475861842022,-265.78429965878735,-212.9988817786505],
[2017,"M1_fixed","FINBIN_state",1.15,0.85,314033.94,220748.4,78508.53,78508.53,142239.87,-63.83849855886186,-49538340.71097216,449.46800144113877,23.312001441138182,149.7750047852698,9.401027287825592,-313.06169911183264,-20.313919607605612,40.389310954551775],
[2017,"M1_fixed","FINBIN_state",1.15,1.0,314033.94,312550.01999999996,78508.53,78508.53,234041.49,-154.42199855886193,-119830662.5401708,449.46800144113877,-51.8919985588618,176.20588798267033,11.060032103324223,-403.6451991118326,-110.89741960760557,-50.194189045448184],
[2017,"M1_fixed","FINBIN_state",1.15,1.15,314033.94,314033.85,78508.53,78508.53,235525.31999999998,-245.0054985588617,-190122984.36936915,449.46800144113877,-127.09599855886174,202.63677118007087,12.719036918822855,-494.22869911183255,-201.48091960760553,-140.77768904544814],
[2017,"M2_HI_sensitivity","UNL",0.85,0.85,314033.94,313786.17,78508.53,78508.53,235277.63999999998,-158.7679813878604,-123203122.46587616,397.54851861213933,85.40301861213958,195.37014925373134,12.26292802990798,-379.2026214589026,-120.27104574922305,-66.57988668996637],
[2017,"M2_HI_sensitivity","UNL",0.85,1.0,314033.94,314033.94,78508.53,78508.53,235525.41,-256.94148138786034,-199385244.56425852,397.54851861213933,30.31851861213952,229.84723441615452,14.426974152832917,-477.3761214589026,-218.44454574922304,-164.75338668996636],
[2017,"M2_HI_sensitivity","UNL",0.85,1.15,314033.94,314033.94,78508.53,78508.53,235525.41,-355.1149813878607,-275567366.6626413,397.54851861213933,-24.765981387860453,264.3243195785777,16.591020275757852,-575.5496214589026,-316.61804574922303,-262.92688668996635],
[2017,"M2_HI_sensitivity","UNL",1.0,0.85,314033.94,276643.8,78508.53,78508.53,198135.27,-88.6123604563064,-68762727.86147189,467.70413954369343,155.55863954369357,166.06462686567164,10.423488825421783,-347.9472311281207,-43.32184794026239,19.84422154121603],
[2017,"M2_HI_sensitivity","UNL",1.0,1.0,314033.94,313786.17,78508.53,78508.53,235277.63999999998,-186.78586045630635,-144944849.9598543,467.70413954369343,100.47413954369368,195.37014925373134,12.26292802990798,-446.12073112812067,-141.49534794026238,-78.32927845878396],
[2017,"M2_HI_sensitivity","UNL",1.0,1.15,314033.94,314033.94,78508.53,78508.53,235525.41,-284.95936045630646,-221126972.05823684,467.70413954369343,45.38963954369364,224.67567164179104,14.102367234394176,-544.2942311281207,-239.66884794026237,-176.50277845878395],
[2017,"M2_HI_sensitivity","UNL",1.15,0.85,314033.94,100623.33,78508.53,78508.53,22114.8,-18.4567395247524,-14322333.257067626,537.8597604752478,225.71426047524778,144.40402336145362,9.063903326453726,-316.6918407973388,33.62734986869816,106.26832977239837],
[2017,"M2_HI_sensitivity","UNL",1.15,1.0,314033.94,292936.5,78508.53,78508.53,214427.97,-116.63023952475244,-90504455.3554501,537.8597604752478,170.62976047524768,169.88708630759248,10.663415678180852,-414.8653407973388,-64.54615013130183,8.094829772398384],
[2017,"M2_HI_sensitivity","UNL",1.15,1.15,314033.94,313786.17,78508.53,78508.53,235277.63999999998,-214.80373952475227,-166686577.45383242,537.8597604752478,115.54526047524767,195.37014925373137,12.262928029907982,-513.0388407973388,-162.71965013130182,-90.0786702276016],
[2017,"M2_HI_sensitivity","ERS_Heartland",0.85,0.85,314033.94,314029.35,78508.53,78508.53,235520.81999999998,-196.4569813878606,-152449589.1780332,397.54851861213933,null,208.60597014925372,13.093709598528005,-416.8916214589026,-157.960045749223,-104.26888668996634],
[2017,"M2_HI_sensitivity","ERS_Heartland",0.85,1.0,314033.94,314033.94,78508.53,78508.53,235525.41,-301.2814813878603,-233792852.46091372,397.54851861213933,null,245.41878841088675,15.404364233562358,-521.7161214589026,-262.78454574922307,-209.0933866899664],
[2017,"M2_HI_sensitivity","ERS_Heartland",0.85,1.15,314033.94,314033.94,78508.53,78508.53,235525.41,-406.10598138786077,-315136115.7437948,397.54851861213933,null,282.2316066725197,17.715018868596708,-626.5406214589026,-367.609045749223,-313.91788668996634],
[2017,"M2_HI_sensitivity","ERS_Heartland",1.0,0.85,314033.94,306510.48,78508.53,78508.53,228001.94999999998,-126.3013604563063,-98009194.57362872,467.70413954369343,null,177.31507462686565,11.129653158748802,-385.63623112812064,-81.01084794026235,-17.844778458783935],
[2017,"M2_HI_sensitivity","ERS_Heartland",1.0,1.0,314033.94,314029.35,78508.53,78508.53,235520.81999999998,-231.12586045630638,-179352457.8565095,467.70413954369343,null,208.60597014925375,13.093709598528006,-490.4607311281207,-185.8353479402624,-122.66927845878399],
[2017,"M2_HI_sensitivity","ERS_Heartland",1.0,1.15,314033.94,314033.94,78508.53,78508.53,235525.41,-335.95036045630656,-260695721.13939035,467.70413954369343,null,239.8968656716418,15.057766038307205,-595.2852311281207,-290.65984794026235,-227.49377845878394],
[2017,"M2_HI_sensitivity","ERS_Heartland",1.15,0.85,314033.94,166726.16999999998,78508.53,78508.53,88217.64,-56.14573952475236,-43568799.96922449,537.8597604752478,null,154.18702141466582,9.677959268477222,-354.38084079733875,-4.061650131301803,68.57932977239841],
[2017,"M2_HI_sensitivity","ERS_Heartland",1.15,1.0,314033.94,309873.87,78508.53,78508.53,231365.34,-160.97023952475243,-124912063.25210528,537.8597604752478,null,181.3964957819598,11.385834433502614,-459.2053407973388,-108.88615013130186,-36.24517022760165],
[2017,"M2_HI_sensitivity","ERS_Heartland",1.15,1.15,314033.94,314029.35,78508.53,78508.53,235520.81999999998,-265.79473952475246,-206255326.53498602,537.8597604752478,null,208.60597014925375,13.093709598528006,-564.0298407973388,-213.7106501313018,-141.0696702276016],
[2017,"M2_HI_sensitivity","FINBIN_state",0.85,0.85,314033.94,314004.06,78508.53,78508.53,235495.53,-159.64733784264072,-123885498.47168297,353.6591621573593,-72.49683784264063,202.6367711800709,12.719036918822857,-355.74599364983976,-125.40046389850886,-77.63680879939415],
[2017,"M2_HI_sensitivity","FINBIN_state",0.85,1.0,314033.94,314033.94,78508.53,78508.53,235525.41,-250.2308378426409,-194177820.3008817,353.6591621573593,-147.7008378426407,238.39620138831867,14.963572845673948,-446.3294936498397,-215.98396389850882,-168.2203087993941],
[2017,"M2_HI_sensitivity","FINBIN_state",0.85,1.15,314033.94,314033.94,78508.53,78508.53,235525.41,-340.81433784264067,-264470142.13008004,353.6591621573593,-222.90483784264055,274.1556315965665,17.20810877252504,-536.9129936498397,-306.5674638985088,-258.80380879939406],
[2017,"M2_HI_sensitivity","FINBIN_state",1.0,0.85,314033.94,298868.31,78508.53,78508.53,220359.78,-97.2368974619302,-75455323.43160486,416.0696025380693,-10.086397461930206,172.24125550306027,10.81118138099943,-327.9411984115762,-56.94645752765746,-0.7539221169342909],
[2017,"M2_HI_sensitivity","FINBIN_state",1.0,1.0,314033.94,314004.06,78508.53,78508.53,235495.53,-187.82039746193004,-145747645.2608033,416.0696025380693,-85.29039746193024,202.6367711800709,12.719036918822857,-418.52469841157614,-147.52995752765742,-91.33742211693425],
[2017,"M2_HI_sensitivity","FINBIN_state",1.0,1.15,314033.94,314033.94,78508.53,78508.53,235525.41,-278.4038974619301,-216039967.09000194,416.0696025380693,-160.49439746193005,233.03228685708152,14.626892456646285,-509.1081984115761,-238.11345752765737,-181.9209221169342],
[2017,"M2_HI_sensitivity","FINBIN_state",1.15,0.85,314033.94,130443.56999999999,78508.53,78508.53,51935.04,-34.826457081219765,-27025148.391526837,478.480042918781,52.32404291878024,149.7750047852698,9.401027287825592,-300.1364031733126,11.507548843193831,76.12896456552551],
[2017,"M2_HI_sensitivity","FINBIN_state",1.15,1.0,314033.94,305257.05,78508.53,78508.53,226748.52,-125.40995708121983,-97317470.22072546,478.480042918781,-22.879957081219764,176.20588798267033,11.060032103324223,-390.71990317331256,-79.07595115680613,-14.454535434474451],
[2017,"M2_HI_sensitivity","FINBIN_state",1.15,1.15,314033.94,314004.06,78508.53,78508.53,235495.53,-215.99345708121976,-167609792.049924,478.480042918781,-98.08395708121974,202.63677118007087,12.719036918822855,-481.3034031733125,-169.65945115680609,-105.03803543447441]
],
"run_id":"20260929_rotation_priority_budget_v1",
"input_manifest_sha256":"4c6aaf6e5683e69cd20c535cda20c6f3b55301340e333a99ea338aa1e59531eb",
"patch_index_asset":"projects/ee-njberkowitz95/assets/ch4_rotation_20260929_index",
"patch_assets":{"2001":"projects/ee-njberkowitz95/assets/ch4_rotation_20260929_patches_2001","2003":"projects/ee-njberkowitz95/assets/ch4_rotation_20260929_patches_2003","2005":"projects/ee-njberkowitz95/assets/ch4_rotation_20260929_patches_2005","2007":"projects/ee-njberkowitz95/assets/ch4_rotation_20260929_patches_2007","2009":"projects/ee-njberkowitz95/assets/ch4_rotation_20260929_patches_2009","2011":"projects/ee-njberkowitz95/assets/ch4_rotation_20260929_patches_2011","2013":"projects/ee-njberkowitz95/assets/ch4_rotation_20260929_patches_2013","2015":"projects/ee-njberkowitz95/assets/ch4_rotation_20260929_patches_2015","2017":"projects/ee-njberkowitz95/assets/ch4_rotation_20260929_patches_2017","2019":"projects/ee-njberkowitz95/assets/ch4_rotation_20260929_patches_2019","2021":"projects/ee-njberkowitz95/assets/ch4_rotation_20260929_patches_2021"},
"counties":[

],
"distributions":[

],
"associations":[

],
"budget_policy":"closest_rotation",
"evidence_asset":"projects/ee-njberkowitz95/assets/ch4_rotation_20260929_evidence",
"counties_columns":[
"year",
"scenario",
"source",
"price_factor",
"cost_factor",
"NAME",
"crop_ha",
"valid_ha",
"return_usd_ac_mean",
"return_usd_ac_sum_usd",
"economic_loss_ha"
],
"sensitivity_columns":[
"year",
"scenario",
"source",
"price_factor",
"cost_factor",
"valid_ha",
"loss_ha",
"quartile_ha",
"both_ha",
"disagree_ha",
"mean_return_usd_ac",
"total_return_usd",
"mean_revenue_usd_ac",
"mean_cash_margin_usd_ac",
"breakeven_bu_ac",
"breakeven_Mg_ha",
"return_p05",
"return_median",
"return_p95"
],
"distributions_columns":[
"year",
"scenario",
"source",
"price_factor",
"cost_factor",
"metric",
"basis",
"counts"
],
"associations_columns":[
"year",
"scenario",
"source",
"metric",
"n",
"r",
"ci_low",
"ci_high",
"block_m"
]
};
// CH4 Economics: maps and evidence use one locked, verified inventory.
// Compact transport arrays retain full numeric precision and hydrate once.
['counties','sensitivity','distributions','associations'].forEach(function(key){
  var columns=CH4_DATA[key+'_columns']||(key==='counties'?CH4_DATA.county_columns:null);
  if(columns){CH4_DATA[key]=CH4_DATA[key].map(function(r){var d={};columns.forEach(function(k,i){d[k]=r[i];});return d;});}
});
// Historical evidence is fetched by year; JSON properties preserve decimal precision.
var ch4EvidenceLoaded=CH4_DATA.evidence_asset?{}:{2019:true},ch4EvidencePending={};
function ch4EnsureEvidence(year){
  if(!CH4_DATA.evidence_asset||ch4EvidenceLoaded[year]||ch4EvidencePending[year])return;
  ch4EvidencePending[year]=true;
  ee.FeatureCollection(CH4_DATA.evidence_asset).filter(ee.Filter.eq('year',year)).aggregate_array('payload').evaluate(function(parts,error){
    ch4EvidencePending[year]=false;
    if(error){if(ch4Active&&ch4Active.year===year)ch4Status.setValue('Evidence loading failed: '+error);return;}
    var grouped={};
    try{parts.forEach(function(value){var part=JSON.parse(value);if(!grouped[part.table])grouped[part.table]=[];grouped[part.table]=grouped[part.table].concat(part.rows);});
      ['counties','distributions','associations'].forEach(function(key){CH4_DATA[key]=CH4_DATA[key].filter(function(r){return r.year!==year;}).concat(grouped[key]||[]);});
      ch4EvidenceLoaded[year]=true;
    }catch(e){if(ch4Active&&ch4Active.year===year)ch4Status.setValue('Evidence decoding failed: '+e);return;}
    if(ch4Active&&ch4Active.year===year&&viewSelect.getValue()==='ch4_view'&&ch4Section.getValue()==='Charts & tables')ch4Charts();
  });
}
var ch4Panel=ui.Panel({style:{shown:false,margin:'0'}});
var ch4Evidence=ui.Panel({style:{shown:false,stretch:'both',padding:'24px',backgroundColor:THEME.pale}});
panel.add(ch4Panel);ui.root.add(ch4Evidence);navBar.setLayout(ui.Panel.Layout.flow('horizontal',true));
viewSelect.items().add({label:'CH4 Economics',value:'ch4_view'});
var ch4NavButton=ui.Button({label:'CH4 Economics',onClick:function(){var v=viewSelect.getValue()==='ch4_view'?'map_view':'ch4_view';viewSelect.setValue(v,false);switchView(v);},style:{fontSize:'12px',margin:'4px 6px 0 0'}});navBar.add(ch4NavButton);
var ch4OldSwitch=switchView,ch4SavedLayers=[],ch4SavedHeader=null,ch4Layer=null,ch4Outline=null;
var ch4Generation=0,ch4Request=0,ch4SelectedId=null,ch4Active=null;
switchView=function(v){
  ch4OldSwitch(v);ch4Generation++;ch4Request++;
  var active=v==='ch4_view';
  if(active&&!ch4SavedHeader){
    ch4SavedHeader=[eyebrow.getValue(),appTitle.getValue(),appDesc.getValue(),mapChip.getValue()];
    map.layers().forEach(function(l){if(l!==ch4Layer&&l!==ch4Outline){ch4SavedLayers.push([l,l.getShown()]);l.setShown(false);}});
    eyebrow.setValue('DISSERTATION CHAPTER 4 · MLRA 106');appTitle.setValue('Dryland corn economics');appDesc.setValue('Economic scenarios and two marginality definitions on verified 30 m yields.');
  }else if(!active&&ch4SavedHeader){
    ch4SavedLayers.forEach(function(r){r[0].setShown(r[1]);});ch4SavedLayers=[];
    eyebrow.setValue(ch4SavedHeader[0]);appTitle.setValue(ch4SavedHeader[1]);appDesc.setValue(ch4SavedHeader[2]);mapChip.setValue(ch4SavedHeader[3]);ch4SavedHeader=null;
  }
  ch4Panel.style().set('shown',active);ch4Evidence.style().set('shown',false);map.style().set('shown',true);legend.style().set('shown',!active);
  ch4NavButton.setLabel(active?'Return to yield workspace':'CH4 Economics');if(ch4Layer)ch4Layer.setShown(active);if(ch4Outline)ch4Outline.setShown(active);if(active)ch4Refresh();
};
function ch4Text(t,size){return ui.Label(t,{fontSize:size||'12px',color:THEME.body,whiteSpace:'pre-wrap',margin:'4px 0 8px 0'});}
function ch4Num(v,n){return v===null||v===undefined||!isFinite(v)?'Unavailable':Number(v).toLocaleString('en-US',{minimumFractionDigits:n===undefined?2:n,maximumFractionDigits:n===undefined?2:n});}
function ch4Money(v){return v===null||v===undefined||!isFinite(v)?'Unavailable':'$'+ch4Num(v);}
function ch4Match(r,a){return r.year===a.year&&r.scenario===a.scenario&&r.source===a.source&&r.price_factor===a.pf&&r.cost_factor===a.cf;}
var ch4Factors={'−15%':.85,'Baseline':1,'+15%':1.15},ch4FactorNames=['−15%','Baseline','+15%'];
ch4Panel.add(kicker('CH4 ECONOMICS · VERIFIED INPUTS'));
var ch4Section=ui.Select({items:['Map','Charts & tables','Methods & sources'],value:'Map',onChange:ch4ShowSection,style:{stretch:'horizontal',margin:'4px 0'}});ch4Panel.add(ch4Section);
var ch4Year=ui.Select({items:CH4_DATA.years.map(function(y){var e=CH4_DATA.eligibility.filter(function(r){return r.year===y;})[0];return {label:y+(y===2021?' · EXPERIMENTAL':e&&e.eligible?' · '+(e.match_designation||'exact')+' budget':' · yield only'),value:String(y)};}),value:'2019',onChange:function(){ch4ClearPatch();ch4Refresh();},style:{width:'100%'}});
var ch4Policy=ui.Select({items:[{label:'Closest rotation-matched budgets',value:'closest_rotation'},{label:'Exact matches only',value:'exact'}],value:CH4_DATA.budget_policy||'exact',onChange:ch4Refresh,style:{stretch:'horizontal'}});
var ch4Scenario=ui.Select({items:[{label:'M1 · fixed harvest index',value:'M1_fixed'},{label:'M2 · harvest-index sensitivity',value:'M2_HI_sensitivity'}],value:'M1_fixed',onChange:ch4Refresh,style:{width:'100%'}});
var ch4Source=ui.Select({items:[{label:'UNL · selected original-year budget',value:'UNL'},{label:'ERS · Heartland regional scenario',value:'ERS_Heartland'},{label:'FINBIN · four-county operator proxy',value:'FINBIN_county'},{label:'FINBIN · statewide operator proxy',value:'FINBIN_state'}],value:'UNL',onChange:ch4Refresh,style:{width:'100%'}});
var ch4Definition=ui.Select({items:[{label:'Total economic return / operator proxy',value:'return'},{label:'Cash margin / accounting cash proxy',value:'cash'},{label:'Revenue / operator-share revenue',value:'revenue'},{label:'Negative total return',value:'loss'},{label:'Lowest yield quartile',value:'quartile'},{label:'Overlap and disagreement',value:'overlap'}],value:'return',onChange:ch4Refresh,style:{width:'100%'}});
var ch4Currency=ui.Select({items:[{label:'Constant 2021 dollars',value:'2021'},{label:'Nominal crop-year dollars',value:'nominal'}],value:'2021',onChange:ch4Refresh,style:{width:'100%'}});
// Percentage widths plus default widget margins caused horizontal overflow.
[ch4Year,ch4Scenario,ch4Source,ch4Definition,ch4Currency].forEach(function(control){control.style().set({width:null,stretch:'horizontal',margin:'4px 0'});});
var ch4Price=ui.Select({items:ch4FactorNames,value:'Baseline',onChange:ch4Refresh,style:{stretch:'horizontal'}}),ch4Cost=ui.Select({items:ch4FactorNames,value:'Baseline',onChange:ch4Refresh,style:{stretch:'horizontal'}});
[['Budget matching policy',ch4Policy],['Production year',ch4Year],['Yield scenario',ch4Scenario],['Economic source',ch4Source],['Map layer',ch4Definition],['Dollar basis',ch4Currency]].forEach(function(x){ch4Panel.add(fieldLabel(x[0]));ch4Panel.add(x[1]);});
ch4Panel.add(ui.Panel([ui.Panel([fieldLabel('Price'),ch4Price],null,{stretch:'horizontal'}),ui.Panel([fieldLabel('Cost'),ch4Cost],null,{stretch:'horizontal'})],ui.Panel.Layout.flow('horizontal'),{stretch:'horizontal'}));
var ch4Status=ch4Text(''),ch4Cards=ui.Panel(),ch4Legend=ui.Panel(),ch4Patch=ui.Panel();ch4Panel.add(ch4Status);ch4Panel.add(ch4Cards);ch4Panel.add(ch4Legend);ch4Panel.add(ch4Patch);
ch4Panel.add(ch4Text('Mapped crop units have year-specific identifiers. They do not identify farms or imply persistent ownership.','11px'));
function ch4ClearPatch(){ch4SelectedId=null;ch4Request++;if(ch4Outline){map.layers().remove(ch4Outline);ch4Outline=null;}ch4Patch.clear();ch4Patch.add(ch4Text('Click a mapped crop pixel to inspect its annual patch.'));}
function ch4Card(label,value,detail){return ui.Panel([kicker(label,THEME.muted),ui.Label(value,{fontSize:'21px',fontWeight:'bold',color:THEME.ink,margin:'0'}),ch4Text(detail,'11px')],null,{backgroundColor:THEME.white,border:'1px solid '+THEME.line,padding:'10px',margin:'0 0 8px 0',stretch:'horizontal'});}
function ch4Heading(t){return ui.Label(t,{fontSize:'19px',fontWeight:'bold',color:THEME.ink,margin:'8px 0 12px 0'});}
function ch4Table(title,rows){var p=ui.Panel([ch4Heading(title)],null,{padding:'12px',backgroundColor:THEME.white,margin:'0 0 16px 0'});rows.forEach(function(r){p.add(ui.Panel([ui.Label(r[0],{fontSize:'12px',stretch:'horizontal',color:THEME.body}),ui.Label(r[1],{fontSize:'12px',fontWeight:'bold',color:THEME.ink})],ui.Panel.Layout.flow('horizontal')));});return p;}
function ch4BudgetContext(a){var e=a.budget;return e&&e.eligible?'UNL anchor #'+e.budget_number+' · '+(e.match_designation||'exact').toUpperCase()+' · '+(e.actual_system||e.title)+' · '+(e.geography||'See original geography'): 'Original-year budget unavailable';}
function ch4Context(a){return a.year+(a.year===2021?' · EXPERIMENTAL':'')+' · '+a.scenario+' · '+a.source+' · price '+Math.round(a.pf*100)+'% / cost '+Math.round(a.cf*100)+'% · '+(a.basis==='2021'?'constant 2021 dollars':'nominal dollars');}
function ch4ShowSection(){if(viewSelect.getValue()!=='ch4_view')return;var s=ch4Section.getValue();map.style().set('shown',s==='Map');ch4Evidence.style().set('shown',s!=='Map');if(s==='Charts & tables')ch4Charts();if(s==='Methods & sources')ch4Methods();}
function ch4Refresh(){
  if(!ch4Year||!ch4Status)return;ch4Generation++;ch4Request++;ch4Cards.clear();ch4Legend.clear();
  var a={policy:ch4Policy.getValue(),year:Number(ch4Year.getValue()),scenario:ch4Scenario.getValue(),source:ch4Source.getValue(),pf:ch4Factors[ch4Price.getValue()],cf:ch4Factors[ch4Cost.getValue()],basis:ch4Currency.getValue(),layer:ch4Definition.getValue()};
  a.annual=CH4_DATA.annual.filter(function(r){return r.year===a.year&&r.scenario===a.scenario;})[0];a.cost=CH4_DATA.costs.filter(function(r){return r.year===a.year&&r.source===a.source;})[0];a.row=CH4_DATA.sensitivity.filter(function(r){return ch4Match(r,a);})[0];
  a.budget=CH4_DATA.eligibility.filter(function(r){return r.year===a.year;})[0];a.eligible=a.budget.eligible&&(a.policy!=='exact'||a.budget.strict_eligible===undefined||a.budget.strict_eligible);if(!a.eligible){a.cost=null;a.row=null;}ch4EnsureEvidence(a.year);a.factor=a.basis==='2021'&&a.cost?a.cost.to_2021_dollars:1;ch4Active=a;
  if(ch4Layer){map.layers().remove(ch4Layer);ch4Layer=null;}
  var note=a.year===2021?'EXPERIMENTAL 2021 · LGRIP2020 proxy; M1 and M2 identical. Excluded from primary temporal summaries.\n':a.year===2019?'2019 crop-mask source differs from historical years.\n':'';
  var unavailable=!a.eligible?'Economics unavailable under this matching policy. An original production-year UNL budget is required; exact mode excludes approximate systems across all sources.':!a.cost?'Selected source unavailable, incomplete or suppressed for this year.'+(a.year===2009&&a.source==='UNL'?' The 2009 UNL sheet omits complete economic costs.':''):a.layer==='cash'&&a.cost.cash_cost_usd_ac===null?'Cash margin unavailable: cash and ownership/opportunity costs cannot be fully separated in this source account.':null;
  ch4Status.setValue(note+(unavailable||a.cost.geography+'\n'+a.cost.account)+'\n'+ch4BudgetContext(a)+'\n'+ch4Context(a));mapChip.setValue('CH4 '+a.year+' · '+a.layer+' · '+(a.basis==='2021'?'2021 $':'nominal $')+' · '+(a.budget.match_designation||'unavailable'));
  if(a.row){
    ch4Cards.add(ch4Card(a.cost.full_economic_account?'Mean total economic return':'Mean operator-account return',ch4Money(a.row.mean_return_usd_ac*a.factor)+'/acre','Dollar basis: '+(a.basis==='2021'?'2021':'nominal')));
    ch4Cards.add(ch4Card('Negative total return',ch4Num(a.row.loss_ha)+' ha',ch4Num(100*a.row.loss_ha/a.row.valid_ha)+'% of '+ch4Num(a.row.valid_ha)+' valid ha'));
    ch4Cards.add(ch4Card('Valid coverage',ch4Num(100*a.row.valid_ha/a.annual.crop_ha)+'% of regional crop area',ch4Num(a.row.valid_ha)+' ha · '+ch4Num(a.annual.crop_ha-a.row.valid_ha)+' ha outside source domain / missing yield'));
    ch4Cards.add(ch4Card('Breakeven yield',ch4Num(a.row.breakeven_bu_ac)+' bu/acre',ch4Num(a.row.breakeven_Mg_ha)+' Mg/ha · total/source-account costs'));
  }else ch4Cards.add(ch4Card('Yield-only coverage',ch4Num(a.annual.valid_ha)+' ha',ch4Num(100*a.annual.valid_ha/a.annual.crop_ha)+'% · '+ch4Num(a.annual.missing_ha)+' ha missing yield'));
  if(!unavailable||a.layer==='quartile'){
    var idx=CH4_DATA.years.indexOf(a.year)*2+(a.scenario==='M1_fixed'?0:1),image=ee.Image(CH4_DATA.asset).select([idx]).toDouble().rename('value');image=image.updateMask(image.gte(0));
    var q=image.lte(a.annual.cutoff_Mg_ha),result=q,vis={min:0,max:1,palette:['dce6e9','197a91']};
    if(a.layer!=='quartile'){
      if(a.source==='FINBIN_county'){image=image.updateMask(ee.Image(CH4_DATA.county_scope_asset).eq(1));q=q.updateMask(image.mask());}
      var rev=image.divide(CH4_DATA.mgha_per_buac).multiply(a.cost.nass_price_usd_bu*a.pf*a.cost.operator_share),ret=rev.subtract(a.cost.total_cost_usd_ac*a.cf),loss=ret.lt(0);
      if(a.layer==='return'||a.layer==='cash'){result=(a.layer==='return'?ret:rev.subtract(a.cost.cash_cost_usd_ac*a.cf)).multiply(a.factor);vis={min:-1000,max:1000,palette:['b35806','f7f7f7','2166ac']};}
      else if(a.layer==='revenue'){result=rev.multiply(a.factor);vis={min:0,max:2000,palette:['f7fcf0','ccebc5','7bccc4','2b8cbe','084081']};}
      else if(a.layer==='loss'){result=loss;vis={min:0,max:1,palette:['e2e6e6','7a5195']};}
      else{result=q.add(loss.multiply(2));vis={min:0,max:3,palette:['e2e6e6','e69f00','7a5195','143e64']};}
    }
    ch4Layer=ui.Map.Layer(result.rename('value'),vis,'CH4 '+ch4Context(a)+' · '+a.layer+' · '+ch4BudgetContext(a),true);map.layers().add(ch4Layer);
    if(a.layer==='return'||a.layer==='cash'||a.layer==='revenue'){
      ch4Legend.add(fieldLabel((a.layer==='return'&&!a.cost.full_economic_account?'Operator-account return':a.layer)+' · $/acre · '+(a.basis==='2021'?'2021 dollars':'nominal')));
      ch4Legend.add(ui.Thumbnail({image:ee.Image.pixelLonLat().select(0),params:{bbox:[0,0,1,.1],dimensions:'320x16',min:0,max:1,palette:vis.palette},style:{stretch:'horizontal',height:'20px'}}));
      ch4Legend.add(ch4Text(a.layer==='revenue'?'$0                 $1,000                 ≥ $2,000':'≤ −$1,000            $0            ≥ +$1,000','11px'));ch4Legend.add(ch4Text('Saturated tails retain their numerical values. Transparent pixels are outside the valid domain, not $0.','11px'));
    }else{var labels=a.layer==='overlap'?['Neither','Quartile only','Loss only','Both']:a.layer==='quartile'?['Above annual quartile','At/below annual quartile']:['Nonnegative total return','Negative total return'];labels.forEach(function(t,i){var l=ch4Text('■ '+t);l.style().set('color','#'+vis.palette[i]);ch4Legend.add(l);});}
  }
  if(ch4SelectedId!==null)ch4LoadPatch(ch4SelectedId);else ch4ClearPatch();ch4ShowSection();
}
function ch4Chart(title,columns,rows,type,options){
  var p=ui.Panel([ch4Heading(title)],null,{padding:'16px',backgroundColor:THEME.white,margin:'0 0 18px 0',stretch:'horizontal'});if(!rows.length){p.add(ch4Text('Unavailable for the selected source and year.'));return p;}
  var data={cols:columns.map(function(x,i){return {id:'c'+i,label:x,type:i===0?'string':'number'};}),rows:rows.map(function(r){return {c:r.map(function(v){return {v:v};})};})};
  var opt={height:340,fontName:'Arial',fontSize:12,legend:{position:'none'},chartArea:{left:80,right:30,top:20,bottom:80},colors:[THEME.primary],backgroundColor:THEME.white};Object.keys(options||{}).forEach(function(k){opt[k]=options[k];});p.add(ui.Chart(data).setChartType(type||'ColumnChart').setOptions(opt));return p;
}
function ch4Matrix(a){
  var p=ui.Panel([ch4Heading('Price–cost sensitivity'),ch4Text('Rows: price. Columns: cost. Cells show mean return ($/acre) and loss share. Click to apply both settings.')],null,{padding:'16px',backgroundColor:THEME.white,margin:'0 0 18px 0'});
  p.add(ui.Panel(['Cost −15%','Cost baseline','Cost +15%'].map(function(t){return ui.Label(t,{stretch:'horizontal',fontWeight:'bold',fontSize:'12px'});}),ui.Panel.Layout.flow('horizontal')));
  ch4FactorNames.forEach(function(pn){var line=ui.Panel([],ui.Panel.Layout.flow('horizontal'),{stretch:'horizontal'});ch4FactorNames.forEach(function(cn){var target={year:a.year,scenario:a.scenario,source:a.source,pf:ch4Factors[pn],cf:ch4Factors[cn]},r=a.eligible?CH4_DATA.sensitivity.filter(function(x){return ch4Match(x,target);})[0]:null;line.add(ui.Button({label:'Price '+pn+'\n'+(r?ch4Money(r.mean_return_usd_ac*a.factor)+'/ac · '+ch4Num(100*r.loss_ha/r.valid_ha)+'% loss':'Unavailable'),disabled:!r,onClick:function(){ch4Price.setValue(pn,false);ch4Cost.setValue(cn,false);ch4Refresh();},style:{stretch:'horizontal',whiteSpace:'pre-wrap',backgroundColor:r?(r.mean_return_usd_ac<0?'#f6e0c9':'#dbe9f5'):THEME.pale,border:target.pf===a.pf&&target.cf===a.cf?'2px solid '+THEME.primary:'1px solid '+THEME.line,margin:'4px',fontSize:'12px',padding:'10px'}}));});p.add(line);});return p;
}
function ch4Charts(){
  var a=ch4Active;ch4Evidence.clear();ch4Evidence.add(kicker('CH4 · CHARTS & TABLES'));ch4Evidence.add(ch4Heading(ch4Context(a)));ch4Evidence.add(ch4Text(ch4BudgetContext(a)));if(ch4EvidencePending[a.year])ch4Evidence.add(ch4Text('Loading verified county and distribution evidence…'));if(!a.row){ch4Evidence.add(ch4Text('Economic evidence unavailable. Historical yield-only results remain in the yield workspace and quartile map.'));return;}
  var r=a.row,f=a.factor;
  ch4Evidence.add(ch4Table('Exact regional values · source-valid domain',[
    ['Mean return ($/acre)',ch4Money(r.mean_return_usd_ac*f)],['Mean revenue ($/acre)',ch4Money(r.mean_revenue_usd_ac*f)],['Mean cash margin ($/acre)',ch4Money(r.mean_cash_margin_usd_ac===null?null:r.mean_cash_margin_usd_ac*f)],
    ['Median return ($/acre)',ch4Money(r.return_median*f)],['5th–95th percentile return ($/acre)',ch4Money(r.return_p05*f)+' to '+ch4Money(r.return_p95*f)],['Area-summed total return ($)',ch4Money(r.total_return_usd*f)],
    ['Valid / regional crop area (ha)',ch4Num(r.valid_ha)+' / '+ch4Num(a.annual.crop_ha)],['Regional yield missingness (ha)',ch4Num(a.annual.missing_ha)],['Source exclusion + missingness (ha)',ch4Num(a.annual.crop_ha-r.valid_ha)],['Quartile / overlap / disagreement (ha)',ch4Num(r.quartile_ha)+' / '+ch4Num(r.both_ha)+' / '+ch4Num(r.disagree_ha)]]));
  var metric=['return','cash','revenue'].indexOf(a.layer)>=0?a.layer:'return',d=CH4_DATA.distributions.filter(function(x){return ch4Match(x,a)&&x.metric===metric&&x.basis===a.basis;})[0],bins=[],start=metric==='revenue'?0:-1000,end=metric==='revenue'?2000:1000;
  if(d&&!(metric==='cash'&&a.cost.cash_cost_usd_ac===null)){d.counts.forEach(function(n,i){bins.push([i===0?'< '+start:i===d.counts.length-1?'≥ '+end:(start+(i-1)*100)+' to < '+(start+i*100),n*.09]);});}
  ch4Evidence.add(ch4Chart('Area-weighted '+metric+' distribution · '+ch4Num(r.valid_ha)+' ha',['$/acre bin','Area (ha)'],bins,'ColumnChart',{hAxis:{title:'$/acre · '+a.basis+' basis',slantedText:true,slantedTextAngle:55},vAxis:{title:'Native valid area (ha)'},height:400}));
  var counties=CH4_DATA.counties.filter(function(x){return ch4Match(x,a)&&x.valid_ha>0;}).sort(function(x,y){return x.return_usd_ac_mean-y.return_usd_ac_mean;});
  ch4Evidence.add(ch4Chart('County–AOI mean return',['County','Mean return ($/acre)'],counties.map(function(x){return [x.NAME,x.return_usd_ac_mean*f];}),'BarChart',{height:440,hAxis:{title:'$/acre · '+a.basis+' basis'},chartArea:{left:110,right:30,top:20,bottom:50}}));
  ch4Evidence.add(ch4Chart('County negative-return share',['County','Loss share (%)'],counties.map(function(x){return [x.NAME,100*x.economic_loss_ha/x.valid_ha];}),'BarChart',{height:440,hAxis:{title:'Percent of county source-valid crop area',viewWindow:{min:0,max:100}},chartArea:{left:110,right:30,top:20,bottom:50},colors:['#b35806']}));
  ch4Evidence.add(ch4Chart('Marginality overlap · same '+ch4Num(r.valid_ha)+' ha denominator',['Definition','Area (ha)'],[['Neither',r.valid_ha-r.loss_ha-r.quartile_ha+r.both_ha],['Quartile only',r.quartile_ha-r.both_ha],['Loss only',r.loss_ha-r.both_ha],['Both',r.both_ha]],'ColumnChart',{vAxis:{title:'Area (ha)'}}));ch4Evidence.add(ch4Matrix(a));
  var comparisons=CH4_DATA.sensitivity.filter(function(x){return x.year===a.year&&x.scenario===a.scenario&&x.price_factor===a.pf&&x.cost_factor===a.cf;});
  ch4Evidence.add(ch4Chart('Source scenarios · distinct accounting and coverage',['Source','Mean return ($/acre)'],comparisons.map(function(x){return [x.source+' · '+ch4Num(x.valid_ha,0)+' ha',x.mean_return_usd_ac*f];}),'BarChart',{height:330,chartArea:{left:240,right:30,top:20,bottom:60},hAxis:{title:'$/acre · '+a.basis+' basis'}}));
  comparisons.forEach(function(x){var c=CH4_DATA.costs.filter(function(t){return t.year===a.year&&t.source===x.source;})[0];ch4Evidence.add(ch4Text(c.source+' · '+c.geography+' · '+c.account+' · report n: '+(c.sample_n===null?'not applicable':c.sample_n)+' · valid area '+ch4Num(x.valid_ha)+' ha','11px'));});
  var assoc=CH4_DATA.associations.filter(function(x){return x.year===a.year&&x.scenario===a.scenario&&x.source===a.source&&x.block_m===10000;});
  ch4Evidence.add(ch4Table('Baseline NCCPI associations · baseline prices and costs',assoc.map(function(x){return [x.metric+' · n='+ch4Num(x.n,0),'r='+ch4Num(x.r,3)+' · 95% block interval '+ch4Num(x.ci_low,3)+' to '+ch4Num(x.ci_high,3)];})));
  ch4Evidence.add(ch4Text('10 km blocks · 1,999 resamples · seed 20260928. 5 km and 20 km checks remain in the downloadable table. These baseline intervals do not describe active sensitivity settings. Scenario economics are not independent profitability validation.'));
  ch4Evidence.add(ch4Table('County coverage and exact totals',counties.map(function(x){return [x.NAME+' · valid / crop ha',ch4Num(x.valid_ha)+' / '+ch4Num(x.crop_ha)+' · '+ch4Money(x.return_usd_ac_sum_usd*f)+' total return'];})));
}
function ch4Methods(){
  var a=ch4Active;ch4Evidence.clear();ch4Evidence.add(kicker('CH4 · METHODS & SOURCES'));ch4Evidence.add(ch4Heading('Definitions, provenance and scope'));
  [
    'Yield equations and parameters are unchanged. Native 30 m EPSG:5070 pixels each represent 0.09 ha. Monetary rates use dollars per acre; areas use hectares. Masks, indexes and geometry are checked against the locked inventory.',
    'Revenue = yield (Mg/ha) ÷ '+CH4_DATA.mgha_per_buac+' × crop-year Nebraska NASS marketing-year price × price factor × operator share. Return = revenue − source total costs × cost factor. Cash margin is calculated only where a cash-cost account is defined.',
    'Economic marginality means total/source-account return < 0. Yield marginality means at or below the annual regional 25th percentile, including ties. The quartile cutoff is fixed on the full annual regional yield footprint; comparisons restrict both definitions to the same source-valid domain.',
    'Annual CPI-U ratios convert nominal amounts to constant 2021 dollars. A positive multiplier changes revenue, margins, returns and totals without changing classifications. Fixed map scales retain saturated tails in the distribution charts.',
    'Every economic year requires an original production-year UNL budget. Closest rotation-matched mode prioritizes dryland corn after soybean and explicitly accepts no-till and geography differences. Exact mode permits only verified strict matches. Eligible anchor years under the selected policy: '+CH4_DATA.eligibility.filter(function(r){return r.eligible&&(a.policy!=="exact"||r.strict_eligible===undefined||r.strict_eligible);}).map(function(r){return r.year+(r.year===2021?' (experimental)':'');}).join(', ')+'. 2003, 2005 and 2007 remain blocked because originals are unrecovered; no neighboring-year costs are substituted. ERS and FINBIN cannot substitute for this gate. The 2009 UNL worksheet is incomplete and cannot supply full UNL return; 2001 UNL cash margin is unavailable.',
    'UNL historical approximations use actual published no-till corn-after-soybean costs without invented tillage adjustments. These modeled returns do not establish equivalence with conventional tillage. UNL 2009 has incomplete total costs, and 2001 cash margin is undefined. The 2019 printed cash-per-bushel figure does not reconcile; cash cost uses verified line items. ERS: Heartland planted-acre regional scenario across practices; operating costs are not a complete cash-cost account.',
    'FINBIN reports are participant operator-account proxies with unverified rainfed practice and incomplete opportunity costs. Statewide and county reports remain separate. The 2019 county domain is Gage, Johnson, Lancaster and Pawnee; the 2021 county report is unavailable/suppressed.',
    '2019 has a documented mask-source change. Experimental 2021 uses the LGRIP2020 proxy, has identical M1 and M2 yields, and is outside primary temporal summaries. No economic trend connects economically unavailable years.',
    'Native annual raster IDs select their matching crop polygons. IDs reset with year and describe mapped units, not persistent farms. Missing yield remains missing. County/patch denominators use raster pixels rather than polygon areas; original mask edge cells retain the documented county-center/fringe assignment.',
    'NCCPI association uncertainty uses 10 km spatial blocks, 1,999 replicates and a fixed seed; 5 km and 20 km checks are retained. These are baseline associations. Producer-level economic observations are unavailable for independent profitability validation.'
  ].forEach(function(t){ch4Evidence.add(ch4Text(t,'13px'));});
  var e=CH4_DATA.eligibility.filter(function(x){return x.year===a.year;})[0];ch4Evidence.add(ch4Table('Selected-year budget eligibility',[['Year',String(a.year)],['Policy',a.policy],['Designation',e.match_designation||'unavailable'],['Actual system',e.actual_system||e.title||'Unavailable'],['Geography',e.geography||'See original'],['Mismatch',e.mismatch_fields||'None'],['Status',e.status],['Source publication',e.publication_title||e.title||'Original not recovered'],['Matching budget',e.title||'No verified system match'],['Budget / PDF page',e.eligible?e.budget_number+' / '+e.pdf_page:'Unavailable'],['Review',e.review_note||'See source ledger']]));
  if(CH4_DATA.source_audit){
    ch4Evidence.add(ch4Heading('Historical original-budget review · '+CH4_DATA.source_audit.review_date));
    ch4Evidence.add(ch4Text('Strict system: Eastern Nebraska dryland conventional-tillage corn in a corn–soybean rotation. Historical no-till corn-after-soybean candidates do not qualify under that system; closest mode explicitly accepts their documented differences. 2003, 2005 and 2007 originals remain unrecovered. The DigitalCommons /2024/ record is a 2001 publication, posted in 2012.'));
    ch4Evidence.add(ch4Table('Annual source decisions',CH4_DATA.eligibility.map(function(r){return [String(r.year)+(r.year===2021?' · experimental':''),r.eligible?(r.match_designation||'exact')+' · UNL #'+r.budget_number:r.original_recovered?'Original recovered · selected system absent':'Original not recovered'];})));
    ch4Evidence.add(ui.Label({value:'Historical budget evidence and search register ↗',targetUrl:CH4_DATA.source_audit.report_url}));
    ch4Evidence.add(ch4Text('Source audit: '+CH4_DATA.source_audit.run_id+'\nRegistry SHA-256: '+CH4_DATA.source_audit.registry_sha256+'\nUnchanged yield rasters and 2019/2021 results retained; historical economics recalculated under the separate rotation-priority register.','11px'));
  }
  if(e.source_url)ch4Evidence.add(ui.Label({value:'Selected original UNL budget ↗',targetUrl:e.source_url}));
  [['UNL crop-budget archive','https://cap.unl.edu/cropbudgets/archive/'],['Original 2001 publication','https://digitalcommons.unl.edu/extensionhist/2024/'],['UNL crop budgets','https://cap.unl.edu/cropbudgets/'],['FINBIN reports','https://finbin.umn.edu/'],['USDA ERS commodity costs and returns','https://www.ers.usda.gov/data-products/commodity-costs-and-returns'],['Nebraska NASS','https://www.nass.usda.gov/Statistics_by_State/Nebraska/'],['Code, source ledger and methods','https://github.com/njberkowitz95/Yields-and-Fields-CH1/tree/codex/ch4-marginality/ch4_marginality']].forEach(function(x){ch4Evidence.add(ui.Label({value:x[0]+' ↗',targetUrl:x[1],style:{fontSize:'13px',color:THEME.primary}}));});
  ch4Evidence.add(ch4Text('Run: '+CH4_DATA.run_id+'\nManifest SHA-256: '+CH4_DATA.input_manifest_sha256+'\nOutputs: PHD/CSP3_GPP_outputs/CH4_marginality/'+CH4_DATA.run_id+'/','11px'));
}
function ch4LoadPatch(id){
  var a=ch4Active,generation=ch4Generation,request=++ch4Request;ch4Patch.clear();ch4Patch.add(ch4Text('Loading annual crop patch '+id+'…'));
  var pre=a.scenario.slice(0,2).toLowerCase(),src=pre+'_'+{UNL:'u',ERS_Heartland:'e',FINBIN_state:'s',FINBIN_county:'c'}[a.source],keys=['label_id','year'];
  ['crop_ha','valid_ha','missing_ha','coverage_percent','yield_Mg_ha_mean','quartile_ha'].forEach(function(k){keys.push(pre+'_'+k);});
  if(a.row){['valid_ha','missing_ha','coverage_percent','yield_Mg_ha_mean','quartile_ha'].forEach(function(k){keys.push(src+'_'+k);});ch4FactorNames.forEach(function(p){ch4FactorNames.forEach(function(c){['loss','both','disagree'].forEach(function(k){keys.push(src+'_'+Math.round(ch4Factors[p]*100)+'_'+Math.round(ch4Factors[c]*100)+'_'+k);});});});}
  var feature=ee.FeatureCollection(CH4_DATA.patch_assets[String(a.year)]).filter(ee.Filter.eq('label_id',id)).first();feature.toDictionary(keys).evaluate(function(v,error){
    if(generation!==ch4Generation||request!==ch4Request||viewSelect.getValue()!=='ch4_view')return;ch4Patch.clear();
    if(error||!v||v.label_id===undefined){ch4Patch.add(ch4Text('Patch evidence unavailable: '+(error||'annual ID not found')));return;}
    ch4SelectedId=id;if(ch4Outline)map.layers().remove(ch4Outline);ch4Outline=ui.Map.Layer(ee.FeatureCollection([feature]).style({color:'172f48',fillColor:'00000000',width:3}),{},'Selected patch '+a.year+' / '+id,true);map.layers().add(ch4Outline);
    var s=a.row?src:pre,valid=v[s+'_valid_ha'],ym=v[s+'_yield_Mg_ha_mean'],sk=src+'_'+Math.round(a.pf*100)+'_'+Math.round(a.cf*100);
    var rev=ym===undefined||ym===null?null:ym/CH4_DATA.mgha_per_buac*(a.cost?a.cost.nass_price_usd_bu*a.pf*a.cost.operator_share:0),ret=a.row&&rev!==null?(rev-a.cost.total_cost_usd_ac*a.cf)*a.factor:null,cash=a.row&&rev!==null&&a.cost.cash_cost_usd_ac!==null?(rev-a.cost.cash_cost_usd_ac*a.cf)*a.factor:null;
    ch4Patch.add(ch4Text(ch4BudgetContext(a)+'\n'+ch4Context(a)));ch4Patch.add(ch4Table('Selected mapped crop unit',[['Annual patch ID',a.year+' / '+id],['Crop / source-valid area (ha)',ch4Num(v[pre+'_crop_ha'])+' / '+ch4Num(valid)],['Source exclusion + missingness (ha)',ch4Num(v[pre+'_crop_ha']-valid)],['Yield missingness (ha)',ch4Num(v[pre+'_missing_ha'])],['Mean yield (Mg/ha)',ch4Num(ym,3)],['Mean return ($/acre)',ch4Money(ret)],['Mean cash margin ($/acre)',ch4Money(cash)],['Loss / quartile / both (ha)',ch4Num(v[sk+'_loss'])+' / '+ch4Num(v[s+'_quartile_ha'])+' / '+ch4Num(v[sk+'_both'])],['Disagreement (ha)',ch4Num(v[sk+'_disagree'])]]));
    if(a.row){ch4Patch.add(fieldLabel('Patch sensitivity · negative-return share (%)'));ch4FactorNames.forEach(function(p){ch4Patch.add(ch4Text('Price '+p+': '+ch4FactorNames.map(function(c){var loss=v[src+'_'+Math.round(ch4Factors[p]*100)+'_'+Math.round(ch4Factors[c]*100)+'_loss'];return c+' cost '+(valid>0&&loss!==undefined?ch4Num(100*loss/valid)+'%':'Unavailable');}).join(' · '),'11px'));});}
  });
}
var ch4PriorQuery=querySelectedLocation;
querySelectedLocation=function(coords){
  if(viewSelect.getValue()!=='ch4_view'){ch4PriorQuery(coords);return;}
  var a=ch4Active,generation=ch4Generation,request=++ch4Request;ch4Patch.clear();ch4Patch.add(ch4Text('Reading the native annual patch ID…'));
  ee.Image(CH4_DATA.patch_index_asset).select([CH4_DATA.years.indexOf(a.year)]).rename('patch_id').reduceRegion({reducer:ee.Reducer.first(),geometry:ee.Geometry.Point([coords.lon,coords.lat]),crs:'EPSG:5070',crsTransform:[30,0,-111285,0,-30,2047275],maxPixels:1e6}).evaluate(function(v,error){
    if(generation!==ch4Generation||request!==ch4Request||viewSelect.getValue()!=='ch4_view')return;if(error||!v||!v.patch_id){ch4ClearPatch();ch4Patch.add(ch4Text(error?'Native lookup failed: '+error:'No mapped crop patch at this pixel.'));return;}ch4LoadPatch(v.patch_id);
  });
};
ch4ClearPatch();
