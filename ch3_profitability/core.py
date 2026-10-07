"""Profitability calculations with explicit missingness and sign conventions."""
from __future__ import annotations

import numpy as np
import pandas as pd
from ch4_marginality.core import economic, ACRES_PER_HA, MGHA_PER_BUAC

PIXEL_HA = .09
CLASS_NODATA = -128
CLASSES = {-1: 'loss', 0: 'breakeven', 1: 'profitable'}


def classify(profit: np.ndarray) -> np.ndarray:
    """Classify unrounded returns: -1 loss, 0 breakeven, 1 profit, -128 missing."""
    values = np.asarray(profit, dtype=np.float64)
    result = np.full(values.shape, CLASS_NODATA, dtype=np.int8)
    good = np.isfinite(values)
    result[good] = np.sign(values[good]).astype(np.int8)
    return result


def calculate(yield_mgha: np.ndarray, account: dict, price_factor: float = 1.,
              cost_factor: float = 1., eligible: bool = True) -> dict:
    """Use the unchanged CH4 economic engine, then classify its unrounded returns."""
    result = economic(yield_mgha, account['nass_price_usd_bu'],
                      account['cash_cost_usd_ac'], account['total_cost_usd_ac'],
                      eligible=eligible, price_factor=price_factor,
                      cost_factor=cost_factor, operator_share=account['operator_share'])
    result['profit_class'] = classify(result['total_return'])
    return result


def yield_groups(zone: np.ndarray, yields: np.ndarray, valid: np.ndarray) -> pd.DataFrame:
    """Cache yield distributions once per source domain, including empty crop units."""
    z = np.asarray(zone, dtype=np.int32)
    y = np.asarray(yields, dtype=np.float64)
    v = np.asarray(valid, dtype=bool) & np.isfinite(y) & (y >= 0)
    if z.shape != y.shape or z.shape != v.shape or np.any(z <= 0):
        raise ValueError('Positive native zone IDs and aligned crop vectors required')
    crop = pd.Series(z).value_counts().sort_index().rename('crop_pixels')
    frame = pd.DataFrame({'zone': z[v], 'y': y[v]})
    g = frame.groupby('zone').y
    stats = g.agg(['count', 'mean', 'min', 'max'])
    stats['sd'] = g.std(ddof=0)
    for p, label in [(.05, 'p05'), (.5, 'median'), (.95, 'p95')]:
        stats[label] = g.quantile(p, interpolation='linear')
    result = crop.to_frame().join(stats)
    result['count'] = result['count'].fillna(0).astype(int)
    result.index.name = 'zone'
    return result


def summarize_groups(zone: np.ndarray, yields: np.ndarray, valid: np.ndarray,
                     quartile: np.ndarray, account: dict, price_factor: float,
                     cost_factor: float, cached: pd.DataFrame | None = None) -> pd.DataFrame:
    """Aggregate fixed-area pixels; rates use valid area, never total crop area."""
    z = np.asarray(zone, dtype=np.int32)
    y = np.asarray(yields, dtype=np.float64)
    v = np.asarray(valid, dtype=bool) & np.isfinite(y) & (y >= 0)
    q = np.asarray(quartile, dtype=bool)
    stats = yield_groups(z, y, v) if cached is None else cached
    out = stats.copy()
    e = calculate(np.where(v, y, np.nan), account, price_factor, cost_factor)
    classes = e['profit_class']
    n = int(z.max()) + 1
    ids = out.index.to_numpy(dtype=int)
    counts = out['count'].to_numpy()
    out['crop_ha'] = out.crop_pixels * PIXEL_HA
    out['valid_ha'] = counts * PIXEL_HA
    out['missing_ha'] = out.crop_ha - out.valid_ha
    out['coverage_percent'] = counts / out.crop_pixels * 100
    for code, label in CLASSES.items():
        area = np.bincount(z[v & (classes == code)], minlength=n)[ids] * PIXEL_HA
        out[label + '_ha'] = np.where(counts > 0, area, np.nan)
        out[label + '_percent'] = np.divide(area * 100, counts * PIXEL_HA,
                                           out=np.full(len(ids), np.nan), where=counts > 0)
        for flag, text in [(True, 'quartile'), (False, 'nonquartile')]:
            a = np.bincount(z[v & (classes == code) & (q == flag)], minlength=n)[ids] * PIXEL_HA
            out[label + '_' + text + '_ha'] = np.where(counts > 0, a, np.nan)
    out['quartile_ha'] = np.where(counts > 0, np.bincount(z[v & q], minlength=n)[ids] * PIXEL_HA, np.nan)
    slope = account['nass_price_usd_bu'] * price_factor * account['operator_share'] / MGHA_PER_BUAC
    for metric, offset in [('profit', account['total_cost_usd_ac'] * cost_factor),
                           ('cash_margin', account['cash_cost_usd_ac'] * cost_factor), ('revenue', 0.)]:
        for name in ['mean', 'min', 'max', 'p05', 'median', 'p95']:
            out[f'{metric}_{name}_usd_ac'] = out[name] * slope - offset
        out[f'{metric}_sd_usd_ac'] = out.sd * slope if np.isfinite(offset) else np.nan
        values = e[{'profit': 'total_return', 'cash_margin': 'cash_margin', 'revenue': 'revenue'}[metric]]
        good = v & np.isfinite(values)
        sums = np.bincount(z[good], weights=values[good], minlength=n)[ids] * PIXEL_HA * ACRES_PER_HA
        nc = np.bincount(z[good], minlength=n)[ids]
        out[f'{metric}_total_usd'] = np.where(nc > 0, sums, np.nan)
    for col in list(out.columns):
        if col.endswith(('_usd_ac', '_total_usd')):
            out[col + '_2021dollars'] = out[col] * account['to_2021_dollars']
    out['breakeven_bu_ac'] = e['breakeven_bu_ac']
    out['breakeven_Mg_ha'] = e['breakeven_Mg_ha']
    out = out.rename(columns={k: 'yield_' + k + '_Mg_ha' for k in ['mean','sd','min','max','p05','median','p95']})
    return out.reset_index()


def transition_counts(before: np.ndarray, after: np.ndarray, from_year: int, to_year: int) -> list[dict]:
    """Nine mutually exclusive transitions only across adjacent biennial observations."""
    if to_year - from_year != 2:
        raise ValueError('Unavailable years must not be bridged')
    a, b = np.asarray(before), np.asarray(after)
    good = np.isin(a, list(CLASSES)) & np.isin(b, list(CLASSES))
    return [dict(from_class=x, to_class=y, from_label=CLASSES[x], to_label=CLASSES[y],
                 pair_common_ha=int(good.sum()) * PIXEL_HA,
                 transition_ha=int((good & (a == x) & (b == y)).sum()) * PIXEL_HA)
            for x in CLASSES for y in CLASSES]
