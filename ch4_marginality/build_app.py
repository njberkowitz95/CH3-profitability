"""Compile the additive app only after reconciling Colab and preview results."""
from pathlib import Path
import json,hashlib
import numpy as np
import pandas as pd

def compile_app(out,preview=False):
    out=Path(out);package=Path(__file__).resolve().parent
    data=json.loads((out/('app_data_candidate.json' if preview else 'app_data.json')).read_text())
    if not preview:
        assert json.loads((out/'validation.json').read_text())['verified']
        classes=json.loads((out/'ee_classification_verification.json').read_text())
        assert len(classes)==5 and all(r['exact_classification_match'] for r in classes)
        candidate=json.loads((out/'app_data_candidate.json').read_text())
        for table,keys in [('annual',['year','scenario']),('sensitivity',['year','scenario','source','price_factor','cost_factor'])]:
            c=pd.DataFrame(candidate[table]).set_index(keys).sort_index();d=pd.DataFrame(data[table]).set_index(keys).sort_index()
            for col in c:
                if pd.api.types.is_numeric_dtype(c[col]):
                    np.testing.assert_allclose(c[col],d[col],rtol=0,atol=1e-7)
            if table=='annual':assert (c.cutoff_Mg_ha==d.cutoff_Mg_ha).all(),'Quartile threshold round-trip changed'
    source=(package/'rollback/gee_app_Yield_PEM_pre_CH4.js').read_text(encoding='utf8')
    source+='\nvar CH4_DATA = '+json.dumps(data,allow_nan=False)+';\n'+(package/'gee_controls.js').read_text(encoding='utf8')
    dest=package/'gee_app_candidate.js' if preview else package.parent/'csp3_maize_gpp/gee_app_Yield_PEM.js'
    dest.write_text(source,encoding='utf8')
    if not preview:
        (out/'gee_app_Yield_PEM_CH4.js').write_text(source,encoding='utf8')
        (out/'app_build_verification.json').write_text(json.dumps({'preview_matches_colab':True,'native_classifications_verified':True,'script_sha256':hashlib.sha256(source.encode()).hexdigest()},indent=2))
    print(dest)
    return dest

if __name__=='__main__':
    import sys
    compile_app(sys.argv[1],preview='--preview' in sys.argv)
