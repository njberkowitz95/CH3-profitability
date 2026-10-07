"""Policy integrity, accounting exceptions and exact production-year alignment."""
import hashlib,json,shutil,unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import numpy as np
import pandas as pd
from ch4_marginality.budget_policy import load_policy
from ch4_marginality.budget_registry import SOURCE_DIR
from ch4_marginality.prepare_budgets import build

class RotationPolicyContracts(unittest.TestCase):
    def fixture(self,path):
        for name in ['unl_budget_registry.json','acquisition_manifest.json','unl_rotation_selections.json']:
            shutil.copy2(SOURCE_DIR/name,path/name)
        registry=json.loads((path/'unl_budget_registry.json').read_text())
        manifest=json.loads((path/'acquisition_manifest.json').read_text())
        # Synthetic original bytes make the provenance contracts independent of
        # PDF-host network availability. Production calculations use real bytes.
        for r in registry['years']:
            if not r['original_recovered']:continue
            data=f'Fixture original production year {r["year"]}'.encode()
            (path/r['file']).write_bytes(data);r['sha256']=hashlib.sha256(data).hexdigest()
            next(m for m in manifest if m['file']==r['file'])['sha256']=r['sha256']
        (path/'unl_budget_registry.json').write_text(json.dumps(registry))
        (path/'acquisition_manifest.json').write_text(json.dumps(manifest))
        return registry

    def test_strict_and_rotation_policy_do_not_relabel(self):
        with TemporaryDirectory() as tmp:
            p=Path(tmp);self.fixture(p)
            exact=load_policy(p,'exact');closest=load_policy(p)
            self.assertEqual({r['year'] for r in exact if r['eligible']},{2019,2021})
            self.assertEqual({r['year'] for r in closest if r['eligible']},{2001,2009,2011,2013,2015,2017,2019,2021})
            for r in closest:
                if r['year'] in [2001,2009,2011,2013,2015,2017]:
                    self.assertFalse(r['strict_eligible']);self.assertEqual(r['match_designation'],'Approximate')
                if r['year'] in [2003,2005,2007]:self.assertFalse(r['eligible'])

    def test_rejects_year_substitution_source_change_and_false_exact(self):
        for mutation in ['publication_year','source_bytes','exact_label','rotation','page']:
            with self.subTest(mutation=mutation),TemporaryDirectory() as tmp:
                p=Path(tmp);registry=self.fixture(p)
                selection=json.loads((p/'unl_rotation_selections.json').read_text())
                if mutation=='publication_year':registry['years'][0]['publication_year']=2003
                if mutation=='source_bytes':(p/'unl_2001.pdf').write_bytes(b'changed')
                if mutation=='exact_label':selection['years'][0]['match_designation']='Exact'
                if mutation=='page':selection['years'][0]['pdf_page']=27
                if mutation=='rotation':next(c for c in registry['years'][0]['candidates'] if c['budget_number']==15)['title']='Corn, Dryland, No-Till, Continuous'
                (p/'unl_budget_registry.json').write_text(json.dumps(registry))
                (p/'unl_rotation_selections.json').write_text(json.dumps(selection))
                with self.assertRaises(ValueError):load_policy(p)

    def test_source_account_totals_missing_cash_and_partial_2009(self):
        with TemporaryDirectory() as tmp:
            p=Path(tmp);self.fixture(p);rows=load_policy(p)
            with patch('ch4_marginality.budget_policy.load_policy',return_value=rows):
                c,e=build(p/'tables',policy='closest_rotation')
            unl=c[c.source=='UNL'].set_index('year')
            self.assertEqual(set(unl.index),{2001,2011,2013,2015,2017,2019,2021})
            for y,t in [(2001,231.97),(2011,347.88),(2013,450.19),(2015,478.01),(2017,654.49)]:self.assertEqual(unl.loc[y,'total_cost_usd_ac'],t)
            self.assertTrue(np.isnan(unl.loc[2001,'cash_cost_usd_ac']))
            partial=pd.read_csv(p/'tables/unl_incomplete_accounts.csv').iloc[0]
            self.assertEqual(partial.year,2009);self.assertEqual(partial.listed_cost_usd_ac,277.98)
            self.assertTrue(np.isnan(partial.total_cost_usd_ac))
            self.assertTrue(set(c.year).isdisjoint({2003,2005,2007}))
            self.assertNotIn((2017,'FINBIN_county'),set(zip(c.year,c.source)))
            self.assertEqual(unl.loc[2019,'cash_cost_usd_ac'],363.18)
            self.assertEqual(unl.loc[2021,'total_cost_usd_ac'],572.18)

    def test_final_price_and_positive_inflation_year_alignment(self):
        rows=json.loads((SOURCE_DIR/'rotation_annual_prices.json').read_text())
        expected={2001:1.94,2009:3.58,2011:6.11,2013:4.47,2015:3.57,2017:3.35,2019:3.52,2021:5.96}
        self.assertEqual({r['year']:r['price_usd_bu'] for r in rows},expected)
        for r in rows:
            self.assertGreater(r['cpi_u'],0)
            if r['year']<2019:
                self.assertGreater(r['report_publication_year'],r['year'])
                self.assertEqual(r['price_status'],'finalized')
