"""A disconnected publication session must not duplicate pending imports."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch, MagicMock
from ch3_profitability.assets import submit
from ch3_profitability.build_app import ASSET_PREFIX
from ch4_marginality.pipeline import sha


class ImportResumeTests(unittest.TestCase):
    def test_pending_imports_are_reused_and_changed_inputs_rejected(self):
        with TemporaryDirectory() as folder:
            out=Path(folder)
            (out/'verification').mkdir()
            (out/'app_assets').mkdir()
            (out/'verification/release_audit.json').write_text('{"verified":true}')
            rows=[]
            for name,filename in [('patch_evidence','patch_evidence.csv'),('evidence','evidence.csv'),('temporal','temporal.tif')]:
                path=out/'app_assets'/filename
                path.write_bytes(filename.encode())
                rows.append(dict(asset=ASSET_PREFIX+'_'+name,response={'id':name},source_sha256=sha(path)))
            (out/'asset_tasks.json').write_text(json.dumps(rows))
            with patch('ee.Initialize'), patch('ee.data.getTaskStatus',return_value=[{'state':'RUNNING'}]) as status, patch('google.cloud.storage.Client') as client, patch('ee.data.startIngestion') as start:
                self.assertEqual(submit(out),rows)
                self.assertEqual(status.call_count,3)
                client.return_value.bucket.return_value.blob.assert_not_called()
                start.assert_not_called()
                (out/'app_assets/temporal.tif').write_bytes(b'changed')
                with self.assertRaisesRegex(ValueError,'input differs'):
                    submit(out)

    def test_failed_import_is_not_silently_resubmitted(self):
        with TemporaryDirectory() as folder:
            out=Path(folder)
            (out/'verification').mkdir()
            (out/'app_assets').mkdir()
            (out/'verification/release_audit.json').write_text('{"verified":true}')
            path=out/'app_assets/patch_evidence.csv'
            path.write_bytes(b'input')
            (out/'asset_tasks.json').write_text(json.dumps([dict(asset=ASSET_PREFIX+'_patch_evidence',response={'id':'existing'},source_sha256=sha(path))]))
            with patch('ee.Initialize'), patch('ee.data.getTaskStatus',return_value=[{'state':'FAILED'}]), patch('google.cloud.storage.Client') as client:
                with self.assertRaisesRegex(ValueError,'requires investigation'):
                    submit(out)
                client.return_value.bucket.return_value.blob.assert_not_called()
