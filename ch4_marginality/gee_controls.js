// CH4 additive view. CH4_DATA is generated from the executed, audited results.
var ch4Panel = ui.Panel({style: {shown: false, margin: '0'}});
panel.add(ch4Panel);
viewSelect.items().add({label: 'CH4 · economic and yield marginality', value: 'ch4_view'});
// The original app disables its view selector for the 2019/2021 yield-only
// extension. Keep that safeguard, but give CH4 its own always-available entry.
var ch4NavButton = ui.Button({label: 'Open CH4 marginality', onClick: function() {
  if (viewSelect.getValue() === 'ch4_view') {
    viewSelect.setValue('map_view', false);
    switchView('map_view');
  } else {
    viewSelect.setValue('ch4_view', false);
    switchView('ch4_view');
  }
}, style: {margin: '0 6px 0 0', fontSize: '11px'}});
navBar.add(ch4NavButton);
var ch4OldSwitch = switchView;
var ch4PreviousLayers = [];
var ch4PreviousChip = '';
switchView = function(v) {
  ch4OldSwitch(v);
  if (v === 'ch4_view' && !ch4PreviousLayers.length) {
    ch4PreviousChip=mapChip.getValue();
    map.layers().forEach(function(layer) {if (layer!==ch4Layer) {ch4PreviousLayers.push([layer,layer.getShown()]);layer.setShown(false);}});
    legend.style().set('shown',false);
  } else if (v !== 'ch4_view' && ch4PreviousLayers.length) {
    ch4PreviousLayers.forEach(function(r){r[0].setShown(r[1]);});ch4PreviousLayers=[];
    legend.style().set('shown',true);
    mapChip.setValue(ch4PreviousChip);
  }
  ch4Panel.style().set('shown', v === 'ch4_view');
  ch4NavButton.setLabel(v === 'ch4_view' ? 'Back to yield model' : 'Open CH4 marginality');
  if (ch4Layer) ch4Layer.setShown(v === 'ch4_view');
  if (v === 'ch4_view') ch4Refresh();
};
var ch4Layer = null;
var ch4Generation = 0;
ch4Panel.add(kicker('CH4 · EXACT-YEAR BUDGETS', THEME.primary));
ch4Panel.add(ui.Label('Two definitions, reported equally', {fontSize: '17px', fontWeight: 'bold'}));
ch4Panel.add(ui.Label('Economic loss means a negative total economic return. Yield marginality means at or below the annual regional 25th percentile, including ties.', {whiteSpace: 'pre-wrap', fontSize: '12px'}));
var ch4Year = ui.Select({items: CH4_DATA.years.map(function(y) {
  return {label: String(y) + (y === 2021 ? ' · EXPERIMENTAL' : y === 2019 ? ' · economics available' : ' · economics blocked'), value: String(y)};
}), value: '2019', onChange: ch4Refresh, style: {width: '100%'}});
var ch4Scenario = ui.Select({items: ['M1_fixed','M2_HI_sensitivity'], value: 'M1_fixed', onChange: ch4Refresh, style: {width: '100%'}});
var ch4Source = ui.Select({items: ['UNL','ERS_Heartland','FINBIN_county','FINBIN_state'], value: 'UNL', onChange: ch4Refresh, style: {width: '100%'}});
var ch4Definition = ui.Select({items: [
  {label: 'Economic loss / source-account loss', value: 'loss'},
  {label: 'Lowest yield quartile', value: 'quartile'},
  {label: 'Overlap and disagreement', value: 'overlap'}
], value: 'overlap', onChange: ch4Refresh, style: {width: '100%'}});
var ch4Price = ui.Select({items: ['−15%','Baseline','+15%'], value: 'Baseline', onChange: ch4Refresh});
var ch4Cost = ui.Select({items: ['−15%','Baseline','+15%'], value: 'Baseline', onChange: ch4Refresh});
[['Year',ch4Year],['Yield scenario',ch4Scenario],['Economic source',ch4Source],['Marginality definition',ch4Definition],['Price sensitivity',ch4Price],['Cost sensitivity',ch4Cost]].forEach(function(x) {ch4Panel.add(fieldLabel(x[0]));ch4Panel.add(x[1]);});
var ch4Status = ui.Label('', {whiteSpace: 'pre-wrap',fontSize: '12px',margin: '10px 0'});
var ch4Results = ui.Label('', {whiteSpace: 'pre-wrap',fontSize: '12px',margin: '10px 0'});
var ch4Legend = ui.Panel();
ch4Panel.add(ch4Status);ch4Panel.add(ch4Results);ch4Panel.add(ch4Legend);
var ch4Pixel=ui.Label('Click the map to inspect the selected classification.',{fontSize:'12px',whiteSpace:'pre-wrap'});
ch4Panel.add(ch4Pixel);
ch4Panel.add(ui.Label({value: 'Research code and methods (repository access required) ↗',targetUrl: 'https://github.com/njberkowitz95/Yields-and-Fields-CH1/tree/codex/ch4-marginality/ch4_marginality',style: {fontSize: '12px'}}));
ch4Panel.add(ui.Label('FINBIN reports are operator-account proxies with unverified rainfed practice and incomplete opportunity costs. ERS Heartland is a broad all-practice, planted-acre scenario. These are scenario comparisons, not independent profitability validation.', {fontSize: '11px',color: THEME.muted,whiteSpace: 'pre-wrap'}));
function ch4Refresh() {
  if (!ch4Year || !ch4Results) return;
  ch4Generation++;
  ch4Pixel.setValue('Click the map to inspect the selected classification.');
  var y=Number(ch4Year.getValue()), scenario=ch4Scenario.getValue(), source=ch4Source.getValue(), definition=ch4Definition.getValue();
  var pf={'−15%':.85,'Baseline':1,'+15%':1.15}[ch4Price.getValue()];
  var cf={'−15%':.85,'Baseline':1,'+15%':1.15}[ch4Cost.getValue()];
  var annual=CH4_DATA.annual.filter(function(r){return r.year===y && r.scenario===scenario;})[0];
  var cost=CH4_DATA.costs.filter(function(r){return r.year===y && r.source===source;})[0];
  var eligible=CH4_DATA.eligibility.filter(function(r){return r.year===y;})[0];
  mapChip.setValue('CH4 '+y+(y===2021?' · EXPERIMENTAL':''));
  var warning=y===2021 ? 'EXPERIMENTAL 2021. LGRIP2020 proxy; M1 and M2 identical. Excluded from primary temporal summaries.\n' : y===2019 ? '2019 mask source changed from historical years.\n' : '';
  if (ch4Layer) {map.layers().remove(ch4Layer);ch4Layer=null;}
  ch4Legend.clear();
  ch4Results.setValue('Yield-only valid area: '+annual.valid_ha.toFixed(2)+' ha\nLowest-quartile area: '+annual.quartile_ha.toFixed(2)+' ha ('+annual.quartile_percent.toFixed(2)+'%)\nRegional cutoff: '+annual.cutoff_Mg_ha.toFixed(4)+' Mg/ha');
  if (definition!=='quartile' && (!eligible.eligible || !cost)) {
    ch4Status.setValue(warning+(!eligible.eligible ? 'ECONOMICS BLOCKED: no verified exact-year UNL budget matching the selected production system. This blocks all economic sources and sensitivities. Yield-only results remain available.' : 'This source is unavailable or suppressed for the selected year. Select another source or the yield-quartile definition.'));
    return;
  }
  var idx=CH4_DATA.years.indexOf(y)*2+(scenario==='M1_fixed'?0:1);
  var image=ee.Image(CH4_DATA.asset).select([idx]).toDouble().rename('yield');
  image=image.updateMask(image.gte(0));
  var q=image.lte(annual.cutoff_Mg_ha), result=q, palette=['dce6e9','197a91'], max=1;
  var status=warning+'Yield quartiles use the complete annual regional valid footprint. Price, cost and source do not alter this definition.';
  if (definition!=='quartile') {
    if (source==='FINBIN_county') {
      var countyScope=ee.Image(CH4_DATA.county_scope_asset).select(0).eq(1);
      image=image.updateMask(countyScope);q=q.updateMask(countyScope);
    }
    var loss=image.divide(CH4_DATA.mgha_per_buac).multiply(cost.nass_price_usd_bu).multiply(pf).multiply(cost.operator_share).subtract(cost.total_cost_usd_ac*cf).lt(0);
    result=definition==='overlap'?q.add(loss.multiply(2)):loss;
    if (definition==='overlap') {palette=['e2e6e6','e69f00','7a5195','143e64'];max=3;}
    else palette=['e2e6e6','7a5195'];
    var row=CH4_DATA.sensitivity.filter(function(r){return r.year===y && r.scenario===scenario && r.source===source && r.price_factor===pf && r.cost_factor===cf;})[0];
    status=warning+(cost.full_economic_account?'Total economic return < $0/acre.':'FINBIN negative operator-account proxy; incomplete economic opportunity costs.')+'\n'+cost.geography;
    ch4Results.setValue('Compared valid area: '+row.valid_ha.toFixed(2)+' ha\nLoss area: '+row.loss_ha.toFixed(2)+' ha\nQuartile area in this domain: '+row.quartile_ha.toFixed(2)+' ha\nBoth definitions: '+row.both_ha.toFixed(2)+' ha\nDisagreement: '+row.disagree_ha.toFixed(2)+' ha\nMean return: $'+row.mean_return_usd_ac.toFixed(2)+'/acre nominal; $'+row.mean_return_2021usd_ac.toFixed(2)+' in 2021 dollars');
  }
  ch4Status.setValue(status);
  var labels=definition==='overlap'?['Neither','Quartile only','Loss only','Both']:definition==='quartile'?['Above quartile','At/below quartile']:['Nonnegative return','Negative return'];
  labels.forEach(function(label,i){ch4Legend.add(ui.Panel([ui.Label('■',{color:'#'+palette[i],fontWeight:'bold'}),ui.Label(label,{color:THEME.primary,fontSize:'12px'})],ui.Panel.Layout.flow('horizontal'),{margin:'0'}));});
  ch4Layer=ui.Map.Layer(result,{min:0,max:max,palette:palette},'CH4 '+y+' '+scenario+' '+definition,true);
  map.layers().add(ch4Layer);
}
var ch4PriorQuery=querySelectedLocation;
querySelectedLocation=function(coords) {
  if (viewSelect.getValue()!=='ch4_view') {ch4PriorQuery(coords);return;}
  if (!ch4Layer) {ch4Pixel.setValue('No economic layer is available for these settings.');return;}
  var generation=ch4Generation, definition=ch4Definition.getValue();
  ch4Pixel.setValue('Reading the native 30 m classification…');
  ch4Layer.getEeObject().reduceRegion({reducer:ee.Reducer.first(),geometry:ee.Geometry.Point([coords.lon,coords.lat]),crs:'EPSG:5070',crsTransform:[30,0,-111285,0,-30,2047275],maxPixels:1e6}).evaluate(function(value,error) {
    if (generation!==ch4Generation || viewSelect.getValue()!=='ch4_view') return;
    if (error) {ch4Pixel.setValue('Pixel lookup failed: '+error);return;}
    if (!value || value.yield===null || value.yield===undefined) {ch4Pixel.setValue('No valid crop observation in the selected analysis domain.');return;}
    var labels=definition==='overlap'?['Neither definition','Quartile only','Loss only','Both definitions']:definition==='quartile'?['Above annual quartile','At/below annual quartile']:['Nonnegative return','Negative return'];
    ch4Pixel.setValue('Selected native pixel: '+labels[value.yield]);
  });
};
