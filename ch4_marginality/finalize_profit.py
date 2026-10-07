"""Lock platform provenance and compile a verified, deployment-ready candidate."""
from pathlib import Path
from datetime import datetime,timezone
import json
import ee
from .pipeline import sha,dump
from .profit_workspace import RUN_ID,BASE_ID,ASSET_PREFIX,YEARS

SOURCE_REVISION='c43283227f216f8253ca9d7227c829423b8839b4'
COLAB_URL='https://colab.research.google.com/drive/10pKscDzqeBuTmwKGzbSK74UqWHOKD1Y5'

def run(root):
    root=Path(root);out=root/'CH4_marginality'/RUN_ID;base=root/'CH4_marginality'/BASE_ID
    for filename in ('validation.json','asset_verification.json','profit_pixel_verification.json'):
        assert json.loads((out/filename).read_text())['verified'],filename
    ee.Initialize(project='ee-njberkowitz95')
    manifest=json.loads((out/'input_manifest.json').read_text())
    if 'platforms' not in manifest:
        inputs=[]
        for name in ('ch4_verified_yields_corefilter_20260928','ch4_finbin_county_scope_corefilter_20260928'):
            metadata=ee.data.getAsset('projects/ee-njberkowitz95/assets/'+name)
            assert metadata['properties']['source_sha256']==sha(base/'app_assets'/f'{name}.tif')
            inputs.append(metadata)
        manifest['platforms']={
            'github':{'repository':'njberkowitz95/Yields-and-Fields-CH1','numerical_source_revision':SOURCE_REVISION,'other_source_branches':{'fix/small-field-cleanup':'f14219ed443a39e0a57ab1233ed3fcd63ce13a43','small-field-cleanup':'f14219ed443a39e0a57ab1233ed3fcd63ce13a43'},'source_inventory_difference_from_main':False},
            'colab':{'notebook_url':COLAB_URL,'runtime_input_root':str(root),'profit_evidence_completed':True},
            'earth_engine_inputs':inputs,'platform_verification_utc':datetime.now(timezone.utc).isoformat()}
        dump(out/'input_manifest.json',manifest)
    from .release_context import ROTATION
    if ROTATION:
        assert json.loads((out/'evidence_asset_verification.json').read_text())['verified']
        manifest['platforms']['colab']['executed_notebook']='CH4_Rotation_Priority_executed.ipynb'
        manifest['platforms']['github']['code_parent_revision']='a093ee1050e1f89ea48190c538d10d2080471b6c'
        dump(out/'input_manifest.json',manifest)
        # Preserve source cutoff decimals exactly in the browser transport.
        # Reconciliation separately verifies the observed tied-pixel areas.
        import pandas as pd
        from .final_checks import records
        payload=json.loads((out/'app_data_profit.json').read_text())
        payload['annual']=records(pd.read_csv(base/'tables/annual_yield.csv',float_precision='round_trip'))
        dump(out/'app_data_profit.json',payload)
    digest=sha(out/'input_manifest.json')
    payload=json.loads((out/'app_data_profit.json').read_text());payload['input_manifest_sha256']=digest;dump(out/'app_data_profit.json',payload)
    validation=json.loads((out/'validation.json').read_text());validation['input_manifest_sha256']=digest;dump(out/'validation.json',validation)
    for suffix in ['_index',*[f'_patches_{y}' for y in YEARS]]:ee.data.setAssetProperties(ASSET_PREFIX+suffix,{'input_manifest_sha256':digest})
    if ROTATION:ee.data.setAssetProperties(ASSET_PREFIX+'_evidence',{'input_manifest_sha256':digest})
    from .build_profit_app import build
    candidate=build(root)
    dump(out/'candidate_verification.json',{'verified':True,'input_manifest_sha256':digest,'candidate_sha256':sha(candidate),'verified_utc':datetime.now(timezone.utc).isoformat(),'published':False})
    print('Verified candidate:',candidate,'SHA-256:',sha(candidate),flush=True)
    return candidate
