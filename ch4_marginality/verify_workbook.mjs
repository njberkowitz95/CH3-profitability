import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=process.env.CH4_NODE_MODULES ?? path.join(path.dirname(fileURLToPath(import.meta.url)),'node_modules');
const require=createRequire(path.join(root,'ch4-artifact-anchor.cjs'));
const {FileBlob,SpreadsheetFile,Workbook}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
const out=process.argv[2];
const file=path.join(out,'CH4_budget_workbook.xlsx');
const create=process.argv.includes('--create');
const wb=create?Workbook.create():await SpreadsheetFile.importXlsx(await FileBlob.load(file));
let names=['Budget calculator','Year eligibility','Economic inputs','UNL line items','NASS prices','Deflator','Annual yield','Sensitivity','NCCPI uncertainty','County statistics','Common pixels','Transitions','Read me'];
let expected=[];
const tableHashes={};
const conversion=56*.45359237/1000*(10000/4046.8564224);
if(create){
 const calc=wb.worksheets.add('Budget calculator');
 const sources=[['sensitivity','Sensitivity'],['annual_yield','Annual yield'],['county_statistics','County statistics'],['nccpi_associations','NCCPI uncertainty'],['economic_persistence','Economic persistence'],['economic_common_valid','Economic common pixels'],['economic_transitions','Economic transitions'],['economic_transition_gaps','Economic gaps'],['common_valid_yield','Common pixels'],['quartile_transitions','Transitions'],['year_eligibility','Year eligibility'],['economic_scenarios','Economic inputs'],['unl_line_items','UNL line items'],['unl_cost_reconciliation','UNL reconciliation'],['unl_incomplete_accounts','Incomplete UNL accounts'],['finbin_eligibility','FINBIN eligibility'],['nass_prices','NASS prices'],['deflator','Deflator']];
 const tables={};
 const letters=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
 for(const [stem,name] of sources){
  const rawCsv=await fs.readFile(path.join(out,'tables',stem+'.csv'),'utf8');
  tableHashes[stem]=createHash('sha256').update(rawCsv).digest('hex');
  const imported=await Workbook.fromCSV(rawCsv,{sheetName:name});
  let raw=imported.worksheets.getItem(name).getUsedRange().values;
  if(stem==='year_eligibility'){
   const first=['year','match_designation','calculation_eligible','strict_eligible','budget_number','actual_system','geography','mismatch_fields','selection_rationale'];
   const order=[...first.filter(h=>raw[0].includes(h)),...raw[0].filter(h=>!first.includes(h))];
   const indices=order.map(h=>raw[0].indexOf(h));raw=raw.map(row=>indices.map(j=>row[j]));
  }
  const headers=raw[0];
  const rows=raw.slice(1).map(row=>row.map((v,j)=>{
   if(v===''||v===null)return null;
   if(typeof v!=='string')return v;
   if(['GEOID','sha256','source_sha256','field_id','patch_id'].includes(headers[j]))return v;
   if(v==='True'||v==='False')return v==='True';
   return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)?Number(v):v;
  }));
  const sheet=wb.worksheets.add(name);sheet.getRangeByIndexes(0,0,rows.length+1,headers.length).values=[headers,...rows];
  sheet.freezePanes.freezeRows(1);
  tables[stem]={headers,records:rows.map((r,i)=>Object.fromEntries([...headers.map((h,j)=>[h,r[j]]),['_row',i+2]]))};
 }
 const inputs=tables.economic_scenarios;
 expected=tables.sensitivity.records.filter(r=>r.price_factor===1&&r.cost_factor===1).map(r=>({r,c:inputs.records.find(c=>c.year===r.year&&c.source===r.source)}));
 const headers=['Year','Source','Yield scenario','NASS USD/bu','Cash cost USD/acre','Total cost USD/acre','Operator share','Mean yield Mg/ha','Revenue USD/acre','Cash margin USD/acre','Total return USD/acre','Breakeven bu/acre','Original-year anchor','Result status','Budget match','UNL budget number','Selected UNL system'];
 calc.getRangeByIndexes(0,0,expected.length+1,headers.length).values=[headers,...expected.map(({r,c})=>[r.year,r.source,r.scenario,c.nass_price_usd_bu,c.cash_cost_usd_ac,c.total_cost_usd_ac,c.operator_share,r.mean_revenue_usd_ac/(c.nass_price_usd_bu*c.operator_share)*conversion,null,null,null,null,true,r.year===2021?'EXPERIMENTAL 2021':'Primary '+r.year,c.match_designation,c.budget_number,c.selected_unl_system])];
 for(let i=0;i<expected.length;i++){
  const row=i+2,c=expected[i].c;
  const input=name=>`'Economic inputs'!${letters(inputs.headers.indexOf(name))}${c._row}`;
  calc.getRange(`D${row}:G${row}`).formulas=[[`=${input('nass_price_usd_bu')}`,`=IF(ISNUMBER(${input('cash_cost_usd_ac')}),${input('cash_cost_usd_ac')},"n.a.")`,`=${input('total_cost_usd_ac')}`,`=${input('operator_share')}`]];
  calc.getRange(`I${row}:L${row}`).formulas=[[`=H${row}/${conversion}*D${row}*G${row}`,`=IF(ISNUMBER(E${row}),I${row}-E${row},"n.a.")`,`=I${row}-F${row}`,`=F${row}/(D${row}*G${row})`]];
 }
 const readme=wb.worksheets.add('Read me');
 const notes=['CH4 modeled dryland corn returns under original-year budget assumptions','Currency: USD/acre. Areas: hectares. Yield: Mg/ha. Blank source values and n.a. results are unavailable, never zero.','Closest rotation-matched budgets prioritize dryland corn after soybean. Approximate no-till/geographic differences remain explicit. Exact policy permits 2019 and experimental 2021 only.','2003, 2005 and 2007: originals unrecovered; economics unavailable. 2009: original UNL field/material subtotal is incomplete; full UNL return unavailable.','2001: combined ownership/opportunity accounts prevent cash-cost separation. FINBIN operator accounts and ERS planted-acre regional costs retain separate definitions.','Editing Economic inputs recalculates the calculator; mapped loss areas and the nine-combination sensitivity table require rerunning the raster analysis.','2021 is experimental, outside primary temporal summaries. Gaps and production-system changes remain explicit. CPI conversion does not change marginality classifications.','Original-byte checksums, selected pages, prices, CPI and reconciliation accompany the input tables and report.'];
 readme.getRange('A1:A8').values=notes.map(n=>[n]);
 names=['Budget calculator',...sources.map(d=>d[1]),'Read me'];
}
await fs.mkdir(path.join(out,'verification'),{recursive:true});
for (const name of names) {
 const s=wb.worksheets.getItem(name); s.showGridLines=false;
 s.getUsedRange().format.font={name:'Arial',size:10};
 s.getUsedRange().format.wrapText=true;
 s.getUsedRange().format.columnWidth=24;
 s.getUsedRange().format.rowHeight=34;
 const columns=s.getUsedRange().values[0].length;
 s.getRangeByIndexes(0,0,1,columns).format={fill:'#173E55',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:62,wrapText:true};
 if(name==='Budget calculator') {s.getRange('B1:C15').format.columnWidth=25;s.getRange('N1:N15').format.columnWidth=26;}
 if(name==='Year eligibility') {s.getUsedRange().format.rowHeight=90;s.getRange('C:C').format.columnWidth=38;s.getRange('E:E').format.columnWidth=66;s.getRange('G:G').format.columnWidth=52;}
 if(name==='Economic inputs') {s.getUsedRange().format.rowHeight=82;s.getRange('H:H').format.columnWidth=40;}
 if(name==='Read me') {s.getRange('A1:A8').format.columnWidth=115;s.getRange('A1:A8').format.rowHeight=52;s.getRange('A1').format.fill='#FFFFFF';s.getRange('A1').format.font.color='#173E55';}
 if(name!=='Read me'){
  const rows=s.getUsedRange().values;
  for(let j=0;j<columns;j++)if(rows.slice(1).some(r=>typeof r[j]==='number'))s.getRangeByIndexes(1,j,rows.length-1,1).setNumberFormat(/year|budget_number|pdf_page|printed_page|count|pixel|replicates|block_m|sample_n|^n$|^zone$|^report$|seasons|_class$/i.test(String(rows[0][j]))?'0':'#,##0.00;[Red](#,##0.00);0.00');
 }
}
const inputSheet=wb.worksheets.getItem('Economic inputs');
inputSheet.getUsedRange().format.font.color='#0000FF';
inputSheet.getRangeByIndexes(0,0,1,inputSheet.getUsedRange().values[0].length).format.font.color='#FFFFFF';
wb.recalculate();
const calc=wb.worksheets.getItem('Budget calculator');
const end=expected.length?expected.length+1:15;
const baseline=calc.getRange(`I2:L${end}`).values;
for(let i=0;i<expected.length;i++){
 const {r,c}=expected[i],v=baseline[i];
 if(Math.abs(v[0]-r.mean_revenue_usd_ac)>1e-8||Math.abs(v[2]-r.mean_return_usd_ac)>1e-8)throw Error('Formula/source mismatch '+i);
 if(c.cash_cost_usd_ac===null&&v[1]!=='n.a.')throw Error('Missing cash became zero');
 if(Math.abs(v[3]-c.total_cost_usd_ac/(c.nass_price_usd_bu*c.operator_share))>1e-8)throw Error('Breakeven mismatch');
}
const priceTarget=create?inputSheet.getCell(expected[0].c._row-1,inputSheet.getUsedRange().values[0].indexOf('nass_price_usd_bu')):calc.getRange('D2');
const price=priceTarget.values[0][0];
const revenue=baseline[0][0];
if(typeof revenue!=='number')throw Error('Revenue not calculated');
priceTarget.values=[[price*1.15]];wb.recalculate();
if(Math.abs(calc.getRange('I2').values[0][0]-revenue*1.15)>1e-8)throw Error('Price sensitivity failed');
priceTarget.values=[[price]];wb.recalculate();
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},maxChars:2500});
await fs.writeFile(path.join(out,'verification/workbook_formulas.json'),JSON.stringify({verified:true,engine:'@oai/artifact-tool',calculator_rows:end-1,price_sensitivity:true,source_table_sha256:tableHashes,baseline,error_scan:errors.ndjson},null,2));
for(const name of names){
 const range=name==='Read me'?'A1:A8':'A1:F6';
 const png=await wb.render({sheetName:name,range,scale:1,format:'png'});
 await fs.writeFile(path.join(out,'verification',name.replaceAll(' ','_')+'.png'),new Uint8Array(await png.arrayBuffer()));
}
await (await SpreadsheetFile.exportXlsx(wb)).save(file);
console.log('Recalculated workbook, reconciled',end-1,'calculator rows, rendered',names.length,'sheets:',file);
