"""Append an isolated CH3 workspace while preserving the published CH4 script."""
from pathlib import Path
import copy
import json
import pandas as pd
from ch4_marginality.pipeline import sha,dump
from ch4_marginality.final_checks import records
from .pipeline import RUN_ID,SOURCE_RELEASE

ASSET_PREFIX='projects/ee-njberkowitz95/assets/ch3_profit_20261007'


def controller_source(repo: Path | None = None) -> str:
    """Compile the isolated controller for both contract tests and publication."""
    repo=Path(repo) if repo else Path(__file__).resolve().parents[1]
    source=(repo/'ch4_marginality/gee_profit_controls.js').read_text(encoding='utf-8')
    source=source.replace('CH4','CH3').replace('ch4','ch3').replace('CHAPTER 4','CHAPTER 3')
    source=source.replace('CH3 Economics','CH3 Profitability').replace('CH3 ECONOMICS','CH3 PROFITABILITY')
    source=source.replace('Dryland corn economics','Dryland corn profitability')
    source=source.replace('Economic scenarios and two marginality definitions on verified 30 m yields.','Spatial and temporal modeled profitability on verified 30 m yields.')
    # Restore headers before delegating view changes; nested chapter workspaces
    # must not overwrite each other's headings on direct CH3 <-> CH4 switches.
    old="  ch3OldSwitch(v);ch3Generation++;ch3Request++;"
    new="""  if(v!=='ch3_view'&&ch3SavedHeader){
    ch3SavedLayers.forEach(function(r){r[0].setShown(r[1]);});ch3SavedLayers=[];
    eyebrow.setValue(ch3SavedHeader[0]);appTitle.setValue(ch3SavedHeader[1]);appDesc.setValue(ch3SavedHeader[2]);mapChip.setValue(ch3SavedHeader[3]);ch3SavedHeader=null;
  }
  ch3OldSwitch(v);ch3Generation++;ch3Request++;"""
    if old not in source: raise ValueError('Workspace switch interface changed')
    source=source.replace(old,new)
    source=source.replace("map.style().set('shown',true);legend.style().set('shown',!active);", "if(active){map.style().set('shown',true);legend.style().set('shown',false);}")
    source=source.replace("'Total economic return / operator proxy'","'Total economic profit / operator proxy'")
    source=source.replace("'Mean total economic return'", "'Mean total economic profit'")
    source=source.replace("ch3Num(100*r.loss_ha/r.valid_ha)+'% loss'", "ch3PositiveShare(target)+'% profitable'")
    source=source.replace("{label:'Negative total return',value:'loss'}", "{label:'Profitable / breakeven / loss',value:'profit_class'},{label:'Profitable-season frequency (baseline)',value:'frequency'},{label:'Observed eligible seasons (baseline)',value:'observations'},{label:'Negative total return',value:'loss'}")
    source=source.replace("else if(a.layer==='loss'){result=loss;", "else if(a.layer==='profit_class'){result=ret.gt(0).subtract(ret.lt(0));vis={min:-1,max:1,palette:['b35806','999999','2166ac']};}\n      else if(a.layer==='loss'){result=loss;")
    source=source.replace("var labels=a.layer==='overlap'?", "var labels=a.layer==='profit_class'?['Loss (<0)','Breakeven (=0)','Profitable (>0)']:a.layer==='overlap'?")
    source=source.replace("{label:'Profitable / breakeven / loss',value:'profit_class'}", "{label:'Profitability × yield quartile',value:'profit_quartile'},{label:'Profitable / breakeven / loss',value:'profit_class'}")
    source=source.replace("else if(a.layer==='profit_class')", "else if(a.layer==='profit_quartile'){result=ret.gt(0).subtract(ret.lt(0)).add(1).multiply(2).add(q);vis={min:0,max:5,palette:['b35806','e69f00','777777','bbbbbb','2166ac','67a9cf']};}\n      else if(a.layer==='profit_class')")
    source=source.replace("var labels=a.layer==='profit_class'?", "var labels=a.layer==='profit_quartile'?['Loss / nonquartile','Loss / quartile','Breakeven / nonquartile','Breakeven / quartile','Profit / nonquartile','Profit / quartile']:a.layer==='profit_class'?")
    source=source.replace("'Economic marginality means total/source-account return < 0.","'Profitability uses unrounded total/source-account returns >0, exactly 0, and <0. Economic marginality means total/source-account return < 0.")
    source=source.replace('https://github.com/njberkowitz95/Yields-and-Fields-CH1/tree/codex/ch3-marginality/ch3_marginality','https://github.com/njberkowitz95/CH3-profitability')
    source=source.replace('PHD/CSP3_GPP_outputs/CH3_marginality/','PHD/CSP3_GPP_outputs/CH3_profitability/')
    source=source.replace('ch3SelectedId=id;', 'ch3LoadProfitPatchEvidence(id,a,generation,request);ch3SelectedId=id;')
    return source


def build(out: Path, require_assets: bool = True) -> Path:
    """Compile only verified results; unverified previews cannot be deployed."""
    out=Path(out);repo=Path(__file__).resolve().parents[1]
    if not json.loads((out/'validation.json').read_text(encoding='utf-8'))['verified']:
        raise ValueError('Numerical verification required')
    if not json.loads((out/'verification/release_audit.json').read_text(encoding='utf-8'))['verified']:
        raise ValueError('Independent patch, county, and regional reconciliation required')
    if require_assets and not json.loads((out/'asset_verification.json').read_text(encoding='utf-8'))['verified']:
        raise ValueError('Earth Engine verification required')
    prior=out.parents[1]/'CH4_marginality'/SOURCE_RELEASE
    original=(prior/'gee_app_Yield_PEM_profit.js').read_bytes()
    rollback=out/'rollback';rollback.mkdir(exist_ok=True)
    (rollback/'Yield_PEM_before_CH3.js').write_bytes(original)
    source=controller_source(repo)
    frame=pd.read_csv(out/'tables/aoi_sensitivity.csv',float_precision='round_trip')
    columns=['year','scenario','source','price_factor','cost_factor','profitable_ha','breakeven_ha','loss_ha','valid_ha','profitable_percent','profit_sd_usd_ac']
    extra=dict(columns=columns,rows=frame[columns].where(pd.notna(frame[columns]),None).values.tolist(),
               run_id=RUN_ID,manifest_sha256=sha(out/'input_manifest.json'),asset_prefix=ASSET_PREFIX,
               transitions=[],common=[])
    for name,file in [('transitions','profit_transitions'),('common','common_valid_profit')]:
        table=pd.read_csv(out/'tables'/f'{file}.csv')
        extra[name+'_columns']=list(table.columns)
        extra[name]=[[row[k] for k in table.columns] for row in records(table)]
    setup="""
// CH3 owns a deep copy. CH4 state, data and controls remain unchanged.
var CH3_DATA=JSON.parse(JSON.stringify(CH4_DATA));
['counties','sensitivity','distributions','associations'].forEach(function(k){delete CH3_DATA[k+'_columns'];});
delete CH3_DATA.county_columns;
"""
    text=original.decode('utf-8')+'\n'+setup+'\nvar CH3_EXTRA='+json.dumps(extra,separators=(',',':'),allow_nan=False)+';\n'+source
    text+='\n'+(Path(__file__).parent/'gee_profitability_extension.js').read_text(encoding='utf-8')
    data=text.encode('utf-8')
    if len(data)>=512*1024: raise ValueError(f'App exceeds 512 KiB: {len(data)}')
    output_name='gee_app_Yield_PEM_CH3.js' if require_assets else 'gee_app_Yield_PEM_CH3_PREVIEW.js'
    (out/output_name).write_bytes(data)
    dest=repo/('gee/gee_app_Yield_PEM.js' if require_assets else 'gee/gee_app_Yield_PEM_PREVIEW.js');dest.parent.mkdir(exist_ok=True);dest.write_bytes(data)
    record_name='app_build_verification.json' if require_assets else 'app_preview_verification.json'
    dump(out/record_name,dict(script_sha256=sha(dest),rollback_sha256=sha(rollback/'Yield_PEM_before_CH3.js'),
         bytes=len(data),assets_verified=require_assets,published=False))
    return dest
