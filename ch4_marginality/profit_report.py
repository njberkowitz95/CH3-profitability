"""Export evidence charts and a workspace supplement from reconciled tables."""
from pathlib import Path
import json
import pandas as pd
import geopandas as gpd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import TwoSlopeNorm, LinearSegmentedColormap
from matplotlib.backends.backend_pdf import PdfPages
from .profit_workspace import RUN_ID,BASE_ID
from .pipeline import sha, dump

def run(root):
    out=Path(root)/'CH4_marginality'/RUN_ID
    data=json.loads((out/'app_data_profit.json').read_text())
    county=pd.read_csv(out/'tables/county_sensitivity.csv')
    base=Path(root)/'CH4_marginality'/BASE_ID
    geography=gpd.read_file(base/'CH4_spatial.gpkg',layer='county_aoi')
    geography.to_file(out/'CH4_spatial.gpkg',layer='county_aoi',driver='GPKG')
    gpd.GeoDataFrame(county.merge(geography[['zone','geometry']],on='zone'),geometry='geometry',crs=geography.crs).to_file(out/'CH4_spatial.gpkg',layer='county_economic_sensitivity',driver='GPKG')
    text=['CH4 Economics workspace: verified-input supplement',
          'Nebraska MLRA 106 dryland corn; version '+RUN_ID,
          'The analysis retains the original yield equations, 30 m EPSG:5070 grid, annual masks and native crop-patch identifiers. The new workspace derives maps, regional distributions, county evidence and patch sensitivity from the same locked input inventory.',
          'Closest rotation-matched policy enables verified original-year candidates with explicit no-till/geographic differences; strict mode retains 2019 and experimental 2021. 2003/2005/2007 remain blocked. The 2009 UNL total account is incomplete. Historical quartiles remain available.',
          'UNL uses the selected original-year corn-after-soybean budget, with exact or approximate designation recorded by year. ERS Heartland is a separate regional planted-acre scenario. FINBIN is an operator-account proxy; county and statewide geography and report counts remain distinct. Shared revenue uses Nebraska NASS crop-year marketing-year prices. ERS cash margin is unavailable.',
          'Return equals revenue minus source total costs. Cash margin uses defined cash costs only. Rates are dollars per acre; areas are hectares. CPI-U converts nominal values into constant 2021 dollars without changing marginality. Economic loss is return below zero. Yield marginality retains all values at or below the annual regional 25th percentile, including ties.',
          f'Raster distributions include explicit lower and upper saturated tails. Patch and county native areas and monetary totals reconcile to the AOI for all {len(data["sensitivity"])} source–model–price–cost combinations. Missing yield and source exclusions remain in denominators. Geometry identifies mapped annual crop units, not farm ownership.',
          'NCCPI uncertainty remains baseline only: 10 km blocks, 1,999 replicates, seed 20260928, with 5 km and 20 km sensitivity results. Producer-level economic observations are unavailable for independent profitability validation.',
          'Earth Engine table imports round numeric patch attributes. Imported totals differ from the original CSV by less than 0.001 ha, below one 0.09 ha native pixel. Full-precision CSV/GeoPackage evidence remains authoritative; raster identifiers are verified exactly.',
          'The 2019 crop-mask source differs from historical years. Experimental 2021 uses the LGRIP2020 proxy, has identical M1 and M2 yields, and is excluded from primary temporal summaries. No economic trend line bridges unavailable years.']
    cmap=LinearSegmentedColormap.from_list('profit',['#b35806','#f7f7f7','#2166ac'])
    for year in sorted({r['year'] for r in data['costs'] if r['source']=='UNL'}):
        base=[r for r in data['sensitivity'] if r['year']==year and r['scenario']=='M1_fixed' and r['source']=='UNL' and r['price_factor']==1 and r['cost_factor']==1][0]
        cost=[r for r in data['costs'] if r['year']==year and r['source']=='UNL'][0]; factor=cost['to_2021_dollars']
        bins=[r for r in data['distributions'] if r['year']==year and r['scenario']=='M1_fixed' and r['source']=='UNL' and r['price_factor']==1 and r['cost_factor']==1 and r['basis']=='2021' and r['metric']=='return'][0]['counts']
        rows=county.query('year==@year and scenario=="M1_fixed" and source=="UNL" and price_factor==1 and cost_factor==1').sort_values('return_usd_ac_mean')
        fig,ax=plt.subplots(1,3,figsize=(15,6),layout='constrained')
        labels=['<−1000']+[str(v) for v in range(-1000,1000,100)]+['≥1000']
        ticks=list(range(0,len(bins)-1,2))+[len(bins)-1]
        ax[0].bar(np.arange(len(bins)),np.asarray(bins)*.09,color='#2166ac');ax[0].set_xticks(ticks,[labels[i] for i in ticks],rotation=60,ha='right');ax[0].set_ylabel('Valid crop area (ha)');ax[0].set_xlabel('Return bin lower edge (2021 $/acre)');ax[0].set_title('Area-weighted distribution; tails retained')
        values=rows.return_usd_ac_mean*factor
        ax[1].barh(rows.NAME,values,color=['#b35806' if v<0 else '#2166ac' for v in values]);ax[1].axvline(0,color='#555555',lw=.6);ax[1].set_xlabel('Mean return (constant 2021 $/acre)');ax[1].set_title('County–AOI source-valid crop area')
        matrix=np.zeros((3,3));loss=np.zeros((3,3))
        for i,p in enumerate((.85,1,1.15)):
            for j,c in enumerate((.85,1,1.15)):
                r=[r for r in data['sensitivity'] if r['year']==year and r['scenario']=='M1_fixed' and r['source']=='UNL' and r['price_factor']==p and r['cost_factor']==c][0]
                matrix[i,j]=r['mean_return_usd_ac']*factor;loss[i,j]=100*r['loss_ha']/r['valid_ha']
        ax[2].imshow(matrix,cmap=cmap,norm=TwoSlopeNorm(vmin=-1000,vcenter=0,vmax=1000))
        for i in range(3):
            for j in range(3):ax[2].text(j,i,f'${matrix[i,j]:,.2f}/ac\n{loss[i,j]:.2f}% loss',ha='center',va='center',fontsize=10)
        ax[2].set_xticks(range(3),['−15%','Baseline','+15%']);ax[2].set_yticks(range(3),['−15%','Baseline','+15%']);ax[2].set_xlabel('Cost');ax[2].set_ylabel('Price');ax[2].set_title('Nine price–cost combinations')
        designation=cost.get('match_designation','Exact');budget=cost.get('budget_number',18)
        fig.suptitle(f'{year}'+(' · EXPERIMENTAL' if year==2021 else '')+f' · M1 · UNL #{int(budget)} · {designation} · baseline unless varied\nNebraska MLRA 106 dryland corn',fontsize=15)
        fig.supxlabel(str(cost.get('selected_unl_system','Eastern Nebraska dryland conventional corn after soybean'))+' · '+str(cost['geography'])+f'\nConstant 2021 $/acre. Valid area {base["valid_ha"]:,.2f} ha. Native 30 m grid. Sources: UNL, Nebraska NASS, CPI-U.',fontsize=8)
        for ext in ('png','pdf'):fig.savefig(out/f'figures/profit_evidence_{year}.{ext}',dpi=240)
        plt.close(fig)
        text.append(f'{year}: UNL budget {int(budget)}, {designation}; '+str(cost.get('selected_unl_system','Eastern Nebraska dryland conventional corn after soybean'))+'; '+str(cost['geography'])+'.')
        text.append(f'{year}'+(' experimental' if year==2021 else '')+f': baseline M1 UNL mean return ${base["mean_return_usd_ac"]*factor:,.2f}/acre in 2021 dollars; {base["loss_ha"]:,.2f} ha negative ({100*base["loss_ha"]/base["valid_ha"]:.2f}% of {base["valid_ha"]:,.2f} valid ha). Quartile area {base["quartile_ha"]:,.2f} ha; overlap {base["both_ha"]:,.2f} ha; disagreement {base["disagree_ha"]:,.2f} ha.')
    text.extend(['Original CH4 methods, source ledger, budget workbook and blocked-year register accompany this supplement.',
                 'Input manifest SHA-256: '+sha(out/'input_manifest.json'),
                 'UNL: https://cap.unl.edu/cropbudgets/ ; ERS: https://www.ers.usda.gov/data-products/commodity-costs-and-returns ; FINBIN: https://finbin.umn.edu/ ; Nebraska NASS: https://www.nass.usda.gov/Statistics_by_State/Nebraska/'])
    (out/'CH4_profit_workspace_methods_results.md').write_text('\n\n'.join(text),encoding='utf8')
    import textwrap
    with PdfPages(out/'CH4_profit_workspace_methods_results.pdf') as pdf:
        lines=[]
        for paragraph in text:lines.extend(textwrap.wrap(paragraph,95)+[''])
        for start in range(0,len(lines),49):
            fig=plt.figure(figsize=(8.5,11));fig.text(.08,.94,'\n'.join(lines[start:start+49]),va='top',fontsize=10,linespacing=1.5);pdf.savefig(fig);plt.close(fig)
    dump(out/'profit_report_manifest.json',{'source_manifest_sha256':sha(out/'input_manifest.json'),'exported_chart_years':sorted({r['year'] for r in data['costs'] if r['source']=='UNL'}),'economic_anchor_years':sorted({r['year'] for r in data['eligibility'] if r['eligible']}),'experimental_2021_separate':True})
    return out

if __name__=='__main__':
    import sys
    run(sys.argv[1] if len(sys.argv)>1 else 'G:/My Drive/PHD/CSP3_GPP_outputs')
