"""Prevent incomplete cloud outputs from being accepted as a complete release."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import pandas as pd
from ch3_profitability.recover_release import publish_closed_file, validate_patch_frame


class ClosedOutputTests(unittest.TestCase):
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
