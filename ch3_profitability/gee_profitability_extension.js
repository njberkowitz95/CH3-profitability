// Positive-profit evidence is derived independently of the loss indicator.
CH3_DATA.run_id=CH3_EXTRA.run_id;
CH3_DATA.input_manifest_sha256=CH3_EXTRA.manifest_sha256;
['transitions','common'].forEach(function(k){if(CH3_EXTRA[k+'_columns']){
  CH3_EXTRA[k]=CH3_EXTRA[k].map(function(r){var d={};CH3_EXTRA[k+'_columns'].forEach(function(c,i){d[c]=r[i];});return d;});
}});
var ch3Profits=CH3_EXTRA.rows.map(function(r){var d={};CH3_EXTRA.columns.forEach(function(k,i){d[k]=r[i];});return d;});
var ch3BaseRefresh=ch3Refresh;
ch3Refresh=function(){
  ch3BaseRefresh();var a=ch3Active;if(!a)return;
  var r=a.row?ch3Profits.filter(function(x){return ch3Match(x,a);})[0]:null;
  if(r){
    ch3Cards.widgets().insert(1,ch3Card('Profitable crop area',ch3Num(r.profitable_ha)+' ha',ch3Num(r.profitable_percent)+'% of source-valid area; profit > $0'));
    ch3Cards.widgets().insert(2,ch3Card('Breakeven area',ch3Num(r.breakeven_ha)+' ha','Exactly zero unrounded return; not counted as positive profit'));
  }
  if(a.layer==='frequency'||a.layer==='observations'){
    if(ch3Layer){map.layers().remove(ch3Layer);ch3Layer=null;}ch3Legend.clear();
    var suffix=a.scenario.slice(0,2).toLowerCase()+'_'+{UNL:'u',ERS_Heartland:'e',FINBIN_state:'s',FINBIN_county:'c'}[a.source]+'_'+(a.policy==='exact'?'exact':'closest');
    var band=suffix+(a.layer==='frequency'?'_frequency':'_count');
    var image=ee.Image(CH3_EXTRA.asset_prefix+'_temporal').select(band);
    ch3Layer=ui.Map.Layer(image,{min:0,max:a.layer==='frequency'?1:7,palette:['f7fbff','6baed6','08306b']},'CH3 primary seasons · '+a.source+' · '+a.policy+' · '+a.layer,true);map.layers().add(ch3Layer);
    ch3Legend.add(ch3Text('Baseline prices and costs · primary years only; 2021 excluded. Frequency is a fraction of observed eligible seasons, not a predictive probability.'));
    ch3Legend.add(ch3Text(a.layer==='frequency'?'0% ---------------- 100% profitable seasons':'0 ---------------- 7 observed eligible seasons'));
    ch3Status.setValue(ch3Status.getValue()+'\nTemporal layer: baseline, source-specific available years; independent of selected annual year and sensitivity.');
  }
};
var ch3BaseCharts=ch3Charts;
ch3Charts=function(){
  ch3BaseCharts();var a=ch3Active;if(!a||!a.row)return;
  var r=ch3Profits.filter(function(x){return ch3Match(x,a);})[0];if(!r)return;
  ch3Evidence.widgets().insert(3,ch3Chart('Profitable, breakeven and loss area',['Return class','Area (ha)'],[['Profitable',r.profitable_ha],['Breakeven',r.breakeven_ha],['Loss',r.loss_ha]],'ColumnChart',{vAxis:{title:'Source-valid crop area (ha)'},colors:['#2166ac']}));
  ch3Evidence.add(ch3Table('Profit distribution detail',[['Profit standard deviation ($/acre)',ch3Money(r.profit_sd_usd_ac*a.factor)],['Positive-profit share (%)',ch3Num(r.profitable_percent)],['Breakeven (ha)',ch3Num(r.breakeven_ha)]]));
  var common=CH3_EXTRA.common.filter(function(x){return x.source===a.source&&x.scenario===a.scenario&&x.policy===a.policy;});
  ch3Evidence.add(ch3Chart('Primary common-valid-area profitability · baseline',['Year','Mean profit ($/acre)'],common.map(function(x){return [String(x.year),a.basis==='2021'?x.mean_profit_2021usd_ac:x.mean_profit_usd_ac];}),'ColumnChart',{vAxis:{title:'$/acre · '+a.basis+' basis'}}));
  ch3Evidence.add(ch3Text('Common-valid area is the intersection over available source years. Unavailable years are gaps. Experimental 2021 is excluded. Strict policy has only 2019 among primary years and does not establish persistence over multiple seasons.'));
  var t=CH3_EXTRA.transitions.filter(function(x){return x.source===a.source&&x.scenario===a.scenario&&x.policy===a.policy;});
  ch3Evidence.add(ch3Table('Biennial transitions · baseline · common pair support',t.map(function(x){return [x.from_year+'–'+x.to_year+' '+x.from_label+' → '+x.to_label,ch3Num(x.transition_ha)+' ha / '+ch3Num(x.pair_common_ha)+' ha'];})));
  var generation=ch3Generation;
  ee.FeatureCollection(CH3_EXTRA.asset_prefix+'_evidence').filter(ee.Filter.eq('year',a.year)).aggregate_array('payload').evaluate(function(parts,error){
    if(generation!==ch3Generation||viewSelect.getValue()!=='ch3_view'||ch3Section.getValue()!=='Charts & tables')return;
    if(error){ch3Evidence.add(ch3Text('CH3 evidence unavailable: '+error));return;}
    var rows=[],assoc=[];parts.forEach(function(p){var d=JSON.parse(p);if(d.table==='county')rows=rows.concat(d.rows);if(d.table==='associations')assoc=assoc.concat(d.rows);});
    rows=rows.filter(function(x){return ch3Match(x,a)&&x.valid_ha>0;});
    ch3Evidence.add(ch3Chart('County profitable-area share',['County','Profitable (%)'],rows.map(function(x){return [x.NAME,x.profitable_percent];}),'BarChart',{hAxis:{title:'Percent of source-valid county crop area',viewWindow:{min:0,max:100}},height:440}));
    assoc=assoc.filter(function(x){return x.scenario===a.scenario&&x.source===a.source&&x.block_m===10000;});
    ch3Evidence.add(ch3Table('CH3 baseline NCCPI associations · 10 km blocks',assoc.map(function(x){return [x.metric,'r='+ch3Num(x.r,3)+' · 95% interval '+ch3Num(x.ci_low,3)+' to '+ch3Num(x.ci_high,3)];})));
  });
};
function ch3LoadProfitPatchEvidence(id,a,generation,request){
  var feature=ee.FeatureCollection(CH3_EXTRA.asset_prefix+'_patch_evidence').filter(ee.Filter.eq('year',a.year)).filter(ee.Filter.eq('patch_id',id)).first();
  feature.toDictionary().evaluate(function(v,error){
    if(generation!==ch3Generation||request!==ch3Request||viewSelect.getValue()!=='ch3_view')return;
    if(error||!v||!a.row)return;
    var key=a.scenario.slice(0,2).toLowerCase()+'_'+{UNL:'u',ERS_Heartland:'e',FINBIN_state:'s',FINBIN_county:'c'}[a.source]+'_'+Math.round(a.pf*100)+'_'+Math.round(a.cf*100);
    ch3Patch.add(ch3Table('Chapter 3 profit classes',[['Profitable area (ha)',ch3Num(v[key+'_profit'])],['Breakeven area (ha)',ch3Num(v[key+'_zero'])],['Loss area (ha)',ch3Num(v[key+'_loss'])]]));
    var prefix=a.scenario.slice(0,2).toLowerCase()+'_'+{UNL:'u',ERS_Heartland:'e',FINBIN_state:'s',FINBIN_county:'c'}[a.source];
    var matrix=[];ch3FactorNames.forEach(function(p){ch3FactorNames.forEach(function(c){
      var k=prefix+'_'+Math.round(ch3Factors[p]*100)+'_'+Math.round(ch3Factors[c]*100);
      var positive=v[k+'_profit'],zero=v[k+'_zero'],negative=v[k+'_loss'];
      var total=positive===undefined||positive===null?null:positive+zero+negative;
      matrix.push(['Price '+p+' / cost '+c,total>0?ch3Num(100*positive/total)+'% profitable · '+ch3Num(positive)+' ha':'Unavailable']);
    });});ch3Patch.add(ch3Table('Patch profitability sensitivity · nine combinations',matrix));
  });
};
var ch3BaseMethods=ch3Methods;
ch3Methods=function(){ch3BaseMethods();ch3Evidence.add(ch3Text('CH3 uses the same monetary engine as CH4 and explicitly distinguishes positive profit, exact breakeven, loss and missing observations. Temporal frequencies use baseline conditions; 2021 is excluded. Source-specific accounts remain separate. Pixel identity namespace CH4G5070V1 is retained for cross-chapter joins on the unchanged grid.'));};
// Existing controls captured earlier callbacks; route all changes through the extension.
[ch3Policy,ch3Scenario,ch3Source,ch3Definition,ch3Currency,ch3Price,ch3Cost].forEach(function(control){control.onChange(ch3Refresh);});
ch3Year.onChange(function(){ch3ClearPatch();ch3Refresh();});
