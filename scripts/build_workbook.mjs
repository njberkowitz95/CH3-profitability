import fs from 'node:fs/promises';
import path from 'node:path';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const out=process.argv[2];
const wb=Workbook.create();
const summary=wb.worksheets.add('Profit calculator');
const letters=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const tables={};
const specs=[['annual_profitability','Annual results'],['economic_scenarios','Economic inputs'],['year_eligibility','Eligibility'],['aoi_sensitivity','Sensitivity'],['county_sensitivity','County results'],['nccpi_associations','NCCPI uncertainty'],['common_valid_profit','Common pixels'],['profit_transitions','Transitions']];
for(const [stem,name] of specs){
  const csv=await fs.readFile(path.join(out,'tables',stem+'.csv'),'utf8');
  const imported=await Workbook.fromCSV(csv,{sheetName:name});
  let raw=imported.worksheets.getItem(name).getUsedRange().values;
  const header=raw[0];let rows=raw.slice(1).map(r=>r.map((v,j)=>{
    if(v===''||v==null)return null;
    if(typeof v!=='string')return v;
    if(header[j]==='GEOID')return v;
    if(v==='True'||v==='False')return v==='True';
    return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)?Number(v):v;
  }));
  if(stem==='county_sensitivity'){
    rows=rows.filter(r=>r[header.indexOf('price_factor')]===1&&r[header.indexOf('cost_factor')]===1);
  }
  const sheet=wb.worksheets.add(name);
  sheet.getRangeByIndexes(0,0,rows.length+1,header.length).values=[header,...rows];
  tables[stem]={header,rows:rows.map((r,i)=>Object.fromEntries([...header.map((h,j)=>[h,r[j]]),['_row',i+2]]))};
}
const annual=tables.annual_profitability.rows,inputs=tables.economic_scenarios;
const conversion=56*.45359237/1000*(10000/4046.8564224);
const headings=['Year','Source','Yield scenario','Mean yield Mg/ha','NASS USD/bu','Operator share','Total cost USD/acre','Revenue USD/acre','Profit USD/acre','2021 dollar factor','Profit 2021 USD/acre','Profitable ha','Breakeven ha','Loss ha','Valid ha','Positive-profit share','Budget match','Status'];
summary.getRangeByIndexes(0,0,annual.length+1,headings.length).values=[headings,...annual.map(r=>[r.year,r.source,r.scenario,r.yield_mean_Mg_ha,null,null,null,null,null,null,null,r.profitable_ha,r.breakeven_ha,r.loss_ha,r.valid_ha,null,r.match_designation,r.experimental?'EXPERIMENTAL 2021':'Primary'])];
for(let i=0;i<annual.length;i++){
  const row=i+2,r=annual[i],account=inputs.rows.find(c=>c.year===r.year&&c.source===r.source);
  if(!account)throw Error('Missing account '+r.year+' '+r.source);
  const ref=key=>`'Economic inputs'!${letters(inputs.header.indexOf(key))}${account._row}`;
  summary.getRange(`E${row}:K${row}`).formulas=[[`=${ref('nass_price_usd_bu')}`,`=${ref('operator_share')}`,`=${ref('total_cost_usd_ac')}`,`=D${row}/${conversion}*E${row}*F${row}`,`=H${row}-G${row}`,`=${ref('to_2021_dollars')}`,`=I${row}*J${row}`]];
  summary.getRange(`P${row}`).formulas=[[`=IF(O${row}>0,L${row}/O${row},"n.a.")`]];
}
const notes=wb.worksheets.add('Methods');
notes.getRange('A1:A8').values=[['Chapter 3 | Modeled crop profitability'],['Primary profit = grain revenue − total economic costs. Positive, exactly zero and negative unrounded returns are classified separately; missing observations remain missing.'],['Source: the locked input and output manifests in this release; original UNL/ERS/FINBIN records are in sources/ and CH4_source_budget_workbook.xlsx.'],['Economic inputs are distinct accounts. FINBIN is an operator-account proxy; ERS is regional. No-till and geographic budget approximations do not establish equivalence with conventional tillage.'],['2003/2005/2007 remain economically unavailable; 2009 UNL full returns and unsupported cash margins remain unavailable.'],['Experimental 2021 is outside primary temporal summaries. M1 and M2 are identical in 2021. The 2019 mask-source change and budget-system changes limit temporal interpretation.'],['The calculator reproduces mean rates from source inputs. Spatial area/class results are computed from native unrounded pixels; they cannot be inferred from the sign of the mean. Rerun the notebook to update spatial results.'],['Rates: USD/acre. Areas: hectares. Source-valid area is the economic class denominator. Changing annual footprints and common-valid-pixel summaries are separate.']];
for(const name of ['Profit calculator',...specs.map(s=>s[1]),'Methods']){
  const sheet=wb.worksheets.getItem(name),range=sheet.getUsedRange(),values=range.values;
  sheet.showGridLines=false;sheet.freezePanes.freezeRows(1);
  range.format.font.name='Aptos';range.format.font.size=11;range.format.columnWidth=19;range.format.rowHeight=22;
  sheet.getRangeByIndexes(0,0,1,values[0].length).format.fill='#173E55';
  sheet.getRangeByIndexes(0,0,1,values[0].length).format.font.color='#FFFFFF';
  sheet.getRangeByIndexes(0,0,1,values[0].length).format.font.bold=true;
  sheet.getRangeByIndexes(0,0,1,values[0].length).format.wrapText=true;
  sheet.getRangeByIndexes(0,0,1,values[0].length).format.rowHeight=58;
  if(values.length>1)for(let j=0;j<values[0].length;j++)if(values.slice(1).some(r=>typeof r[j]==='number'))sheet.getRangeByIndexes(1,j,values.length-1,1).setNumberFormat(/year|^Year$|^n$|_class$|block_m|replicates|^zone$/.test(values[0][j])?'0':'#,##0.00;[Red](#,##0.00);0.00');
}
summary.getRange(`B1:B${annual.length+1}`).format.columnWidth=23;summary.getRange(`C1:C${annual.length+1}`).format.columnWidth=25;
summary.getRange(`P2:P${annual.length+1}`).setNumberFormat('0.00%');
notes.getRange('A1:A8').format.columnWidth=110;notes.getRange('A1:A8').format.wrapText=true;notes.getRange('A1:A8').format.rowHeight=65;
wb.recalculate();
for(let i=0;i<annual.length;i++){
  const got=summary.getRange(`I${i+2}:K${i+2}`).values[0],expected=annual[i];
  if(!Number.isFinite(got[0])||!Number.isFinite(got[2])||Math.abs(got[0]-expected.profit_mean_usd_ac)>1e-8||Math.abs(got[2]-expected.profit_mean_usd_ac_2021dollars)>1e-8)throw Error('Formula mismatch '+i);
}
const first=annual[0],account=inputs.rows.find(c=>c.year===first.year&&c.source===first.source);
const priceCell=wb.worksheets.getItem('Economic inputs').getRange(`${letters(inputs.header.indexOf('nass_price_usd_bu'))}${account._row}`);
const originalPrice=priceCell.values[0][0];priceCell.values=[[originalPrice*1.15]];wb.recalculate();
const recalculated=summary.getRange('I2').values[0][0];
const expectedChanged=first.revenue_mean_usd_ac*1.15-account.total_cost_usd_ac;
if(!Number.isFinite(recalculated)||Math.abs(recalculated-expectedChanged)>1e-8)throw Error('Price-input recalculation failed');
priceCell.values=[[originalPrice]];wb.recalculate();
for(const name of ['Profit calculator',...specs.map(s=>s[1]),'Methods']){
  const values=wb.worksheets.getItem(name).getUsedRange().values;
  if(values.some(row=>row.some(v=>typeof v==='string'&&/^#(REF!|DIV\/0!|VALUE!|NAME\?|NUM!|N\/A|NULL!|SPILL!|CALC!)$/.test(v))))throw Error('Formula error on '+name);
}
await fs.mkdir(path.join(out,'verification'),{recursive:true});
const checks=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:10},maxChars:1200});
await fs.writeFile(path.join(out,'verification/workbook_check.json'),JSON.stringify({verified:true,calculator_rows:annual.length,price_input_recalculation_verified:true,original_price_restored:true,error_scan:checks.ndjson},null,2));
for(const name of ['Profit calculator',...specs.map(s=>s[1]),'Methods']){
  const preview=await wb.render({sheetName:name,range:name==='Methods'?'A1:A8':'A1:F7',scale:1,format:'png'});
  await fs.writeFile(path.join(out,'verification','workbook_'+name.replaceAll(' ','_')+'.png'),new Uint8Array(await preview.arrayBuffer()));
}
await (await SpreadsheetFile.exportXlsx(wb)).save(path.join(out,'CH3_profitability_workbook.xlsx'));
console.log('Workbook verified and exported:',annual.length,'account/model rows');
