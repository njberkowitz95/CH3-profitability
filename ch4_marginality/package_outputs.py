"""Copy compact, verified results to GitHub and refresh the Drive checksum manifest."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import shutil


EXCLUDE_REPO_TABLES = {'patch_statistics.csv'}


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def package(output):
    output = Path(output)
    package_dir = Path(__file__).resolve().parent
    assert json.loads((output / 'validation.json').read_text())['verified']
    assert json.loads((output / 'status.json').read_text())['status'] == 'analysis_complete'
    compact = package_dir / 'outputs'
    (compact / 'tables').mkdir(parents=True, exist_ok=True)
    for source in (output / 'tables').glob('*'):
        if source.is_file() and source.name not in EXCLUDE_REPO_TABLES:
            shutil.copy2(source, compact / 'tables' / source.name)
    for name in ('CH4_methods_results.md', 'CH4_methods_results.pdf',
                 'validation.json', 'ee_ingestion_verification.json',
                 'ee_classification_verification.json', 'app_build_verification.json',
                 'delivery_status.json', 'CH4_Marginality_executed.ipynb'):
        source = output / name
        if source.is_file():
            shutil.copy2(source, compact / name)
    files = []
    for source in sorted(output.rglob('*')):
        if source.is_file() and source.name != 'manifest.json':
            files.append({'file': source.relative_to(output).as_posix(),
                          'sha256': sha256(source), 'bytes': source.stat().st_size})
    manifest = {'created_utc': datetime.now(timezone.utc).isoformat(),
                'run': output.name, 'files': files,
                'year_gate': 'original exact-year matching UNL only',
                'seed': 20260928, 'bootstrap_replicates': 1999}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    (compact / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    return len(files)


if __name__ == '__main__':
    import sys
    print(f'Checksummed {package(sys.argv[1])} Drive outputs')
