"""Pure calculations; missing observations are never zero-filled."""
from itertools import product
import numpy as np

ACRE_M2 = 4046.8564224
ACRES_PER_HA = 10000 / ACRE_M2
MGHA_PER_BUAC = 56 * 0.45359237 / 1000 * ACRES_PER_HA
YEARS = tuple(range(2001, 2022, 2))
SCENARIOS = ('M1_fixed', 'M2_HI_sensitivity')
SEED = 20260928
SENSITIVITIES = tuple(product((.85, 1., 1.15), repeat=2))

def economic(yield_mgha, price, cash_cost, total_cost, *, eligible, price_factor=1., cost_factor=1., operator_share=1.):
    if not eligible:
        raise ValueError('Verified original production-year UNL budget under the selected match policy required for every economic scenario')
    if not (np.isfinite(price) and price > 0 and 0 < operator_share <= 1 and price_factor > 0 and cost_factor > 0):
        raise ValueError('Invalid price, share or sensitivity')
    if not (np.isfinite(total_cost) and total_cost >= 0):
        raise ValueError('Verified total cost required')
    y = np.asarray(yield_mgha, dtype=float)
    y = np.where(np.isfinite(y) & (y >= 0), y, np.nan)
    revenue = y / MGHA_PER_BUAC * price * price_factor * operator_share
    total_return = revenue - total_cost * cost_factor
    cash_margin = revenue - cash_cost * cost_factor
    breakeven = total_cost * cost_factor / (price * price_factor * operator_share)
    return dict(revenue=revenue, cash_margin=cash_margin, total_return=total_return,
                breakeven_bu_ac=breakeven, breakeven_Mg_ha=breakeven * MGHA_PER_BUAC,
                loss=np.where(np.isfinite(y), (total_return < 0).astype(float), np.nan))

def quartile(y):
    y = np.asarray(y, float)
    valid = np.isfinite(y) & (y >= 0)
    cutoff = float(np.quantile(y[valid], .25, method='linear')) if valid.any() else np.nan
    return cutoff, np.where(valid, (y <= cutoff).astype(float), np.nan)

def correlation(m):
    n, sx, sy, xx, yy, xy = np.moveaxis(np.asarray(m, float), -1, 0)
    with np.errstate(divide='ignore', invalid='ignore'):
        vx, vy = xx-sx*sx/n, yy-sy*sy/n
        r = (xy-sx*sy/n)/np.sqrt(vx*vy)
    return np.where((n >= 3) & (vx > 0) & (vy > 0), np.clip(r,-1,1), np.nan)

def spatial_association(x, y, east, north, block_m=10000, replicates=1999, seed=SEED):
    good = np.isfinite(x) & np.isfinite(y)
    x,y,east,north = [np.asarray(a)[good].astype(float) for a in (x,y,east,north)]
    if not len(x):
        return dict(n=0,blocks=0,r=np.nan,ci_low=np.nan,ci_high=np.nan,defined_replicates=0)
    keys=np.column_stack([np.floor(east/block_m),np.floor(north/block_m)]).astype('int64')
    _,inv=np.unique(keys,axis=0,return_inverse=True)
    m=np.column_stack([np.bincount(inv,weights=v) for v in (np.ones(len(x)),x,y,x*x,y*y,x*y)])
    rng=np.random.default_rng(seed); draws=np.full(replicates,np.nan)
    if len(m)>=20:
        for i in range(replicates):
            draws[i]=correlation(m[rng.integers(0,len(m),len(m))].sum(axis=0))
    defined=np.isfinite(draws).sum()
    lo,hi=np.nanquantile(draws,[.025,.975]) if defined>=.95*replicates else (np.nan,np.nan)
    return dict(n=len(x),blocks=len(m),r=float(correlation(m.sum(axis=0))),ci_low=lo,ci_high=hi,
                defined_replicates=int(defined),block_m=block_m,replicates=replicates,seed=seed)
