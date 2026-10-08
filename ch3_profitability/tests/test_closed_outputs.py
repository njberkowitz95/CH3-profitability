"""Prevent incomplete cloud outputs from being accepted as a complete release."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
import sqlite3
from contextlib import closing
import pandas as pd
from ch3_profitability.recover_release import publish_closed_file, validate_patch_frame
from ch3_profitability.audit_release import verify_spatial_tables


class ClosedOutputTests(unittest.TestCase):
    def test_spatial_audit_rejects_concurrent_replacement(self):
        with TemporaryDirectory() as folder:
            path=Path(folder)/'results.gpkg'
            path.write_bytes(b'original')
            with patch('ch3_profitability.audit_release.sha',side_effect=['snapshot','changed']):
                with self.assertRaisesRegex(ValueError,'changed while staging'):
                    verify_spatial_tables(path,pd.DataFrame())

    def test_spatial_database_requires_complete_registered_results(self):
        rows=pd.DataFrame([dict(year=2019,scenario='M1',source='UNL',price_factor=p,
            cost_factor=1.,valid_ha=.09,profitable_ha=.09,breakeven_ha=0.,loss_ha=0.,
            profit_total_usd=2.) for p in [.85,1.,1.15]])
        with TemporaryDirectory() as folder:
            path=Path(folder)/'results.gpkg'
            with closing(sqlite3.connect(path)) as con, con:
                con.execute('CREATE TABLE gpkg_contents(table_name TEXT, data_type TEXT)')
            with self.assertRaisesRegex(ValueError,'absent'):
                verify_spatial_tables(path,rows)
            with closing(sqlite3.connect(path)) as con, con:
                for table in ['annual_profitability','county_sensitivity','patch_sensitivity']:
                    frame=rows[rows.price_factor==1] if table=='annual_profitability' else rows
                    frame.to_sql(table,con,index=False)
                    con.execute('INSERT INTO gpkg_contents VALUES (?,?)',(table,'attributes'))
            self.assertEqual(verify_spatial_tables(path,rows)['patch_sensitivity'],3)
            with closing(sqlite3.connect(path)) as con, con:
                con.execute('DELETE FROM patch_sensitivity WHERE price_factor > 1')
            with self.assertRaisesRegex(ValueError,'combinations differ'):
                verify_spatial_tables(path,rows)

    def test_missing_sensitivity_is_rejected(self):
        rows = [dict(year=2019, scenario='M1', source='UNL', price_factor=p,
                     cost_factor=1., valid_ha=.09, profitable_ha=.09,
                     breakeven_ha=0., loss_ha=0., profit_total_usd=2.) for p in [.85, 1., 1.15]]
        expected = pd.DataFrame(rows)
        patches = expected.assign(patch_id=12)
        validate_patch_frame(patches, expected)
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            validate_patch_frame(patches.iloc[:2], expected)
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            validate_patch_frame(pd.concat([patches, patches.iloc[:1]]), expected)

    def test_closed_copy_is_exact_and_replaces_only_target(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            source, target = root/'source', root/'destination'
            source.write_bytes(b'complete\x00output')
            target.write_bytes(b'old incomplete output')
            publish_closed_file(source, target)
            self.assertEqual(target.read_bytes(), source.read_bytes())
            self.assertFalse((root/'destination.uploading').exists())


if __name__ == '__main__':
    unittest.main()
