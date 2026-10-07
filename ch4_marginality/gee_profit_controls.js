// CH4 Economics: maps and evidence use one locked, verified inventory.
// Compact transport arrays retain full numeric precision and hydrate once.
['counties','sensitivity','distributions','associations'].forEach(function(key){
  var columns=CH4_DATA[key+'_columns']||(key==='counties'?CH4_DATA.county_columns:null);
  if(columns){CH4_DATA[key]=CH4_DATA[key].map(function(r){var d={};columns.forEach(function(k,i){d[k]=r[i];});return d;});}
});
// Historical evidence is fetched by year; JSON properties preserve decimal precision.
var ch4EvidenceLoaded=CH4_DATA.evidence_asset?{}:{2019:true},ch4EvidencePending={};
function ch4EnsureEvidence(year){
  if(!CH4_DATA.evidence_asset||ch4EvidenceLoaded[year]||ch4EvidencePending[year])return;
  ch4EvidencePending[year]=true;
  ee.FeatureCollection(CH4_DATA.evidence_asset).filter(ee.Filter.eq('year',year)).aggregate_array('payload').evaluate(function(parts,error){
    ch4EvidencePending[year]=false;
    if(error){if(ch4Active&&ch4Active.year===year)ch4Status.setValue('Evidence loading failed: '+error);return;}
    var grouped={};
    try{parts.forEach(function(value){var part=JSON.parse(value);if(!grouped[part.table])grouped[part.table]=[];grouped[part.table]=grouped[part.table].concat(part.rows);});
      ['counties','distributions','associations'].forEach(function(key){CH4_DATA[key]=CH4_DATA[key].filter(function(r){return r.year!==year;}).concat(grouped[key]||[]);});
      ch4EvidenceLoaded[year]=true;
    }catch(e){if(ch4Active&&ch4Active.year===year)ch4Status.setValue('Evidence decoding failed: '+e);return;}
    if(ch4Active&&ch4Active.year===year&&viewSelect.getValue()==='ch4_view'&&ch4Section.getValue()==='Charts & tables')ch4Charts();
  });
}
var ch4Panel=ui.Panel({style:{shown:false,margin:'0'}});
var ch4Evidence=ui.Panel({style:{shown:false,stretch:'both',padding:'24px',backgroundColor:THEME.pale}});
panel.add(ch4Panel);ui.root.add(ch4Evidence);navBar.setLayout(ui.Panel.Layout.flow('horizontal',true));
viewSelect.items().add({label:'CH4 Economics',value:'ch4_view'});
var ch4NavButton=ui.Button({label:'CH4 Economics',onClick:function(){var v=viewSelect.getValue()==='ch4_view'?'map_view':'ch4_view';viewSelect.setValue(v,false);switchView(v);},style:{fontSize:'12px',margin:'4px 6px 0 0'}});navBar.add(ch4NavButton);
var ch4OldSwitch=switchView,ch4SavedLayers=[],ch4SavedHeader=null,ch4Layer=null,ch4Outline=null;
var ch4Generation=0,ch4Request=0,ch4SelectedId=null,ch4Active=null;
switchView=function(v){
  ch4OldSwitch(v);ch4Generation++;ch4Request++;
  var active=v==='ch4_view';
  if(active&&!ch4SavedHeader){
    ch4SavedHeader=[eyebrow.getValue(),appTitle.getValue(),appDesc.getValue(),mapChip.getValue()];
    map.layers().forEach(function(l){if(l!==ch4Layer&&l!==ch4Outline){ch4SavedLayers.push([l,l.getShown()]);l.setShown(false);}});
    eyebrow.setValue('DISSERTATION CHAPTER 4 · MLRA 106');appTitle.setValue('Dryland corn economics');appDesc.setValue('Economic scenarios and two marginality definitions on verified 30 m yields.');
  }else if(!active&&ch4SavedHeader){
    ch4SavedLayers.forEach(function(r){r[0].setShown(r[1]);});ch4SavedLayers=[];
    eyebrow.setValue(ch4SavedHeader[0]);appTitle.setValue(ch4SavedHeader[1]);appDesc.setValue(ch4SavedHeader[2]);mapChip.setValue(ch4SavedHeader[3]);ch4SavedHeader=null;
  }
  ch4Panel.style().set('shown',active);ch4Evidence.style().set('shown',false);map.style().set('shown',true);legend.style().set('shown',!active);
  ch4NavButton.setLabel(active?'Return to yield workspace':'CH4 Economics');if(ch4Layer)ch4Layer.setShown(active);if(ch4Outline)ch4Outline.setShown(active);if(active)ch4Refresh();
};
function ch4Text(t,size){return ui.Label(t,{fontSize:size||'12px',color:THEME.body,whiteSpace:'pre-wrap',margin:'4px 0 8px 0'});}
function ch4Num(v,n){return v===null||v===undefined||!isFinite(v)?'Unavailable':Number(v).toLocaleString('en-US',{minimumFractionDigits:n===undefined?2:n,maximumFractionDigits:n===undefined?2:n});}
function ch4Money(v){return v===null||v===undefined||!isFinite(v)?'Unavailable':'$'+ch4Num(v);}
function ch4Match(r,a){return r.year===a.year&&r.scenario===a.scenario&&r.source===a.source&&r.price_factor===a.pf&&r.cost_factor===a.cf;}
var ch4Factors={'−15%':.85,'Baseline':1,'+15%':1.15},ch4FactorNames=['−15%','Baseline','+15%'];
ch4Panel.add(kicker('CH4 ECONOMICS · VERIFIED INPUTS'));
var ch4Section=ui.Select({items:['Map','Charts & tables','Methods & sources'],value:'Map',onChange:ch4ShowSection,style:{stretch:'horizontal',margin:'4px 0'}});ch4Panel.add(ch4Section);
var ch4Year=ui.Select({items:CH4_DATA.years.map(function(y){var e=CH4_DATA.eligibility.filter(function(r){return r.year===y;})[0];return {label:y+(y===2021?' · EXPERIMENTAL':e&&e.eligible?' · '+(e.match_designation||'exact')+' budget':' · yield only'),value:String(y)};}),value:'2019',onChange:function(){ch4ClearPatch();ch4Refresh();},style:{width:'100%'}});
var ch4Policy=ui.Select({items:[{label:'Closest rotation-matched budgets',value:'closest_rotation'},{label:'Exact matches only',value:'exact'}],value:CH4_DATA.budget_policy||'exact',onChange:ch4Refresh,style:{stretch:'horizontal'}});
var ch4Scenario=ui.Select({items:[{label:'M1 · fixed harvest index',value:'M1_fixed'},{label:'M2 · harvest-index sensitivity',value:'M2_HI_sensitivity'}],value:'M1_fixed',onChange:ch4Refresh,style:{width:'100%'}});
var ch4Source=ui.Select({items:[{label:'UNL · selected original-year budget',value:'UNL'},{label:'ERS · Heartland regional scenario',value:'ERS_Heartland'},{label:'FINBIN · four-county operator proxy',value:'FINBIN_county'},{label:'FINBIN · statewide operator proxy',value:'FINBIN_state'}],value:'UNL',onChange:ch4Refresh,style:{width:'100%'}});
var ch4Definition=ui.Select({items:[{label:'Total economic return / operator proxy',value:'return'},{label:'Cash margin / accounting cash proxy',value:'cash'},{label:'Revenue / operator-share revenue',value:'revenue'},{label:'Negative total return',value:'loss'},{label:'Lowest yield quartile',value:'quartile'},{label:'Overlap and disagreement',value:'overlap'}],value:'return',onChange:ch4Refresh,style:{width:'100%'}});
var ch4Currency=ui.Select({items:[{label:'Constant 2021 dollars',value:'2021'},{label:'Nominal crop-year dollars',value:'nominal'}],value:'2021',onChange:ch4Refresh,style:{width:'100%'}});
// Percentage widths plus default widget margins caused horizontal overflow.
[ch4Year,ch4Scenario,ch4Source,ch4Definition,ch4Currency].forEach(function(control){control.style().set({width:null,stretch:'horizontal',margin:'4px 0'});});
var ch4Price=ui.Select({items:ch4FactorNames,value:'Baseline',onChange:ch4Refresh,style:{stretch:'horizontal'}}),ch4Cost=ui.Select({items:ch4FactorNames,value:'Baseline',onChange:ch4Refresh,style:{stretch:'horizontal'}});
[['Budget matching policy',ch4Policy],['Production year',ch4Year],['Yield scenario',ch4Scenario],['Economic source',ch4Source],['Map layer',ch4Definition],['Dollar basis',ch4Currency]].forEach(function(x){ch4Panel.add(fieldLabel(x[0]));ch4Panel.add(x[1]);});
ch4Panel.add(ui.Panel([ui.Panel([fieldLabel('Price'),ch4Price],null,{stretch:'horizontal'}),ui.Panel([fieldLabel('Cost'),ch4Cost],null,{stretch:'horizontal'})],ui.Panel.Layout.flow('horizontal'),{stretch:'horizontal'}));
var ch4Status=ch4Text(''),ch4Cards=ui.Panel(),ch4Legend=ui.Panel(),ch4Patch=ui.Panel();ch4Panel.add(ch4Status);ch4Panel.add(ch4Cards);ch4Panel.add(ch4Legend);ch4Panel.add(ch4Patch);
ch4Panel.add(ch4Text('Mapped crop units have year-specific identifiers. They do not identify farms or imply persistent ownership.','11px'));
function ch4ClearPatch(){ch4SelectedId=null;ch4Request++;if(ch4Outline){map.layers().remove(ch4Outline);ch4Outline=null;}ch4Patch.clear();ch4Patch.add(ch4Text('Click a mapped crop pixel to inspect its annual patch.'));}
function ch4Card(label,value,detail){return ui.Panel([kicker(label,THEME.muted),ui.Label(value,{fontSize:'21px',fontWeight:'bold',color:THEME.ink,margin:'0'}),ch4Text(detail,'11px')],null,{backgroundColor:THEME.white,border:'1px solid '+THEME.line,padding:'10px',margin:'0 0 8px 0',stretch:'horizontal'});}
function ch4Heading(t){return ui.Label(t,{fontSize:'19px',fontWeight:'bold',color:THEME.ink,margin:'8px 0 12px 0'});}
function ch4Table(title,rows){var p=ui.Panel([ch4Heading(title)],null,{padding:'12px',backgroundColor:THEME.white,margin:'0 0 16px 0'});rows.forEach(function(r){p.add(ui.Panel([ui.Label(r[0],{fontSize:'12px',stretch:'horizontal',color:THEME.body}),ui.Label(r[1],{fontSize:'12px',fontWeight:'bold',color:THEME.ink})],ui.Panel.Layout.flow('horizontal')));});return p;}
function ch4BudgetContext(a){var e=a.budget;return e&&e.eligible?'UNL anchor #'+e.budget_number+' · '+(e.match_designation||'exact').toUpperCase()+' · '+(e.actual_system||e.title)+' · '+(e.geography||'See original geography'): 'Original-year budget unavailable';}
function ch4Context(a){return a.year+(a.year===2021?' · EXPERIMENTAL':'')+' · '+a.scenario+' · '+a.source+' · price '+Math.round(a.pf*100)+'% / cost '+Math.round(a.cf*100)+'% · '+(a.basis==='2021'?'constant 2021 dollars':'nominal dollars');}
function ch4ShowSection(){if(viewSelect.getValue()!=='ch4_view')return;var s=ch4Section.getValue();map.style().set('shown',s==='Map');ch4Evidence.style().set('shown',s!=='Map');if(s==='Charts & tables')ch4Charts();if(s==='Methods & sources')ch4Methods();}
function ch4Refresh(){
  if(!ch4Year||!ch4Status)return;ch4Generation++;ch4Request++;ch4Cards.clear();ch4Legend.clear();
  var a={policy:ch4Policy.getValue(),year:Number(ch4Year.getValue()),scenario:ch4Scenario.getValue(),source:ch4Source.getValue(),pf:ch4Factors[ch4Price.getValue()],cf:ch4Factors[ch4Cost.getValue()],basis:ch4Currency.getValue(),layer:ch4Definition.getValue()};
  a.annual=CH4_DATA.annual.filter(function(r){return r.year===a.year&&r.scenario===a.scenario;})[0];a.cost=CH4_DATA.costs.filter(function(r){return r.year===a.year&&r.source===a.source;})[0];a.row=CH4_DATA.sensitivity.filter(function(r){return ch4Match(r,a);})[0];
  a.budget=CH4_DATA.eligibility.filter(function(r){return r.year===a.year;})[0];a.eligible=a.budget.eligible&&(a.policy!=='exact'||a.budget.strict_eligible===undefined||a.budget.strict_eligible);if(!a.eligible){a.cost=null;a.row=null;}ch4EnsureEvidence(a.year);a.factor=a.basis==='2021'&&a.cost?a.cost.to_2021_dollars:1;ch4Active=a;
  if(ch4Layer){map.layers().remove(ch4Layer);ch4Layer=null;}
  var note=a.year===2021?'EXPERIMENTAL 2021 · LGRIP2020 proxy; M1 and M2 identical. Excluded from primary temporal summaries.\n':a.year===2019?'2019 crop-mask source differs from historical years.\n':'';
  var unavailable=!a.eligible?'Economics unavailable under this matching policy. An original production-year UNL budget is required; exact mode excludes approximate systems across all sources.':!a.cost?'Selected source unavailable, incomplete or suppressed for this year.'+(a.year===2009&&a.source==='UNL'?' The 2009 UNL sheet omits complete economic costs.':''):a.layer==='cash'&&a.cost.cash_cost_usd_ac===null?'Cash margin unavailable: cash and ownership/opportunity costs cannot be fully separated in this source account.':null;
  ch4Status.setValue(note+(unavailable||a.cost.geography+'\n'+a.cost.account)+'\n'+ch4BudgetContext(a)+'\n'+ch4Context(a));mapChip.setValue('CH4 '+a.year+' · '+a.layer+' · '+(a.basis==='2021'?'2021 $':'nominal $')+' · '+(a.budget.match_designation||'unavailable'));
  if(a.row){
    ch4Cards.add(ch4Card(a.cost.full_economic_account?'Mean total economic return':'Mean operator-account return',ch4Money(a.row.mean_return_usd_ac*a.factor)+'/acre','Dollar basis: '+(a.basis==='2021'?'2021':'nominal')));
    ch4Cards.add(ch4Card('Negative total return',ch4Num(a.row.loss_ha)+' ha',ch4Num(100*a.row.loss_ha/a.row.valid_ha)+'% of '+ch4Num(a.row.valid_ha)+' valid ha'));
    ch4Cards.add(ch4Card('Valid coverage',ch4Num(100*a.row.valid_ha/a.annual.crop_ha)+'% of regional crop area',ch4Num(a.row.valid_ha)+' ha · '+ch4Num(a.annual.crop_ha-a.row.valid_ha)+' ha outside source domain / missing yield'));
    ch4Cards.add(ch4Card('Breakeven yield',ch4Num(a.row.breakeven_bu_ac)+' bu/acre',ch4Num(a.row.breakeven_Mg_ha)+' Mg/ha · total/source-account costs'));
  }else ch4Cards.add(ch4Card('Yield-only coverage',ch4Num(a.annual.valid_ha)+' ha',ch4Num(100*a.annual.valid_ha/a.annual.crop_ha)+'% · '+ch4Num(a.annual.missing_ha)+' ha missing yield'));
  if(!unavailable||a.layer==='quartile'){
    var idx=CH4_DATA.years.indexOf(a.year)*2+(a.scenario==='M1_fixed'?0:1),image=ee.Image(CH4_DATA.asset).select([idx]).toDouble().rename('value');image=image.updateMask(image.gte(0));
    var q=image.lte(a.annual.cutoff_Mg_ha),result=q,vis={min:0,max:1,palette:['dce6e9','197a91']};
    if(a.layer!=='quartile'){
      if(a.source==='FINBIN_county'){image=image.updateMask(ee.Image(CH4_DATA.county_scope_asset).eq(1));q=q.updateMask(image.mask());}
      var rev=image.divide(CH4_DATA.mgha_per_buac).multiply(a.cost.nass_price_usd_bu*a.pf*a.cost.operator_share),ret=rev.subtract(a.cost.total_cost_usd_ac*a.cf),loss=ret.lt(0);
      if(a.layer==='return'||a.layer==='cash'){result=(a.layer==='return'?ret:rev.subtract(a.cost.cash_cost_usd_ac*a.cf)).multiply(a.factor);vis={min:-1000,max:1000,palette:['b35806','f7f7f7','2166ac']};}
      else if(a.layer==='revenue'){result=rev.multiply(a.factor);vis={min:0,max:2000,palette:['f7fcf0','ccebc5','7bccc4','2b8cbe','084081']};}
      else if(a.layer==='loss'){result=loss;vis={min:0,max:1,palette:['e2e6e6','7a5195']};}
      else{result=q.add(loss.multiply(2));vis={min:0,max:3,palette:['e2e6e6','e69f00','7a5195','143e64']};}
    }
    ch4Layer=ui.Map.Layer(result.rename('value'),vis,'CH4 '+ch4Context(a)+' · '+a.layer+' · '+ch4BudgetContext(a),true);map.layers().add(ch4Layer);
    if(a.layer==='return'||a.layer==='cash'||a.layer==='revenue'){
      ch4Legend.add(fieldLabel((a.layer==='return'&&!a.cost.full_economic_account?'Operator-account return':a.layer)+' · $/acre · '+(a.basis==='2021'?'2021 dollars':'nominal')));
      ch4Legend.add(ui.Thumbnail({image:ee.Image.pixelLonLat().select(0),params:{bbox:[0,0,1,.1],dimensions:'320x16',min:0,max:1,palette:vis.palette},style:{stretch:'horizontal',height:'20px'}}));
      ch4Legend.add(ch4Text(a.layer==='revenue'?'$0                 $1,000                 ≥ $2,000':'≤ −$1,000            $0            ≥ +$1,000','11px'));ch4Legend.add(ch4Text('Saturated tails retain their numerical values. Transparent pixels are outside the valid domain, not $0.','11px'));
    }else{var labels=a.layer==='overlap'?['Neither','Quartile only','Loss only','Both']:a.layer==='quartile'?['Above annual quartile','At/below annual quartile']:['Nonnegative total return','Negative total return'];labels.forEach(function(t,i){var l=ch4Text('■ '+t);l.style().set('color','#'+vis.palette[i]);ch4Legend.add(l);});}
  }
  if(ch4SelectedId!==null)ch4LoadPatch(ch4SelectedId);else ch4ClearPatch();ch4ShowSection();
}
function ch4Chart(title,columns,rows,type,options){
  var p=ui.Panel([ch4Heading(title)],null,{padding:'16px',backgroundColor:THEME.white,margin:'0 0 18px 0',stretch:'horizontal'});if(!rows.length){p.add(ch4Text('Unavailable for the selected source and year.'));return p;}
  var data={cols:columns.map(function(x,i){return {id:'c'+i,label:x,type:i===0?'string':'number'};}),rows:rows.map(function(r){return {c:r.map(function(v){return {v:v};})};})};
  var opt={height:340,fontName:'Arial',fontSize:12,legend:{position:'none'},chartArea:{left:80,right:30,top:20,bottom:80},colors:[THEME.primary],backgroundColor:THEME.white};Object.keys(options||{}).forEach(function(k){opt[k]=options[k];});p.add(ui.Chart(data).setChartType(type||'ColumnChart').setOptions(opt));return p;
}
function ch4Matrix(a){
  var p=ui.Panel([ch4Heading('Price–cost sensitivity'),ch4Text('Rows: price. Columns: cost. Cells show mean return ($/acre) and loss share. Click to apply both settings.')],null,{padding:'16px',backgroundColor:THEME.white,margin:'0 0 18px 0'});
  p.add(ui.Panel(['Cost −15%','Cost baseline','Cost +15%'].map(function(t){return ui.Label(t,{stretch:'horizontal',fontWeight:'bold',fontSize:'12px'});}),ui.Panel.Layout.flow('horizontal')));
  ch4FactorNames.forEach(function(pn){var line=ui.Panel([],ui.Panel.Layout.flow('horizontal'),{stretch:'horizontal'});ch4FactorNames.forEach(function(cn){var target={year:a.year,scenario:a.scenario,source:a.source,pf:ch4Factors[pn],cf:ch4Factors[cn]},r=a.eligible?CH4_DATA.sensitivity.filter(function(x){return ch4Match(x,target);})[0]:null;line.add(ui.Button({label:'Price '+pn+'\n'+(r?ch4Money(r.mean_return_usd_ac*a.factor)+'/ac · '+ch4Num(100*r.loss_ha/r.valid_ha)+'% loss':'Unavailable'),disabled:!r,onClick:function(){ch4Price.setValue(pn,false);ch4Cost.setValue(cn,false);ch4Refresh();},style:{stretch:'horizontal',whiteSpace:'pre-wrap',backgroundColor:r?(r.mean_return_usd_ac<0?'#f6e0c9':'#dbe9f5'):THEME.pale,border:target.pf===a.pf&&target.cf===a.cf?'2px solid '+THEME.primary:'1px solid '+THEME.line,margin:'4px',fontSize:'12px',padding:'10px'}}));});p.add(line);});return p;
}
function ch4Charts(){
  var a=ch4Active;ch4Evidence.clear();ch4Evidence.add(kicker('CH4 · CHARTS & TABLES'));ch4Evidence.add(ch4Heading(ch4Context(a)));ch4Evidence.add(ch4Text(ch4BudgetContext(a)));if(ch4EvidencePending[a.year])ch4Evidence.add(ch4Text('Loading verified county and distribution evidence…'));if(!a.row){ch4Evidence.add(ch4Text('Economic evidence unavailable. Historical yield-only results remain in the yield workspace and quartile map.'));return;}
  var r=a.row,f=a.factor;
  ch4Evidence.add(ch4Table('Exact regional values · source-valid domain',[
    ['Mean return ($/acre)',ch4Money(r.mean_return_usd_ac*f)],['Mean revenue ($/acre)',ch4Money(r.mean_revenue_usd_ac*f)],['Mean cash margin ($/acre)',ch4Money(r.mean_cash_margin_usd_ac===null?null:r.mean_cash_margin_usd_ac*f)],
    ['Median return ($/acre)',ch4Money(r.return_median*f)],['5th–95th percentile return ($/acre)',ch4Money(r.return_p05*f)+' to '+ch4Money(r.return_p95*f)],['Area-summed total return ($)',ch4Money(r.total_return_usd*f)],
    ['Valid / regional crop area (ha)',ch4Num(r.valid_ha)+' / '+ch4Num(a.annual.crop_ha)],['Regional yield missingness (ha)',ch4Num(a.annual.missing_ha)],['Source exclusion + missingness (ha)',ch4Num(a.annual.crop_ha-r.valid_ha)],['Quartile / overlap / disagreement (ha)',ch4Num(r.quartile_ha)+' / '+ch4Num(r.both_ha)+' / '+ch4Num(r.disagree_ha)]]));
  var metric=['return','cash','revenue'].indexOf(a.layer)>=0?a.layer:'return',d=CH4_DATA.distributions.filter(function(x){return ch4Match(x,a)&&x.metric===metric&&x.basis===a.basis;})[0],bins=[],start=metric==='revenue'?0:-1000,end=metric==='revenue'?2000:1000;
  if(d&&!(metric==='cash'&&a.cost.cash_cost_usd_ac===null)){d.counts.forEach(function(n,i){bins.push([i===0?'< '+start:i===d.counts.length-1?'≥ '+end:(start+(i-1)*100)+' to < '+(start+i*100),n*.09]);});}
  ch4Evidence.add(ch4Chart('Area-weighted '+metric+' distribution · '+ch4Num(r.valid_ha)+' ha',['$/acre bin','Area (ha)'],bins,'ColumnChart',{hAxis:{title:'$/acre · '+a.basis+' basis',slantedText:true,slantedTextAngle:55},vAxis:{title:'Native valid area (ha)'},height:400}));
  var counties=CH4_DATA.counties.filter(function(x){return ch4Match(x,a)&&x.valid_ha>0;}).sort(function(x,y){return x.return_usd_ac_mean-y.return_usd_ac_mean;});
  ch4Evidence.add(ch4Chart('County–AOI mean return',['County','Mean return ($/acre)'],counties.map(function(x){return [x.NAME,x.return_usd_ac_mean*f];}),'BarChart',{height:440,hAxis:{title:'$/acre · '+a.basis+' basis'},chartArea:{left:110,right:30,top:20,bottom:50}}));
  ch4Evidence.add(ch4Chart('County negative-return share',['County','Loss share (%)'],counties.map(function(x){return [x.NAME,100*x.economic_loss_ha/x.valid_ha];}),'BarChart',{height:440,hAxis:{title:'Percent of county source-valid crop area',viewWindow:{min:0,max:100}},chartArea:{left:110,right:30,top:20,bottom:50},colors:['#b35806']}));
  ch4Evidence.add(ch4Chart('Marginality overlap · same '+ch4Num(r.valid_ha)+' ha denominator',['Definition','Area (ha)'],[['Neither',r.valid_ha-r.loss_ha-r.quartile_ha+r.both_ha],['Quartile only',r.quartile_ha-r.both_ha],['Loss only',r.loss_ha-r.both_ha],['Both',r.both_ha]],'ColumnChart',{vAxis:{title:'Area (ha)'}}));ch4Evidence.add(ch4Matrix(a));
  var comparisons=CH4_DATA.sensitivity.filter(function(x){return x.year===a.year&&x.scenario===a.scenario&&x.price_factor===a.pf&&x.cost_factor===a.cf;});
  ch4Evidence.add(ch4Chart('Source scenarios · distinct accounting and coverage',['Source','Mean return ($/acre)'],comparisons.map(function(x){return [x.source+' · '+ch4Num(x.valid_ha,0)+' ha',x.mean_return_usd_ac*f];}),'BarChart',{height:330,chartArea:{left:240,right:30,top:20,bottom:60},hAxis:{title:'$/acre · '+a.basis+' basis'}}));
  comparisons.forEach(function(x){var c=CH4_DATA.costs.filter(function(t){return t.year===a.year&&t.source===x.source;})[0];ch4Evidence.add(ch4Text(c.source+' · '+c.geography+' · '+c.account+' · report n: '+(c.sample_n===null?'not applicable':c.sample_n)+' · valid area '+ch4Num(x.valid_ha)+' ha','11px'));});
  var assoc=CH4_DATA.associations.filter(function(x){return x.year===a.year&&x.scenario===a.scenario&&x.source===a.source&&x.block_m===10000;});
  ch4Evidence.add(ch4Table('Baseline NCCPI associations · baseline prices and costs',assoc.map(function(x){return [x.metric+' · n='+ch4Num(x.n,0),'r='+ch4Num(x.r,3)+' · 95% block interval '+ch4Num(x.ci_low,3)+' to '+ch4Num(x.ci_high,3)];})));
  ch4Evidence.add(ch4Text('10 km blocks · 1,999 resamples · seed 20260928. 5 km and 20 km checks remain in the downloadable table. These baseline intervals do not describe active sensitivity settings. Scenario economics are not independent profitability validation.'));
  ch4Evidence.add(ch4Table('County coverage and exact totals',counties.map(function(x){return [x.NAME+' · valid / crop ha',ch4Num(x.valid_ha)+' / '+ch4Num(x.crop_ha)+' · '+ch4Money(x.return_usd_ac_sum_usd*f)+' total return'];})));
}
function ch4Methods(){
  var a=ch4Active;ch4Evidence.clear();ch4Evidence.add(kicker('CH4 · METHODS & SOURCES'));ch4Evidence.add(ch4Heading('Definitions, provenance and scope'));
  [
    'Yield equations and parameters are unchanged. Native 30 m EPSG:5070 pixels each represent 0.09 ha. Monetary rates use dollars per acre; areas use hectares. Masks, indexes and geometry are checked against the locked inventory.',
    'Revenue = yield (Mg/ha) ÷ '+CH4_DATA.mgha_per_buac+' × crop-year Nebraska NASS marketing-year price × price factor × operator share. Return = revenue − source total costs × cost factor. Cash margin is calculated only where a cash-cost account is defined.',
    'Economic marginality means total/source-account return < 0. Yield marginality means at or below the annual regional 25th percentile, including ties. The quartile cutoff is fixed on the full annual regional yield footprint; comparisons restrict both definitions to the same source-valid domain.',
    'Annual CPI-U ratios convert nominal amounts to constant 2021 dollars. A positive multiplier changes revenue, margins, returns and totals without changing classifications. Fixed map scales retain saturated tails in the distribution charts.',
    'Every economic year requires an original production-year UNL budget. Closest rotation-matched mode prioritizes dryland corn after soybean and explicitly accepts no-till and geography differences. Exact mode permits only verified strict matches. Eligible anchor years under the selected policy: '+CH4_DATA.eligibility.filter(function(r){return r.eligible&&(a.policy!=="exact"||r.strict_eligible===undefined||r.strict_eligible);}).map(function(r){return r.year+(r.year===2021?' (experimental)':'');}).join(', ')+'. 2003, 2005 and 2007 remain blocked because originals are unrecovered; no neighboring-year costs are substituted. ERS and FINBIN cannot substitute for this gate. The 2009 UNL worksheet is incomplete and cannot supply full UNL return; 2001 UNL cash margin is unavailable.',
    'UNL historical approximations use actual published no-till corn-after-soybean costs without invented tillage adjustments. These modeled returns do not establish equivalence with conventional tillage. UNL 2009 has incomplete total costs, and 2001 cash margin is undefined. The 2019 printed cash-per-bushel figure does not reconcile; cash cost uses verified line items. ERS: Heartland planted-acre regional scenario across practices; operating costs are not a complete cash-cost account.',
    'FINBIN reports are participant operator-account proxies with unverified rainfed practice and incomplete opportunity costs. Statewide and county reports remain separate. The 2019 county domain is Gage, Johnson, Lancaster and Pawnee; the 2021 county report is unavailable/suppressed.',
    '2019 has a documented mask-source change. Experimental 2021 uses the LGRIP2020 proxy, has identical M1 and M2 yields, and is outside primary temporal summaries. No economic trend connects economically unavailable years.',
    'Native annual raster IDs select their matching crop polygons. IDs reset with year and describe mapped units, not persistent farms. Missing yield remains missing. County/patch denominators use raster pixels rather than polygon areas; original mask edge cells retain the documented county-center/fringe assignment.',
    'NCCPI association uncertainty uses 10 km spatial blocks, 1,999 replicates and a fixed seed; 5 km and 20 km checks are retained. These are baseline associations. Producer-level economic observations are unavailable for independent profitability validation.'
  ].forEach(function(t){ch4Evidence.add(ch4Text(t,'13px'));});
  var e=CH4_DATA.eligibility.filter(function(x){return x.year===a.year;})[0];ch4Evidence.add(ch4Table('Selected-year budget eligibility',[['Year',String(a.year)],['Policy',a.policy],['Designation',e.match_designation||'unavailable'],['Actual system',e.actual_system||e.title||'Unavailable'],['Geography',e.geography||'See original'],['Mismatch',e.mismatch_fields||'None'],['Status',e.status],['Source publication',e.publication_title||e.title||'Original not recovered'],['Matching budget',e.title||'No verified system match'],['Budget / PDF page',e.eligible?e.budget_number+' / '+e.pdf_page:'Unavailable'],['Review',e.review_note||'See source ledger']]));
  if(CH4_DATA.source_audit){
    ch4Evidence.add(ch4Heading('Historical original-budget review · '+CH4_DATA.source_audit.review_date));
    ch4Evidence.add(ch4Text('Strict system: Eastern Nebraska dryland conventional-tillage corn in a corn–soybean rotation. Historical no-till corn-after-soybean candidates do not qualify under that system; closest mode explicitly accepts their documented differences. 2003, 2005 and 2007 originals remain unrecovered. The DigitalCommons /2024/ record is a 2001 publication, posted in 2012.'));
    ch4Evidence.add(ch4Table('Annual source decisions',CH4_DATA.eligibility.map(function(r){return [String(r.year)+(r.year===2021?' · experimental':''),r.eligible?(r.match_designation||'exact')+' · UNL #'+r.budget_number:r.original_recovered?'Original recovered · selected system absent':'Original not recovered'];})));
    ch4Evidence.add(ui.Label({value:'Historical budget evidence and search register ↗',targetUrl:CH4_DATA.source_audit.report_url}));
    ch4Evidence.add(ch4Text('Source audit: '+CH4_DATA.source_audit.run_id+'\nRegistry SHA-256: '+CH4_DATA.source_audit.registry_sha256+'\nUnchanged yield rasters and 2019/2021 results retained; historical economics recalculated under the separate rotation-priority register.','11px'));
  }
  if(e.source_url)ch4Evidence.add(ui.Label({value:'Selected original UNL budget ↗',targetUrl:e.source_url}));
  [['UNL crop-budget archive','https://cap.unl.edu/cropbudgets/archive/'],['Original 2001 publication','https://digitalcommons.unl.edu/extensionhist/2024/'],['UNL crop budgets','https://cap.unl.edu/cropbudgets/'],['FINBIN reports','https://finbin.umn.edu/'],['USDA ERS commodity costs and returns','https://www.ers.usda.gov/data-products/commodity-costs-and-returns'],['Nebraska NASS','https://www.nass.usda.gov/Statistics_by_State/Nebraska/'],['Code, source ledger and methods','https://github.com/njberkowitz95/Yields-and-Fields-CH1/tree/codex/ch4-marginality/ch4_marginality']].forEach(function(x){ch4Evidence.add(ui.Label({value:x[0]+' ↗',targetUrl:x[1],style:{fontSize:'13px',color:THEME.primary}}));});
  ch4Evidence.add(ch4Text('Run: '+CH4_DATA.run_id+'\nManifest SHA-256: '+CH4_DATA.input_manifest_sha256+'\nOutputs: PHD/CSP3_GPP_outputs/CH4_marginality/'+CH4_DATA.run_id+'/','11px'));
}
function ch4LoadPatch(id){
  var a=ch4Active,generation=ch4Generation,request=++ch4Request;ch4Patch.clear();ch4Patch.add(ch4Text('Loading annual crop patch '+id+'…'));
  var pre=a.scenario.slice(0,2).toLowerCase(),src=pre+'_'+{UNL:'u',ERS_Heartland:'e',FINBIN_state:'s',FINBIN_county:'c'}[a.source],keys=['label_id','year'];
  ['crop_ha','valid_ha','missing_ha','coverage_percent','yield_Mg_ha_mean','quartile_ha'].forEach(function(k){keys.push(pre+'_'+k);});
  if(a.row){['valid_ha','missing_ha','coverage_percent','yield_Mg_ha_mean','quartile_ha'].forEach(function(k){keys.push(src+'_'+k);});ch4FactorNames.forEach(function(p){ch4FactorNames.forEach(function(c){['loss','both','disagree'].forEach(function(k){keys.push(src+'_'+Math.round(ch4Factors[p]*100)+'_'+Math.round(ch4Factors[c]*100)+'_'+k);});});});}
  var feature=ee.FeatureCollection(CH4_DATA.patch_assets[String(a.year)]).filter(ee.Filter.eq('label_id',id)).first();feature.toDictionary(keys).evaluate(function(v,error){
    if(generation!==ch4Generation||request!==ch4Request||viewSelect.getValue()!=='ch4_view')return;ch4Patch.clear();
    if(error||!v||v.label_id===undefined){ch4Patch.add(ch4Text('Patch evidence unavailable: '+(error||'annual ID not found')));return;}
    ch4SelectedId=id;if(ch4Outline)map.layers().remove(ch4Outline);ch4Outline=ui.Map.Layer(ee.FeatureCollection([feature]).style({color:'172f48',fillColor:'00000000',width:3}),{},'Selected patch '+a.year+' / '+id,true);map.layers().add(ch4Outline);
    var s=a.row?src:pre,valid=v[s+'_valid_ha'],ym=v[s+'_yield_Mg_ha_mean'],sk=src+'_'+Math.round(a.pf*100)+'_'+Math.round(a.cf*100);
    var rev=ym===undefined||ym===null?null:ym/CH4_DATA.mgha_per_buac*(a.cost?a.cost.nass_price_usd_bu*a.pf*a.cost.operator_share:0),ret=a.row&&rev!==null?(rev-a.cost.total_cost_usd_ac*a.cf)*a.factor:null,cash=a.row&&rev!==null&&a.cost.cash_cost_usd_ac!==null?(rev-a.cost.cash_cost_usd_ac*a.cf)*a.factor:null;
    ch4Patch.add(ch4Text(ch4BudgetContext(a)+'\n'+ch4Context(a)));ch4Patch.add(ch4Table('Selected mapped crop unit',[['Annual patch ID',a.year+' / '+id],['Crop / source-valid area (ha)',ch4Num(v[pre+'_crop_ha'])+' / '+ch4Num(valid)],['Source exclusion + missingness (ha)',ch4Num(v[pre+'_crop_ha']-valid)],['Yield missingness (ha)',ch4Num(v[pre+'_missing_ha'])],['Mean yield (Mg/ha)',ch4Num(ym,3)],['Mean return ($/acre)',ch4Money(ret)],['Mean cash margin ($/acre)',ch4Money(cash)],['Loss / quartile / both (ha)',ch4Num(v[sk+'_loss'])+' / '+ch4Num(v[s+'_quartile_ha'])+' / '+ch4Num(v[sk+'_both'])],['Disagreement (ha)',ch4Num(v[sk+'_disagree'])]]));
    if(a.row){ch4Patch.add(fieldLabel('Patch sensitivity · negative-return share (%)'));ch4FactorNames.forEach(function(p){ch4Patch.add(ch4Text('Price '+p+': '+ch4FactorNames.map(function(c){var loss=v[src+'_'+Math.round(ch4Factors[p]*100)+'_'+Math.round(ch4Factors[c]*100)+'_loss'];return c+' cost '+(valid>0&&loss!==undefined?ch4Num(100*loss/valid)+'%':'Unavailable');}).join(' · '),'11px'));});}
  });
}
var ch4PriorQuery=querySelectedLocation;
querySelectedLocation=function(coords){
  if(viewSelect.getValue()!=='ch4_view'){ch4PriorQuery(coords);return;}
  var a=ch4Active,generation=ch4Generation,request=++ch4Request;ch4Patch.clear();ch4Patch.add(ch4Text('Reading the native annual patch ID…'));
  ee.Image(CH4_DATA.patch_index_asset).select([CH4_DATA.years.indexOf(a.year)]).rename('patch_id').reduceRegion({reducer:ee.Reducer.first(),geometry:ee.Geometry.Point([coords.lon,coords.lat]),crs:'EPSG:5070',crsTransform:[30,0,-111285,0,-30,2047275],maxPixels:1e6}).evaluate(function(v,error){
    if(generation!==ch4Generation||request!==ch4Request||viewSelect.getValue()!=='ch4_view')return;if(error||!v||!v.patch_id){ch4ClearPatch();ch4Patch.add(ch4Text(error?'Native lookup failed: '+error:'No mapped crop patch at this pixel.'));return;}ch4LoadPatch(v.patch_id);
  });
};
ch4ClearPatch();
