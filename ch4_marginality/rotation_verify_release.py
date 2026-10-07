"""Execute and preserve independent Colab verification after asset submission."""
from pathlib import Path
import json
import nbformat
from nbclient import NotebookClient

def run(root):
    root=Path(root);release=root/'CH4_marginality/20260929_rotation_priority_budget_v1'
    nb=nbformat.v4.new_notebook()
    nb.metadata.kernelspec=dict(display_name='Python 3',language='python',name='python3')
    nb.cells=[nbformat.v4.new_markdown_cell('# CH4 rotation-priority asset and candidate verification\nIndependent execution on the authorized Colab machine. Candidate compilation does not publish the live app.'),
      nbformat.v4.new_code_cell(f'''from pathlib import Path
import os,sys,json,time
ROOT=Path({str(root)!r})
RELEASE=ROOT/'CH4_marginality/20260929_rotation_priority_budget_v1'
os.environ['CH4_BUDGET_POLICY']='closest_rotation'
sys.path.insert(0,str(RELEASE/'code'))
import ee
ee.Initialize(project='ee-njberkowitz95')
print('Verification runtime:',ROOT)'''),
      nbformat.v4.new_code_cell('''tasks=json.loads((RELEASE/'asset_tasks.json').read_text())
task_ids=[r['task'] for r in tasks if r.get('task')]
task_ids.append(json.loads((RELEASE/'evidence_asset_task.json').read_text())['response']['id'])
deadline=time.monotonic()+7200
while True:
    states=ee.data.getTaskStatus(task_ids)
    (RELEASE/'verification/ingestion_progress.json').write_text(json.dumps(states,indent=2))
    failed=[r for r in states if r['state'] in ['FAILED','CANCELLED']]
    assert not failed,failed
    print('Asset task states:',{s:sum(r['state']==s for r in states) for s in {r['state'] for r in states}},flush=True)
    if all(r['state']=='COMPLETED' for r in states):break
    assert time.monotonic()<deadline,'Asset verification timed out; publication remains blocked'
    time.sleep(30)
from ch4_marginality.profit_assets import verify as verify_patches
verify_patches(ROOT)
from ch4_marginality.rotation_evidence_assets import verify as verify_evidence
verify_evidence(ROOT)'''),
      nbformat.v4.new_code_cell('''import pandas as pd
from ch4_marginality.final_checks import records
payload=json.loads((RELEASE/'app_data_profit.json').read_text())
payload['annual']=records(pd.read_csv(RELEASE/'analysis/tables/annual_yield.csv',float_precision='round_trip'))
(RELEASE/'app_data_profit.json').write_text(json.dumps(payload,allow_nan=False))
from ch4_marginality.verify_profit_pixels import run as verify_pixels
verify_pixels(ROOT)
from ch4_marginality.finalize_profit import run as build_candidate
candidate=build_candidate(ROOT)
print('Verified candidate:',candidate)
print('Live deployment remains a separate tested browser action.')''')]
    source=release/'CH4_Rotation_Verification.ipynb';executed=release/'CH4_Rotation_Verification_executed.ipynb'
    nbformat.write(nb,source)
    def save(**kwargs):nbformat.write(nb,executed)
    try:
        NotebookClient(nb,timeout=10800,kernel_name='python3',resources={'metadata':{'path':'/content'}},on_cell_complete=save).execute()
    finally:save()
    print('Completed independent verification notebook:',executed,flush=True)
    return executed
