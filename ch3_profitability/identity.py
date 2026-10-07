"""Preserve the existing pixel/patch namespace and verify its source masks."""
from pathlib import Path
import json
import shutil
from ch4_marginality.pipeline import paths, sha, dump


def run(root: Path, out: Path) -> None:
    root,out=Path(root),Path(out)
    prior=root/'CH4_marginality/20260930_indexable_ids_v1'
    schema=json.loads((prior/'identity_schema.json').read_text())
    verification=json.loads((prior/'id_verification.json').read_text())
    if not verification['verified']:
        raise ValueError('Verified original identities required')
    for row in schema['source_inventory']:
        _,mask,index=paths(root,row['year'],'M1_fixed')[:3]
        if sha(mask)!=row['mask_sha256'] or sha(index)!=row['index_sha256']:
            raise ValueError('Identity mask or patch index superseded')
    manifest=json.loads((prior/'output_manifest.json').read_text())
    selected={'annual_crop_pixel_ids.tif','crop_pixel_index.sqlite','patch_identity_registry.csv','identity_schema.json','id_coverage.csv','id_verification.json'}
    references=[]
    for record in manifest['files']:
        if record['path'] not in selected:continue
        path=prior/record['path']
        if sha(path)!=record['sha256']:raise ValueError('Identity artifact changed: '+str(path))
        references.append(dict(path=path.relative_to(root.parent).as_posix(),sha256=record['sha256'],bytes=path.stat().st_size))
        if path.suffix!='.sqlite':
            dest=out/('rasters' if path.suffix=='.tif' else 'tables' if path.suffix=='.csv' else 'verification')/path.name
            shutil.copy2(path,dest)
    if len(references)!=len(selected):raise ValueError('Identity artifacts incomplete')
    dump(out/'identity_reference.json',dict(verified=True,namespace=schema['namespace'],unchanged_mask_and_index_years=11,
         scope='Mapped dryland corn, including missing-yield crop pixels; not other crop types or ownership',
         referenced_artifacts=references,sqlite_reused_without_duplication=True))
