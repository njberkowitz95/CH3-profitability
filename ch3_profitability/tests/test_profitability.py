import unittest
import numpy as np
from ch4_marginality.core import economic, MGHA_PER_BUAC, SENSITIVITIES
from ch3_profitability.core import classify, calculate, summarize_groups, transition_counts

ACCOUNT = dict(nass_price_usd_bu=2.,cash_cost_usd_ac=100.,total_cost_usd_ac=200.,operator_share=1.,to_2021_dollars=1.5)

class ProfitabilityTests(unittest.TestCase):
    def test_checkpoint_requires_matching_method(self):
        import json, tempfile
        from ch3_profitability.pipeline import checkpoint_valid
        with tempfile.TemporaryDirectory() as tmp:
            folder=__import__('pathlib').Path(tmp)
            (folder/'complete.json').write_text(json.dumps(dict(input_hash='input',method_hash='method',files=[])))
            self.assertTrue(checkpoint_valid(folder,'input','method'))
            self.assertFalse(checkpoint_valid(folder,'input','changed-method'))
            with self.assertRaises(ValueError):checkpoint_valid(folder,'changed-input','method')

    def test_unrounded_sign_and_missing(self):
        np.testing.assert_array_equal(classify(np.array([-1e-15,0,1e-15,np.nan,np.inf,-np.inf])),[-1,0,1,-128,-128,-128])

    def test_unchanged_economic_engine(self):
        y=np.array([0,4,10,np.nan,-1])
        for pf,cf in SENSITIVITIES:
            got=calculate(y,ACCOUNT,pf,cf)
            prior=economic(y,2,100,200,eligible=True,price_factor=pf,cost_factor=cf)
            for key in prior: np.testing.assert_array_equal(got[key],prior[key])
        with self.assertRaises(ValueError): calculate(y,ACCOUNT,eligible=False)

    def test_area_money_and_quartile_partition(self):
        z=np.array([1,1,2,2,3]); y=np.array([0,20,5,np.nan,np.nan]); valid=np.isfinite(y); q=y<=5
        r=summarize_groups(z,y,valid,q,ACCOUNT,1,1)
        np.testing.assert_allclose(r.valid_ha,[.18,.09,0])
        np.testing.assert_allclose(r[['profitable_ha','breakeven_ha','loss_ha']].sum(axis=1,min_count=1),[.18,.09,np.nan],equal_nan=True)
        self.assertTrue(np.isnan(r.iloc[2].profit_total_usd))
        self.assertEqual(r.iloc[2].missing_ha,.09)
        qsum=r.filter(regex='^(loss|breakeven|profitable)_(nonquartile|quartile)_ha$').sum(axis=1,min_count=1)
        np.testing.assert_allclose(qsum,[.18,.09,np.nan],equal_nan=True)
        expected=calculate(y,ACCOUNT)['total_return']
        self.assertAlmostEqual(r.profit_total_usd.sum(),np.nansum(expected)*.09*10000/4046.8564224)

    def test_currency_and_unavailable_cash(self):
        account={**ACCOUNT,'cash_cost_usd_ac':np.nan}
        r=summarize_groups(np.array([1,1]),np.array([0,10]),np.array([True,True]),np.array([True,False]),account,1,1)
        self.assertTrue(r.cash_margin_mean_usd_ac.isna().all())
        self.assertTrue(r.cash_margin_total_usd.isna().all())
        self.assertAlmostEqual(r.profit_mean_usd_ac_2021dollars.iloc[0],1.5*r.profit_mean_usd_ac.iloc[0])
        v=calculate(np.array([0,10]),account)['total_return']
        np.testing.assert_array_equal(classify(v),classify(v*1.5))

    def test_sensitivity_monotonicity(self):
        y=np.linspace(0,20,100)
        self.assertTrue(np.all(calculate(y,ACCOUNT,1.15,1)['total_return']>=calculate(y,ACCOUNT,.85,1)['total_return']))
        self.assertTrue(np.all(calculate(y,ACCOUNT,1,.85)['total_return']>=calculate(y,ACCOUNT,1,1.15)['total_return']))

    def test_three_state_transition_and_gap(self):
        rows=transition_counts(np.array([-1,0,1,-128]),np.array([1,0,-1,1]),2017,2019)
        self.assertEqual(len(rows),9)
        self.assertAlmostEqual(sum(r['transition_ha'] for r in rows),.27)
        self.assertEqual(next(r for r in rows if r['from_class']==r['to_class']==0)['transition_ha'],.09)
        with self.assertRaises(ValueError): transition_counts(np.array([1]),np.array([1]),2001,2009)

if __name__ == '__main__': unittest.main()
