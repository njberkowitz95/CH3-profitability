"""Checksum the immutable release after live publication has been verified."""
from pathlib import Path
from datetime import datetime, timezone
import json
from .pipeline import sha, dump
from .profit_workspace import RUN_ID

def run(root):
    out=Path(root)/'CH4_marginality'/RUN_ID
    status=json.loads((out/'delivery_status.json').read_text())
    assert status['live_app_verified'] and status['colab_executed']
    for filename in ('validation.json','asset_verification.json','profit_pixel_verification.json'):
        assert json.loads((out/filename).read_text())['verified'], filename
    assert sha(out/'gee_app_Yield_PEM_profit.js')==status['app_sha256']
    entries=[]
    for p in sorted(out.rglob('*')):
        if p.is_file() and p.name not in ('output_manifest.json','output_manifest.sha256') and '__pycache__' not in p.parts:
            entries.append(dict(path=p.relative_to(out).as_posix(),bytes=p.stat().st_size,sha256=sha(p)))
    dump(out/'output_manifest.json',dict(run_id=RUN_ID,created_utc=datetime.now(timezone.utc).isoformat(),
         input_manifest_sha256=sha(out/'input_manifest.json'),files=entries))
    (out/'output_manifest.sha256').write_text(sha(out/'output_manifest.json')+'  output_manifest.json\n',encoding='utf8')
    print('Checksummed release files:',len(entries),flush=True)
    return out/'output_manifest.json'

if __name__=='__main__':
    import sys
    run(sys.argv[1] if len(sys.argv)>1 else 'G:/My Drive/PHD/CSP3_GPP_outputs')
