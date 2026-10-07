// Execute the actual CH4 UI controller with deterministic UI/server stand-ins.
// This verifies request invalidation and state restoration; Chrome tests verify rendering.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const pending=[],evidencePending=[];
function widget(opts={},layout,style){
  if(Array.isArray(opts))opts={widgets:opts,style:style||{}};
  const w={value:opts.value,label:opts.label,list:opts.widgets||[],styles:opts.style||{},changeHandler:opts.onChange};
  w.style=()=>({set:(k,v)=>{if(typeof k==='object')Object.assign(w.styles,k);else w.styles[k]=v;}});
  w.add=x=>w.list.push(x);w.clear=()=>{w.list=[];};w.insert=(i,x)=>w.list.splice(i,0,x);
  w.widgets=()=>({get:i=>w.list[i],length:()=>w.list.length,insert:(i,x)=>w.list.splice(i,0,x)});
  w.items=()=>({add:x=>w.list.push(x)});w.setLayout=()=>{};
  w.onChange=fn=>{w.changeHandler=fn;};
  w.getValue=()=>w.value;w.setValue=(v,trigger=true)=>{w.value=v;if(trigger&&w.changeHandler)w.changeHandler(v);};
  w.setLabel=v=>w.label=v;w.getShown=()=>w.shown;w.setShown=v=>w.shown=v;
  return w;
}
const ui={Panel:widget,Select:widget,Button:widget,Label:(v,s)=>widget(typeof v==='object'?v:{value:v,style:s}),Thumbnail:widget};
ui.Panel.Layout={flow:()=>({})};ui.root=widget();ui.Chart=()=>({setChartType(){return this;},setOptions(){return this;}});
ui.Map={Layer:(o,v,n,shown)=>({object:o,shown,getShown(){return this.shown;},setShown(v){this.shown=v;},getEeObject(){return this.object;}})};
const layerList=[];
const map=widget();map.layers=()=>({forEach:fn=>layerList.slice().forEach(fn),add:l=>layerList.push(l),remove:l=>{const i=layerList.indexOf(l);if(i>=0)layerList.splice(i,1);}});
function image(){const o={};['select','toDouble','rename','updateMask','gte','lte','eq','divide','multiply','subtract','lt','gt','add','mask'].forEach(k=>o[k]=()=>o);o.reduceRegion=()=>({evaluate:fn=>pending.push(fn)});return o;}
const fc={aggregate_array(){return {evaluate:fn=>evidencePending.push(fn)};},filter(){return this;},first(){return this;},style(){return image();},toDictionary(){return {evaluate:fn=>pending.push(fn)};}};
const ee={Image:image,FeatureCollection:()=>fc,Filter:{eq:()=>({})},Geometry:{Point:()=>({})},Reducer:{first:()=>({})}};ee.Image.pixelLonLat=image;

const path=require('path'),cp=require('child_process');
const repo=path.resolve(__dirname,'../..');
const data=JSON.parse(fs.readFileSync(path.join(repo,'ch4_marginality/tests/profit_ui_fixture.json'),'utf8'));
const ctx={ui,ee,map,CH4_DATA:data,THEME:{pale:'#fff',body:'#333',ink:'#111',muted:'#777',primary:'#167',white:'#fff',line:'#ccc'},panel:widget(),navBar:widget(),viewSelect:widget({value:'map_view'}),eyebrow:widget({value:'original heading'}),appTitle:widget({value:'original title'}),appDesc:widget({value:'original description'}),mapChip:widget({value:'original chip'}),legend:widget(),switchView(){map.style().set('shown',true);},querySelectedLocation(){},kicker:t=>ui.Label(t),fieldLabel:t=>ui.Label(t),isFinite};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(repo,'ch4_marginality/gee_profit_controls.js'),'utf8'),ctx);
ctx.CH3_DATA=JSON.parse(JSON.stringify(ctx.CH4_DATA));
['counties','sensitivity','distributions','associations'].forEach(k=>delete ctx.CH3_DATA[k+'_columns']);delete ctx.CH3_DATA.county_columns;
ctx.CH3_DATA.budget_policy='closest_rotation';
Object.assign(ctx.CH3_DATA.eligibility.find(r=>r.year===2001),{eligible:true,strict_eligible:false,match_designation:'Approximate'});
ctx.CH3_DATA.costs.push({...ctx.CH3_DATA.costs.find(r=>r.year===2019&&r.source==='UNL'),year:2001,cash_cost_usd_ac:null});
ctx.CH3_DATA.sensitivity.push({...ctx.CH3_DATA.sensitivity.find(r=>r.year===2019&&r.source==='UNL'&&r.scenario==='M1_fixed'&&r.price_factor===1&&r.cost_factor===1),year:2001});
ctx.CH3_EXTRA={run_id:'test',manifest_sha256:'test',asset_prefix:'test',columns:['year','scenario','source','price_factor','cost_factor','profitable_ha','breakeven_ha','loss_ha','valid_ha','profitable_percent','profit_sd_usd_ac'],rows:[[2019,'M1_fixed','UNL',1,1,100,1,99,200,50,20]],common:[],transitions:[]};
const controller=cp.execFileSync(process.env.PYTHON||'python',['-X','utf8','-c','from ch3_profitability.build_app import controller_source; print(controller_source())'],{cwd:repo,encoding:'utf8'});
vm.runInContext(controller,ctx);
vm.runInContext(fs.readFileSync(path.join(repo,'ch3_profitability/gee_profitability_extension.js'),'utf8'),ctx);
function view(v){ctx.viewSelect.setValue(v,false);ctx.switchView(v);}
view('ch3_view');
assert.equal(ctx.ch3Active.year,2019);assert.equal(ctx.ch3Active.basis,'2021');assert.equal(ctx.ch3Active.source,'UNL');assert.equal(ctx.ch3Active.scenario,'M1_fixed');
assert.equal(ctx.ch3Active.policy,'closest_rotation');
assert.equal(ctx.appTitle.value,'Dryland corn profitability');assert.equal(ctx.ch3Cards.list[1].list[0].value,'Profitable crop area');
ctx.ch3Definition.setValue('profit_class');assert.ok(ctx.ch3Layer);
ctx.querySelectedLocation({lon:-96.4,lat:41.1});assert.equal(pending.length,1);
ctx.ch3Year.setValue('2021');pending.shift()({patch_id:123});assert.equal(pending.length,0);assert.equal(ctx.ch3SelectedId,null);
ctx.ch3Year.setValue('2019');ctx.ch3LoadPatch(123);pending.shift()({label_id:123});assert.equal(ctx.ch3SelectedId,123);assert.equal(pending.length,1);
ctx.ch3Year.setValue('2021');const before=ctx.ch3Patch.list.length;pending.shift()({m1_u_100_100_profit:5});assert.equal(ctx.ch3Patch.list.length,before,'stale CH3 class evidence ignored');
ctx.ch3Source.setValue('FINBIN_county');assert.equal(ctx.ch3Layer,null);
ctx.ch3Source.setValue('UNL');ctx.ch3Year.setValue('2001');assert.ok(ctx.ch3Layer,'closest policy enables an approximate original-year account');
ctx.ch3Policy.setValue('exact');assert.equal(ctx.ch3Layer,null,'strict policy blocks approximate economics');
ctx.ch3Definition.setValue('quartile');assert.ok(ctx.ch3Layer,'strict policy retains yield-only quartiles');
ctx.ch3Definition.setValue('return');ctx.ch3Policy.setValue('closest_rotation');
ctx.ch3Year.setValue('2003');assert.equal(ctx.ch3Active.row,null);
ctx.ch3Year.setValue('2019');ctx.ch3Source.setValue('ERS_Heartland');ctx.ch3Definition.setValue('cash');assert.equal(ctx.ch3Layer,null);
ctx.ch3Source.setValue('UNL');ctx.ch3Definition.setValue('return');ctx.ch3Section.setValue('Charts & tables');assert.equal(map.styles.shown,false);
view('ch4_view');assert.equal(ctx.appTitle.value,'Dryland corn economics');ctx.ch4Section.setValue('Charts & tables');assert.equal(map.styles.shown,false);
view('ch3_view');assert.equal(ctx.appTitle.value,'Dryland corn profitability');assert.equal(map.styles.shown,false);
view('ch4_view');assert.equal(map.styles.shown,false,'CH4 chart mode survives CH3 exit');assert.equal(ctx.appTitle.value,'Dryland corn economics');
view('map_view');assert.equal(ctx.appTitle.value,'original title');assert.equal(map.styles.shown,true);
const n=ctx.ch3Evidence.list.length;while(evidencePending.length)evidencePending.shift()([]);assert.equal(ctx.ch3Evidence.list.length,n,'inactive CH3 evidence cannot alter visible evidence');
console.log('CH3 UI contracts passed: independent defaults, positive-area cards, account gaps, cash missingness, stale pixel/patch callbacks and cross-chapter view restoration.');
