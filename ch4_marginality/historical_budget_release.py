"""Publish a source-only audit after proving numerical eligibility/inputs unchanged."""
from __future__ import annotations

import json
from pathlib import Path
import shutil

import pandas as pd

from .budget_registry import load_registry, eligible_years
from .prepare_budgets import build, HERE
from .pipeline import dump, sha
from .profit_workspace import RUN_ID as NUMERICAL_RUN, BASE_ID, lock_inputs
from .build_profit_app import compile_source

AUDIT_ID = '20260929_historical_budget_audit_v1'


def verify_freshness(root: Path, out: Path) -> dict:
    """Recheck the parent numerical inventory and every audited original source."""
    parent=root/'CH4_marginality'/NUMERICAL_RUN
    previous=json.loads((parent/'input_manifest.json').read_text(encoding='utf-8'))
    checked=lock_inputs(root,root/'CH4_marginality'/BASE_ID,out,previous)
    expected=json.loads((out/'source_manifest.json').read_text(encoding='utf-8'))
    for item in expected['files']:
        if sha(out/item['path']) != item['sha256']:
            raise ValueError(f'Audit source changed during preparation: {item["path"]}')
    load_registry(out/'sources')
    return dict(verified=True,numerical_files=len(checked['files']),
                numerical_manifest_sha256=sha(parent/'input_manifest.json'),
                source_manifest_sha256=sha(out/'source_manifest.json'))


def run(root: str | Path) -> Path:
    """Build the new audit release without modifying the executed numerical release."""
    root=Path(root);out=root/'CH4_marginality'/AUDIT_ID
    parent=root/'CH4_marginality'/NUMERICAL_RUN
    out.mkdir(parents=True,exist_ok=True)
    for name in ['sources','tables','verification','code']: (out/name).mkdir(exist_ok=True)
    for name in ['validation.json','asset_verification.json','profit_pixel_verification.json']:
        if not json.loads((parent/name).read_text(encoding='utf-8'))['verified']:
            raise ValueError(f'Parent numerical evidence is unverified: {name}')
    costs,eligibility=build(out/'tables')
    old=pd.read_csv(parent/'tables/economic_scenarios.csv',float_precision='round_trip')
    pd.testing.assert_frame_equal(costs.reset_index(drop=True),old.reset_index(drop=True),check_dtype=False)
    old_elig=json.loads((parent/'app_data_profit.json').read_text(encoding='utf-8'))['eligibility']
    if eligible_years(load_registry()) != {r['year'] for r in old_elig if r['eligible']}:
        raise ValueError('Eligibility changed: execute affected economics in Colab before publication')
    shutil.copytree(HERE/'sources',out/'sources',dirs_exist_ok=True)
    shutil.copytree(HERE/'preflight/historical_budget_review',out/'verification/review_pages',dirs_exist_ok=True)
    shutil.copy2(HERE/'preflight/historical_archive_responses.json',out/'verification/archive_responses.json')
    shutil.copy2(HERE/'HISTORICAL_BUDGET_AUDIT.md',out/'HISTORICAL_BUDGET_AUDIT.md')
    rows=load_registry()
    candidates=[dict(year=r['year'],file=r['file'],source_url=r['source_url'],sha256=r['sha256'],**c)
                for r in rows for c in r['candidates']]
    pd.DataFrame(candidates).to_csv(out/'tables/unl_budget_candidates.csv',index=False)
    pd.DataFrame([{k:v for k,v in r.items() if k!='candidates'} for r in rows]).to_csv(out/'tables/source_audit.csv',index=False)
    files=[]
    for folder in ['sources','tables','verification/review_pages']:
        for p in sorted((out/folder).rglob('*')):
            if p.is_file():files.append(dict(path=p.relative_to(out).as_posix(),sha256=sha(p),size_bytes=p.stat().st_size))
    dump(out/'source_manifest.json',dict(run_id=AUDIT_ID,review_date='2026-09-29',files=files))
    verified=verify_freshness(root,out)
    data=json.loads((parent/'app_data_profit.json').read_text(encoding='utf-8'))
    data['eligibility']=[{k:v for k,v in r.items() if k!='candidates'} for r in rows]
    data['source_audit']=dict(run_id=AUDIT_ID,review_date='2026-09-29',
        registry_sha256=sha(out/'sources/unl_budget_registry.json'),
        report_url='https://github.com/njberkowitz95/Yields-and-Fields-CH1/blob/codex/ch4-marginality/ch4_marginality/HISTORICAL_BUDGET_AUDIT.md')
    dump(out/'app_data_profit_source_audit.json',data)
    destination=HERE.parent/'csp3_maize_gpp/gee_app_Yield_PEM.js'
    rollback=out/'Yield_PEM_rollback_before_historical_audit.js'
    if not rollback.exists():shutil.copy2(destination,rollback)
    encoded=compile_source(data)
    destination.write_bytes(encoded);(out/'gee_app_Yield_PEM_source_audit.js').write_bytes(encoded)
    for p in HERE.glob('*.py'):shutil.copy2(p,out/'code'/p.name)
    for name in ['gee_profit_controls.js','requirements.txt','HISTORICAL_BUDGET_AUDIT.md']:
        shutil.copy2(HERE/name,out/'code'/name)
    for target in [HERE/'tables/year_eligibility.csv',HERE/'outputs/tables/year_eligibility.csv']:
        shutil.copy2(out/'tables/year_eligibility.csv',target)
    dump(out/'numerical_results_reference.json',dict(run_id=NUMERICAL_RUN,
        drive_folder='https://drive.google.com/drive/folders/1fMyxJVeqOCmEXTuZ98VttYpmo7m5_pES',
        output_manifest_sha256=sha(parent/'output_manifest.json'),
        input_manifest_sha256=sha(parent/'input_manifest.json'),
        colab='https://colab.research.google.com/drive/10pKscDzqeBuTmwKGzbSK74UqWHOKD1Y5',
        numerical_rerun=False,reason='Economic eligibility and all numerical inputs unchanged'))
    dump(out/'verification.json',dict(**verified,economic_inputs_identical=True,
        newly_eligible_years=[],eligible_years=sorted(eligible_years(rows)),
        blocked_years=eligibility.loc[~eligibility.eligible,'year'].tolist(),
        reviewed_historical_dryland_budgets=len(candidates),
        candidate_app_sha256=sha(destination),rollback_sha256=sha(rollback),
        publication_status='candidate_not_yet_deployed'))
    print(out,flush=True)
    return out


if __name__=='__main__':
    import sys
    run(sys.argv[1] if len(sys.argv)>1 else 'G:/My Drive/PHD/CSP3_GPP_outputs')
