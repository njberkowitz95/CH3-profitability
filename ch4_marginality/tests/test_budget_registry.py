"""Evidence and production-system gates apply independently of calendar year."""
import hashlib
import json
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory
import unittest

from ch4_marginality.budget_registry import SOURCE_DIR, load_registry, eligible_years


class BudgetRegistryContracts(unittest.TestCase):
    def fixture(self, path):
        for name in ['unl_budget_registry.json', 'acquisition_manifest.json', 'unl_2019.pdf', 'unl_2021.pdf']:
            shutil.copy2(SOURCE_DIR / name, path / name)
        return json.loads((path / 'unl_budget_registry.json').read_text(encoding='utf-8'))

    def changed(self, mutate, expect_error=True):
        with TemporaryDirectory() as tmp:
            path=Path(tmp); data=self.fixture(path); mutate(data, path)
            (path/'unl_budget_registry.json').write_text(json.dumps(data), encoding='utf-8')
            if expect_error:
                with self.assertRaises(ValueError): load_registry(path)
            else:
                return load_registry(path)

    def test_recovered_does_not_mean_eligible(self):
        rows=load_registry(); self.assertEqual(eligible_years(rows), {2019,2021})
        row=next(r for r in rows if r['year']==2001)
        self.assertTrue(row['original_recovered']); self.assertFalse(row['eligible'])
        self.assertEqual(row['repository_record_id'], '2024')
        self.assertEqual(row['publication_year'], 2001)
        self.assertTrue(all(not c['eligible'] for r in rows for c in r['candidates']))

    def test_wrong_tillage_rotation_geography_water_and_year(self):
        for key,value in [('tillage','no-till'),('rotation','continuous'),('geography','Nebraska'),
                          ('water','irrigated'),('publication_year',2017)]:
            with self.subTest(key=key):
                self.changed(lambda d,p,k=key,v=value:d['years'][-2].update({k:v}))

    def test_missing_original_and_checksum(self):
        self.changed(lambda d,p:(p/'unl_2019.pdf').unlink())
        self.changed(lambda d,p:(p/'unl_2019.pdf').write_bytes(b'altered'))

    def test_missing_page_boolean_and_duplicate_year(self):
        self.changed(lambda d,p:d['years'][-2].update(pdf_page=None))
        self.changed(lambda d,p:d['years'][-2].update(eligible='True'))
        self.changed(lambda d,p:d['years'].append(d['years'][0].copy()))

    def test_validated_registry_can_enable_a_different_year(self):
        # Fixture-only reviewed original: prove the gate has no 2019/2021 whitelist.
        def mutate(d,p):
            row=d['years'][3]; known=d['years'][-2]
            row.update({k:v for k,v in known.items() if k not in ['year','publication_year']})
            row.update(year=2007,publication_year=2007,file='unl_2007.pdf',title='Fixture: 2007 matching original')
            shutil.copy2(p/'unl_2019.pdf',p/'unl_2007.pdf')
            manifest=json.loads((p/'acquisition_manifest.json').read_text(encoding='utf-8'))
            manifest.append(dict(file=row['file'],url=row['source_url'],sha256=row['sha256']))
            (p/'acquisition_manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
        self.assertEqual(eligible_years(self.changed(mutate,False)),{2007,2019,2021})
