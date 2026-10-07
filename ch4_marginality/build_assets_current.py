"""Pack and pixel-check the current core-filter yield bands for Earth Engine."""
from pathlib import Path
import json
import traceback
from .prepare_app_asset import build


if __name__ == '__main__':
    root=Path('G:/My Drive/PHD/CSP3_GPP_outputs')
    out=root/'CH4_marginality/20260928_corefilter_exact_year_v2'
    destination=out/'app_assets/ch4_verified_yields_corefilter_20260928.tif'
    try:
        build(root,destination)
        (out/'app_assets/build_status.json').write_text(json.dumps({'status':'verified','asset':str(destination)}),encoding='utf8')
    except Exception:
        (out/'app_assets/build_status.json').write_text(json.dumps({'status':'failed','traceback':traceback.format_exc()},indent=2),encoding='utf8')
        raise
