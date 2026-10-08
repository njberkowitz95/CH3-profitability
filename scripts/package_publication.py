"""Version publication helpers without rewriting the frozen scientific package."""
from pathlib import Path
import argparse
import hashlib
import json
import zipfile
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from ch3_profitability.recover_release import publish_closed_file


def package(base: Path, out: Path) -> dict:
    repo=Path(__file__).resolve().parents[1]
    with zipfile.ZipFile(base) as archive:
        files={name:archive.read(name) for name in archive.namelist()
               if not name.endswith('/') and name not in ['publication_manifest.json','publication_provenance.json']}
    for root in ['ch3_profitability','docs']:
        for path in sorted((repo/root).rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts and path.suffix not in ['.pyc']:
                files[path.relative_to(repo).as_posix()]=path.read_bytes()
    files['requirements.txt']=(repo/'requirements.txt').read_bytes()
    files['publication_provenance.json']=json.dumps(dict(
        base_archive=base.name,base_sha256=hashlib.sha256(base.read_bytes()).hexdigest(),
        scope='Current CH3 publication helpers; unchanged scientific execution remains in code/ and code_manifest.json'),indent=2).encode()
    files['publication_manifest.json']=(json.dumps([dict(file=name,sha256=hashlib.sha256(data).hexdigest())
        for name,data in sorted(files.items())],indent=2)+'\n').encode()
    from tempfile import TemporaryDirectory
    with TemporaryDirectory() as folder:
        staged=Path(folder)/'package.zip'
        with zipfile.ZipFile(staged,'w',zipfile.ZIP_DEFLATED) as archive:
            for name,data in sorted(files.items()):
                info=zipfile.ZipInfo(name,date_time=(2000,1,1,0,0,0))
                info.compress_type=zipfile.ZIP_DEFLATED
                archive.writestr(info,data)
        digest=hashlib.sha256(staged.read_bytes()).hexdigest()
        target=out/('publication_package_'+digest[:16]+'.zip')
        publish_closed_file(staged,target)
    return dict(archive=target.name,sha256=digest,files=len(files)-1)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    print(json.dumps(package(args.base,args.output)))
