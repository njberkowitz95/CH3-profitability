"""Ship publication helpers as an immutable archive to avoid Drive cache mixing."""
from pathlib import Path
import hashlib
import json
import zipfile

repo = Path(__file__).resolve().parents[1]
release = Path('G:/My Drive/PHD/CSP3_GPP_outputs/CH3_profitability/20261007_profitability_v1')
local = repo.parent / 'ch3_review/publication_package.zip'
local.parent.mkdir(exist_ok=True)
manifest = []
with zipfile.ZipFile(local, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for directory in ['ch3_profitability', 'ch4_marginality', 'docs']:
        for path in sorted((repo / directory).rglob('*')):
            if not path.is_file() or '__pycache__' in path.parts or path.suffix == '.pyc':
                continue
            name = path.relative_to(repo).as_posix()
            raw = path.read_bytes()
            manifest.append(dict(file=name, sha256=hashlib.sha256(raw).hexdigest()))
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 7, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, raw)
    archive.writestr('publication_manifest.json', json.dumps(manifest, indent=2))
digest = hashlib.sha256(local.read_bytes()).hexdigest()
target = release / ('publication_package_' + digest[:16] + '.zip')
if not target.exists():
    target.write_bytes(local.read_bytes())
assert hashlib.sha256(target.read_bytes()).hexdigest() == digest
print(json.dumps(dict(file=target.name, sha256=digest, files=len(manifest))))
