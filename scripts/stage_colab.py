"""Stage a checksummed runnable package and notebook in the new Drive release."""
from pathlib import Path
import hashlib
import importlib.metadata as metadata
import json
import shutil
import nbformat

REPO=Path(__file__).resolve().parents[1]
RELEASE=Path('G:/My Drive/PHD/CSP3_GPP_outputs/CH3_profitability/20261007_profitability_v1')
CODE=RELEASE/'code'
CODE.mkdir(parents=True,exist_ok=True)
for name in ['ch3_profitability','ch4_marginality']:
    shutil.copytree(REPO/name,CODE/name,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
pins={}
for name in ['numpy','pandas','scipy','rasterio','geopandas','shapely','matplotlib','openpyxl','nbformat','nbclient','markdown','tabulate','requests','beautifulsoup4','reportlab']:
    pins[name]=metadata.version(name)
requirements='\n'.join(f'{key}=={value}' for key,value in pins.items())+'\n'
(REPO/'requirements.txt').write_text(requirements,encoding='utf-8')
(CODE/'requirements.txt').write_text(requirements,encoding='utf-8')
files=[dict(file=p.relative_to(CODE).as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(CODE.rglob('*')) if p.is_file()]
(RELEASE/'code_manifest.json').write_text(json.dumps(files,indent=2),encoding='utf-8')
nb=nbformat.v4.new_notebook()
nb.metadata.kernelspec={'display_name':'Python 3','language':'python','name':'python3'}
nb.cells=[nbformat.v4.new_markdown_cell('# Chapter 3: Spatial and Temporal Crop Profitability\n\nSame verified models and data as Chapter 4. Primary metric: grain revenue minus total economic costs. Experimental 2021 remains separate. No independent profitability validation is claimed.'),
nbformat.v4.new_code_cell("from pathlib import Path\nimport sys, os, json, hashlib\nimport google.colab\nROOT=Path('/content/drive/MyDrive/PHD/CSP3_GPP_outputs')\nRELEASE=ROOT/'CH3_profitability/20261007_profitability_v1'\nCODE=RELEASE/'code'\nfor row in json.loads((RELEASE/'code_manifest.json').read_text()):\n    assert hashlib.sha256((CODE/row['file']).read_bytes()).hexdigest()==row['sha256'],row['file']\nos.environ['CH4_BUDGET_POLICY']='closest_rotation'\nsys.path.insert(0,str(CODE))\nprint('Verified staged code:',len(json.loads((RELEASE/'code_manifest.json').read_text())))"),
nbformat.v4.new_code_cell("import subprocess\nsubprocess.run([sys.executable,'-m','pip','install','-q','-r',str(CODE/'requirements.txt')],check=True)"),
nbformat.v4.new_code_cell("import unittest\nsuite=unittest.defaultTestLoader.discover(str(CODE/'ch3_profitability/tests'))\nassert unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful()"),
nbformat.v4.new_code_cell("from ch3_profitability.pipeline import run\nOUTPUT=run(ROOT)\nprint('Chapter 3 numerical outputs complete:',OUTPUT)"),
nbformat.v4.new_code_cell("import pandas as pd\nfrom IPython.display import display\ndisplay(pd.read_csv(OUTPUT/'tables/annual_profitability.csv').query('source == \"UNL\" and scenario == \"M1_fixed\"')[['year','profit_mean_usd_ac_2021dollars','profitable_percent','breakeven_percent','loss_percent','valid_ha','experimental']])")]
nbformat.write(nb,REPO/'CH3_Profitability.ipynb')
nbformat.write(nb,RELEASE/'CH3_Profitability.ipynb')
print('Staged',len(files),'files; notebook ready:',RELEASE)

if __name__=='__main__': pass
