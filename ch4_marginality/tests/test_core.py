import unittest
import numpy as np
from ch4_marginality.core import economic,quartile,MGHA_PER_BUAC,ACRES_PER_HA,spatial_association,SENSITIVITIES
from ch4_marginality.prepare_budgets import build
from tempfile import TemporaryDirectory

class ScientificContracts(unittest.TestCase):
    def test_unit_conversion(self):
        self.assertAlmostEqual(MGHA_PER_BUAC,.062770,places=5)
        self.assertAlmostEqual(ACRES_PER_HA,2.47105381467)
    def test_breakeven_and_missing(self):
        e=economic(np.array([100*MGHA_PER_BUAC,np.nan,-9999,0]),4,200,400,eligible=True)
        np.testing.assert_allclose(e['total_return'][[0,3]],[0,-400],atol=1e-12)
        self.assertTrue(np.isnan(e['loss'][1:3]).all())
        self.assertEqual(e['breakeven_bu_ac'],100)
        self.assertEqual(e['loss'][0],0)
    def test_gate_for_every_source(self):
        with self.assertRaises(ValueError):economic([1],4,100,200,eligible=False)
    def test_quartile_ties(self):
        cut,q=quartile([1,1,1,2,3,4,np.nan]);self.assertEqual(cut,1)
        self.assertEqual(np.nansum(q),3);self.assertTrue(np.isnan(q[-1]))
    def test_sensitivity(self):
        self.assertEqual(len(SENSITIVITIES),9)
        low=economic([5],4,200,400,eligible=True,price_factor=.85,cost_factor=1.15)
        high=economic([5],4,200,400,eligible=True,price_factor=1.15,cost_factor=.85)
        self.assertLess(low['total_return'][0],high['total_return'][0])
        self.assertGreater(low['breakeven_bu_ac'],high['breakeven_bu_ac'])
    def test_operator_share(self):
        e=economic([100*MGHA_PER_BUAC],4,100,200,eligible=True,operator_share=.5)
        self.assertAlmostEqual(e['total_return'][0],0)
    def test_constant_or_missing(self):
        cut,q=quartile([np.nan,-9999]);self.assertTrue(np.isnan(cut));self.assertTrue(np.isnan(q).all())
        a=spatial_association(np.ones(100),np.ones(100),np.arange(100)*10000,np.zeros(100))
        self.assertTrue(np.isnan(a['r']));self.assertTrue(np.isnan(a['ci_low']))
    def test_budget_totals_alignment(self):
        with TemporaryDirectory() as d:
            c,e=build(d)
            self.assertEqual(set(c.year),{2019,2021})
            self.assertEqual(set(e[e.eligible].year),{2019,2021})
            unl=c[c.source=='UNL'].set_index('year')
            self.assertAlmostEqual(unl.loc[2021,'cash_cost_usd_ac'],345.69)
            self.assertAlmostEqual(unl.loc[2019,'total_cost_usd_ac'],565.52)
            self.assertTrue(unl.loc[2019,'cash_rounding_discrepancy'])
    def test_spatial_aggregation_missing_and_area(self):
        from ch4_marginality.pipeline import grouped
        zone=np.array([1,1,2,2,3]);crop=np.ones(5,dtype=bool)
        y=np.array([1.,np.nan,3.,4.,np.nan]);valid=np.isfinite(y)
        q=np.array([1.,np.nan,0.,0.,np.nan]);ret=np.array([-10.,np.nan,20.,30.,np.nan])
        d=grouped(zone,crop,valid,y,q,ret,np.full(5,np.nan),ret+100).set_index('zone')
        self.assertAlmostEqual(d.valid_ha.sum(),.27)
        self.assertAlmostEqual(d.missing_ha.sum(),.18)
        self.assertAlmostEqual(d.return_usd_ac_sum_usd.sum(),40*.09*ACRES_PER_HA)
        self.assertTrue(d.cash_margin_usd_ac_mean.isna().all())
        self.assertTrue(np.isnan(d.loc[3,'return_usd_ac_sum_usd']))
        self.assertAlmostEqual(d.economic_loss_ha.sum(),.09)
    def test_app_threshold_serialization_retains_ties(self):
        import pandas as pd
        from ch4_marginality.final_checks import records
        cutoff=float(np.float32(1.0081028))
        restored=records(pd.DataFrame({'cutoff':[cutoff],'missing':[np.nan]}))[0]
        self.assertEqual(restored['cutoff'],cutoff)
        self.assertIsNone(restored['missing'])

if __name__=='__main__':unittest.main()
