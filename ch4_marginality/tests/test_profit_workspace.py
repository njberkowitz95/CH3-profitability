import unittest
import numpy as np
from ch4_marginality.profit_workspace import distribution,prefix
from ch4_marginality.core import economic,MGHA_PER_BUAC,quartile
from ch4_marginality.pipeline import grouped

class ProfitEvidenceContracts(unittest.TestCase):
    def test_histogram_tails_and_exact_edges(self):
        values=np.array([-1500,-1000,-900,0,999,1000,1500,np.nan])
        bins=distribution(values,'return')
        self.assertEqual(sum(b['pixels'] for b in bins),7)
        self.assertAlmostEqual(sum(b['area_ha'] for b in bins),.63)
        self.assertEqual(bins[0]['pixels'],1)
        self.assertEqual(bins[1]['pixels'],1)
        self.assertEqual(bins[-1]['pixels'],2)

    def test_unavailable_cash_distribution_is_missing(self):
        bins=distribution([np.nan,np.nan],'cash')
        self.assertTrue(all(b['pixels'] is None and b['area_ha'] is None and not b['defined'] for b in bins))

    def test_currency_keeps_classifications_and_ties(self):
        y=np.array([0,160*MGHA_PER_BUAC,170*MGHA_PER_BUAC,np.nan])
        e=economic(y,3.52,363.18,565.52,eligible=True)
        self.assertTrue(np.array_equal(e['total_return']<0,e['total_return']*1.059896658413421<0))
        cutoff,q=quartile([1,1,1,4]);self.assertEqual(cutoff,1);self.assertEqual(np.sum(q),3)

    def test_partial_source_scope_retains_crop_denominator(self):
        d=grouped(np.array([1,1,2,2]),np.ones(4,bool),np.array([True,False,False,False]),
                  np.array([10,np.nan,12,np.nan]),np.array([1,0,0,0]),np.array([-3,np.nan,9,np.nan]),
                  np.full(4,np.nan),np.array([30,np.nan,40,np.nan]))
        self.assertAlmostEqual(d.crop_ha.sum(),.36)
        self.assertAlmostEqual(d.valid_ha.sum(),.09)
        self.assertAlmostEqual(d.missing_ha.sum(),.27)
        self.assertTrue(np.isnan(d.loc[d.zone==2,'return_usd_ac_mean'].item()))
        self.assertTrue(d.cash_margin_usd_ac_mean.isna().all())

    def test_year_scenario_source_identity(self):
        self.assertEqual(prefix('M1_fixed','UNL'),'m1_u')
        self.assertNotEqual(prefix('M1_fixed','FINBIN_state'),prefix('M1_fixed','FINBIN_county'))

if __name__=='__main__':unittest.main()
