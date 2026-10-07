"""Rebuild the versioned CH4 analysis from the audited current Drive products."""
from pathlib import Path
import json
import traceback
from .pipeline import run


if __name__ == '__main__':
    root=Path('G:/My Drive/PHD/CSP3_GPP_outputs')
    out=root/'CH4_marginality/20260928_corefilter_exact_year_v2'
    try:
        print(run(root), flush=True)
    except Exception:
        (out/'logs').mkdir(parents=True,exist_ok=True)
        error=traceback.format_exc()
        (out/'logs/task_failure.log').write_text(error,encoding='utf8')
        (out/'status.json').write_text(json.dumps({'status':'failed','traceback':error},indent=2),encoding='utf8')
        raise
