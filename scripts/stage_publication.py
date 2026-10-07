"""Stage a separate publication package without altering the active analysis code."""
from pathlib import Path
import hashlib
import json
import shutil
import nbformat

REPO=Path(__file__).resolve().parents[1]
RELEASE=Path('G:/My Drive/PHD/CSP3_GPP_outputs/CH3_profitability/20261007_profitability_v1')
CODE=RELEASE/'publication_code'
CODE.mkdir(parents=True,exist_ok=True)
for name in ['ch3_profitability','ch4_marginality','docs']:
    shutil.copytree(REPO/name,CODE/name,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
files=[dict(file=p.relative_to(CODE).as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(CODE.rglob('*')) if p.is_file()]
(RELEASE/'publication_code_manifest.json').write_text(json.dumps(files,indent=2),encoding='utf-8')
nb=nbformat.v4.new_notebook()
nb.metadata.kernelspec={'display_name':'Python 3','language':'python','name':'python3'}
cells=[
  ('markdown','# Chapter 3 publication and verification\n\nRun after the completed numerical notebook. This notebook creates release evidence and Earth Engine assets; browser candidate testing and live publication remain separate required steps.'),
  ('code',"from pathlib import Path\nimport sys, json, hashlib, importlib.metadata as metadata\nROOT=Path('/content/drive/MyDrive/PHD/CSP3_GPP_outputs')\nOUTPUT=ROOT/'CH3_profitability/20261007_profitability_v1'\nCODE=OUTPUT/'publication_code'\nfor row in json.loads((OUTPUT/'publication_code_manifest.json').read_text()):\n    assert hashlib.sha256((CODE/row['file']).read_bytes()).hexdigest()==row['sha256'],row['file']\nassert json.loads((OUTPUT/'validation.json').read_text())['verified']\nsys.path.insert(0,str(CODE))\nprint('Verified publication code and numerical prerequisites')"),
  ('code',"from ch3_profitability.supplement import run as figures\nfrom ch3_profitability.report import run as report\nfrom ch3_profitability.identity import run as identities\nfigures(OUTPUT)\nreport(OUTPUT)\nidentities(ROOT,OUTPUT)\nprint('Publication figures, report and preserved identities complete')"),
  ('code',"from ch3_profitability.assets import prepare\nprepare(OUTPUT)\nprint('Earth Engine tables and temporal image prepared')"),
  ('code',"import ee\nfrom google.cloud import storage\nversions={name:metadata.version(name) for name in ['earthengine-api','google-cloud-storage','numpy','pandas','rasterio','geopandas']}\n(OUTPUT/'publication_environment.json').write_text(json.dumps(versions,indent=2))\ntry:\n    ee.Initialize(project='ee-njberkowitz95')\nexcept Exception:\n    ee.Authenticate()\n    ee.Initialize(project='ee-njberkowitz95')\nprint('Earth Engine connected; dependency versions recorded')"),
  ('code',"from ch3_profitability.assets import submit\ntasks=submit(OUTPUT)\nprint(json.dumps(tasks,indent=2))"),
  ('code',"import time\nfor attempt in range(60):\n    ids=[x['response']['id'] for x in tasks if 'response' in x]\n    states=ee.data.getTaskStatus(ids) if ids else []\n    print([(x['state'],x.get('error_message')) for x in states],flush=True)\n    if any(x['state'] in ['FAILED','CANCELLED'] for x in states): raise RuntimeError('An Earth Engine import failed')\n    if all(x['state']=='COMPLETED' for x in states): break\n    time.sleep(10)\nelse: raise RuntimeError('Imports still running; repeat this status cell later')"),
  ('code',"from ch3_profitability.assets import verify\nfrom ch3_profitability.verify_native import run as verify_native\nverify(OUTPUT)\nverify_native(ROOT)\nprint('New assets and reused native input assets verified')"),
  ('code',"from ch4_marginality.profit_workspace import lock_inputs\nfrom ch3_profitability.pipeline import SOURCE_RELEASE\nfrom ch3_profitability.build_app import build\nprior=ROOT/'CH4_marginality'/SOURCE_RELEASE\nlock_inputs(ROOT,prior/'analysis',OUTPUT,json.loads((prior/'input_manifest.json').read_text()))\ncandidate=build(OUTPUT)\nprint('Verified app candidate:',candidate)\nprint('Browser testing and publication are still required; this notebook does not declare the live app complete.')")
]
nb.cells=[nbformat.v4.new_markdown_cell(text) if kind=='markdown' else nbformat.v4.new_code_cell(text) for kind,text in cells]
nbformat.write(nb,REPO/'CH3_Publication.ipynb')
nbformat.write(nb,RELEASE/'CH3_Publication.ipynb')
print('Staged publication package:',len(files),'files')
