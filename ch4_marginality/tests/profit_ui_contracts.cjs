// Execute the actual CH4 UI controller with deterministic UI/server stand-ins.
// This verifies request invalidation and state restoration; Chrome tests verify rendering.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const pending=[],evidencePending=[];
function widget(opts={},layout,style){
  if(Array.isArray(opts))opts={widgets:opts,style:style||{}};
  const w={value:opts.value,label:opts.label,list:opts.widgets||[],styles:opts.style||{},onChange:opts.onChange};
  w.style=()=>({set:(k,v)=>{if(typeof k==='object')Object.assign(w.styles,k);else w.styles[k]=v;}});
  w.add=x=>w.list.push(x);w.clear=()=>{w.list=[];};w.insert=(i,x)=>w.list.splice(i,0,x);
  w.widgets=()=>({get:i=>w.list[i],length:()=>w.list.length});
  w.items=()=>({add:x=>w.list.push(x)});w.setLayout=()=>{};
  w.getValue=()=>w.value;w.setValue=(v,trigger=true)=>{w.value=v;if(trigger&&w.onChange)w.onChange(v);};
  w.setLabel=v=>w.label=v;w.getShown=()=>w.shown;w.setShown=v=>w.shown=v;
  return w;
}
const ui={Panel:widget,Select:widget,Button:widget,Label:(v,s)=>widget(typeof v==='object'?v:{value:v,style:s}),Thumbnail:widget};
ui.Panel.Layout={flow:()=>({})};ui.root=widget();ui.Chart=()=>({setChartType(){return this;},setOptions(){return this;}});
ui.Map={Layer:(o,v,n,shown)=>({object:o,shown,getShown(){return this.shown;},setShown(v){this.shown=v;},getEeObject(){return this.object;}})};
const layerList=[];
const map=widget();map.layers=()=>({forEach:fn=>layerList.slice().forEach(fn),add:l=>layerList.push(l),remove:l=>{const i=layerList.indexOf(l);if(i>=0)layerList.splice(i,1);}});
function image(){const o={};['select','toDouble','rename','updateMask','gte','lte','eq','divide','multiply','subtract','lt','add','mask'].forEach(k=>o[k]=()=>o);o.reduceRegion=()=>({evaluate:fn=>pending.push(fn)});return o;}
const fc={aggregate_array(){return {evaluate:fn=>evidencePending.push(fn)};},filter(){return this;},first(){return this;},style(){return image();},toDictionary(){return {evaluate:fn=>pending.push(fn)};}};
const ee={Image:image,FeatureCollection:()=>fc,Filter:{eq:()=>({})},Geometry:{Point:()=>({})},Reducer:{first:()=>({})}};ee.Image.pixelLonLat=image;
const compiled=process.argv.includes('--compiled');
const source=compiled?fs.readFileSync(__dirname+'/../../csp3_maize_gpp/gee_app_Yield_PEM.js','utf8'):null;
const data=compiled?JSON.parse(source.split('var CH4_DATA = ')[1].split(';\n// CH4 Economics:')[0]):JSON.parse(fs.readFileSync(__dirname+'/profit_ui_fixture.json','utf8'));
if(compiled)assert.ok(Buffer.byteLength(source)<512*1024,'compiled app must fit Earth Engine storage');
const ctx={ui,ee,map,CH4_DATA:data,THEME:{pale:'#fff',body:'#333',ink:'#111',muted:'#777',primary:'#167',white:'#fff',line:'#ccc'},panel:widget(),navBar:widget(),viewSelect:widget({value:'map_view'}),eyebrow:widget({value:'original heading'}),appTitle:widget({value:'original title'}),appDesc:widget({value:'original description'}),mapChip:widget({value:'original chip'}),legend:widget(),switchView(){},querySelectedLocation(){},kicker:t=>ui.Label(t),fieldLabel:t=>ui.Label(t),isFinite};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../gee_profit_controls.js','utf8'),ctx);
ctx.viewSelect.setValue('ch4_view',false);ctx.switchView('ch4_view');
assert.strictEqual(ctx.ch4Active.year,2019);assert.strictEqual(ctx.ch4Active.basis,'2021');assert.strictEqual(ctx.ch4Definition.getValue(),'return');
ctx.querySelectedLocation({lon:-96.4,lat:41.1});assert.strictEqual(pending.length,1);
ctx.ch4Year.setValue('2021');pending.shift()({patch_id:123});assert.strictEqual(pending.length,0,'stale pixel must not request a patch');assert.strictEqual(ctx.ch4SelectedId,null);
ctx.ch4LoadPatch(123);assert.strictEqual(pending.length,1);ctx.ch4Scenario.setValue('M2_HI_sensitivity');pending.shift()({label_id:123});assert.strictEqual(ctx.ch4SelectedId,null,'stale patch must not select/highlight');
ctx.ch4Source.setValue('FINBIN_county');assert.strictEqual(ctx.ch4Layer,null,'suppressed county-year cannot draw economic map');
ctx.ch4Policy.setValue('exact');ctx.ch4Year.setValue('2001');ctx.ch4Definition.setValue('quartile');assert.ok(ctx.ch4Layer,'historical quartile remains available');ctx.ch4Definition.setValue('return');assert.strictEqual(ctx.ch4Layer,null,'all historical economics blocked');
if(compiled&&data.budget_policy==='closest_rotation'){
  ctx.ch4Policy.setValue('closest_rotation');ctx.ch4Source.setValue('UNL');assert.ok(ctx.ch4Layer,'verified approximate 2001 budget maps in closest mode');
  ctx.ch4Definition.setValue('cash');assert.strictEqual(ctx.ch4Layer,null,'2001 cash cannot be invented');
  ctx.ch4Year.setValue('2009');ctx.ch4Definition.setValue('return');assert.strictEqual(ctx.ch4Layer,null,'2009 partial UNL costs cannot produce full return');
  ctx.ch4Source.setValue('ERS_Heartland');assert.ok(ctx.ch4Layer,'2009 separate ERS enabled by original-year anchor');
  ctx.ch4Policy.setValue('exact');assert.strictEqual(ctx.ch4Active.row,null,'strict mode blocks other sources for approximate years');
  ctx.ch4Section.setValue('Charts & tables');assert.strictEqual(ctx.ch4Active.cost,null);
  ctx.ch4Policy.setValue('closest_rotation');ctx.ch4Year.setValue('2003');assert.strictEqual(ctx.ch4Active.row,null,'unrecovered year remains blocked');
}
ctx.ch4Year.setValue('2019');ctx.ch4Source.setValue('ERS_Heartland');ctx.ch4Definition.setValue('cash');assert.strictEqual(ctx.ch4Layer,null,'undefined cash account must not map zeros');
ctx.ch4Source.setValue('UNL');ctx.ch4Definition.setValue('return');ctx.ch4Section.setValue('Charts & tables');assert.strictEqual(map.styles.shown,false);assert.strictEqual(ctx.ch4Evidence.styles.shown,true);
ctx.viewSelect.setValue('map_view',false);ctx.switchView('map_view');assert.strictEqual(ctx.appTitle.value,'original title');assert.strictEqual(map.styles.shown,true);assert.strictEqual(ctx.ch4Evidence.styles.shown,false);
console.log('CH4 UI contracts passed: defaults, eligibility, cash scope, annual reset, stale responses, view restoration.');
