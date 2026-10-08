"""Academic tables, maps, report, and app payload from one completed run."""
from pathlib import Path
import json
import shutil
import sqlite3
from contextlib import closing
import numpy as np
import pandas as pd
import rasterio
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import TwoSlopeNorm, LinearSegmentedColormap
from ch4_marginality.pipeline import dump, sha
from ch4_marginality.final_checks import records


def run(root: Path, out: Path, prior: Path, spatial_path: Path | None = None) -> None:
    """Export precise source-linked results with fixed comparable map scales."""
    data=pd.read_csv(out/'tables/aoi_sensitivity.csv',float_precision='round_trip')
    baseline=data[(data.price_factor==1)&(data.cost_factor==1)]
    baseline.to_csv(out/'tables/annual_profitability.csv',index=False)
    county=pd.read_csv(out/'tables/county_sensitivity.csv')
    if spatial_path is None:
        raise ValueError('A local staged GeoPackage is required; do not transact on mounted Drive')
    with closing(sqlite3.connect(spatial_path)) as con, con:
        baseline.to_sql('annual_profitability',con,index=False,if_exists='replace')
        county.to_sql('county_sensitivity',con,index=False,if_exists='replace')
        first=True
        for chunk in pd.read_csv(out/'tables/patch_sensitivity.csv.gz',chunksize=50000):
            chunk.to_sql('patch_sensitivity',con,index=False,if_exists='replace' if first else 'append')
            first=False
        con.execute('CREATE INDEX IF NOT EXISTS ch3_patch_lookup ON patch_sensitivity(year,patch_id,scenario,source,price_factor,cost_factor)')
        for table in ['annual_profitability','county_sensitivity','patch_sensitivity']:
            con.execute("INSERT OR REPLACE INTO gpkg_contents(table_name,data_type,identifier,description) VALUES (?, 'attributes', ?, ?)",
                        (table,table,'Chapter 3 modeled profitability; missing values retained'))
        con.commit()
        if con.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('GeoPackage integrity failed')
    from .recover_release import publish_closed_file
    publish_closed_file(spatial_path,out/'CH3_spatial.gpkg')
    # Preserve the populated original source workbook, with its original labels.
    shutil.copy2(prior/'CH4_budget_workbook.xlsx',out/'CH4_source_budget_workbook.xlsx')
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
    cmap=LinearSegmentedColormap.from_list('profit',['#b35806','#f7f7f7','#2166ac'])
    def save(fig,name):
        fig.savefig(out/'figures'/f'{name}.png',dpi=300,bbox_inches='tight')
        fig.savefig(out/'figures'/f'{name}.pdf',bbox_inches='tight');plt.close(fig)
    for (year,source), group in baseline.groupby(['year','source']):
        fig,axes=plt.subplots(1,2,figsize=(11,5))
        for ax,row in zip(axes,group.sort_values('scenario').to_dict('records')):
            with rasterio.open(out/f'rasters/profit_{year}_{row["scenario"]}_{source}_2021.tif') as src:
                a=src.read(1,out_shape=(900,921),masked=True)
                bounds=src.bounds
            im=ax.imshow(a,cmap=cmap,norm=TwoSlopeNorm(vmin=-1000,vcenter=0,vmax=1000),extent=[bounds.left,bounds.right,bounds.bottom,bounds.top])
            ax.set_title(row['scenario']);ax.set_axis_off()
        fig.colorbar(im,ax=axes,shrink=.8,extend='both',label='Modeled profit / account proxy (2021 USD/acre)')
        fig.suptitle(f'Chapter 3 | {year} {source}'+(' | EXPERIMENTAL' if year==2021 else ''))
        fig.text(.12,.01,'Nebraska MLRA 106 · EPSG:5070 · baseline price/cost · '+group.match_designation.iloc[0]+' UNL anchor',fontsize=8)
        save(fig,f'profit_maps_{year}_{source}')
    fig,ax=plt.subplots(figsize=(10,5))
    for (source,scenario),g in baseline[baseline.year<2021].groupby(['source','scenario']):
        ax.scatter(g.year,g.profit_mean_usd_ac_2021dollars,label=f'{source} · {scenario}',s=30)
    ax.axhline(0,color='#777',lw=.8);ax.set(xlabel='Production year (gaps retained)',ylabel='Mean modeled profit (2021 USD/acre)',title='Primary-year profitability by account and yield scenario')
    ax.legend(fontsize=7,ncol=2);save(fig,'primary_profitability')
    for year in [2019,2021]:
        g=baseline[(baseline.year==year)&(baseline.scenario=='M1_fixed')]
        fig,ax=plt.subplots(figsize=(9,4));left=np.zeros(len(g))
        for field,color in [('loss_percent','#b35806'),('breakeven_percent','#999999'),('profitable_percent','#2166ac')]:
            ax.barh(g.source,g[field],left=left,color=color,label=field.replace('_percent',''));left+=g[field].to_numpy()
        ax.set(xlim=(0,100),xlabel='Share of valid economic area (%)',title=f'{year} · M1 · baseline'+(' · EXPERIMENTAL' if year==2021 else ''))
        ax.legend();save(fig,f'profit_classes_{year}')
    payload=json.loads((prior/'app_data_profit.json').read_text(encoding='utf-8'))
    payload.update(chapter=3,run_id=out.name,profitability=records(data),profit_counties=records(county),
                   profit_associations=records(pd.read_csv(out/'tables/nccpi_associations.csv')),
                   profit_transitions=records(pd.read_csv(out/'tables/profit_transitions.csv')),
                   profit_persistence=records(pd.read_csv(out/'tables/profit_persistence.csv')),
                   profit_common_valid=records(pd.read_csv(out/'tables/common_valid_profit.csv')),
                   input_manifest_sha256=sha(out/'input_manifest.json'))
    dump(out/'app_data_profitability.json',payload)
    primary=baseline[(baseline.year<2021)&(baseline.source=='UNL')& (baseline.scenario=='M1_fixed')]
    text='''# Chapter 3: Spatial and Temporal Crop Profitability

## Methods

This analysis reuses the verified Chapter 4 crop yields, source accounts, masks and 30 m EPSG:5070 grid. Profit equals grain revenue minus published total per-acre costs. Positive, exactly zero and negative unrounded returns are classified separately; missing observations are never zero. Cash margins are supplementary and remain unavailable where costs cannot be separated. Prices are Nebraska NASS crop-year marketing-year prices; constant dollars use annual CPI-U relative to 2021.

Closest rotation-matched original-year budgets are the default, with no-till and geographic mismatches explicit. Strict mode retains exact matches only. 2003, 2005 and 2007 remain unavailable economically; 2009 UNL full returns remain unavailable. ERS is a regional accounting scenario. FINBIN accounts are operator-account proxies with distinct county/state geography and sample limits, not complete economic profit observations.

All nine price–cost combinations retain −15%, baseline and +15%. Native pixels represent 0.09 ha; monetary totals multiply per-acre rates by hectares and 10000/4046.8564224. County and annual mapped-patch summaries reconcile with regional totals. Patch and pixel identities are inherited from the locked CH4 release and do not imply ownership. Coverage uses mapped crop area as denominator, including unavailable yield and out-of-scope account area; economic class shares use source-valid area.

Temporal results are baseline, retain observation counts and source-specific gaps, and never bridge missing biennial observations. Experimental 2021 is excluded. The 2019 crop-mask source change and budget-system changes constrain comparisons. NCCPI associations use 1,999 spatial-block bootstrap replicates, seed 20260928, with 10 km blocks and 5/20 km sensitivity. Continuous-profit associations follow yield algebraically where costs and prices are spatially uniform. No independent producer-level profitability validation is claimed.

## Results

'''
    text+=primary[['year','profit_mean_usd_ac_2021dollars','profitable_ha','profitable_percent','loss_percent','valid_ha']].to_markdown(index=False)
    text+='\n\nPrimary table: M1, UNL, baseline, constant-2021-dollar rates. Experimental 2021 and other accounts are in separate tables. The complete sensitivity tables, rather than this selected table, are authoritative.\n'
    text+='\n## Sources and interpretation\n\nOriginal UNL publications, transcriptions, ERS and FINBIN source accounts, NASS prices and BLS CPI records are preserved in sources/ and the source budget workbook. Methods derive from Brandes et al. (2016), doi:10.1088/1748-9326/11/1/014009, and Kinoshita et al. (2016), doi:10.2134/ael2016.09.0034; these support spatial profitability accounting, not equivalence between management systems. See the source ledger and Chapter 4 methods for the retained source limitations.\n'
    (out/'CH3_methods_results.md').write_text(text,encoding='utf-8')
    from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Image
    from reportlab.lib.styles import getSampleStyleSheet
    from xml.sax.saxutils import escape
    styles=getSampleStyleSheet();story=[]
    for paragraph in text.split('\n\n'):
        if paragraph.startswith('|'): continue
        story.extend([Paragraph(escape(paragraph).replace('\n','<br/>'),styles['Heading2'] if paragraph.startswith('#') else styles['BodyText']),Spacer(1,10)])
    for name in ['primary_profitability','profit_classes_2019','profit_classes_2021']:
        story.append(Image(str(out/'figures'/f'{name}.png'),width=470,height=235))
    SimpleDocTemplate(str(out/'CH3_methods_results.pdf')).build(story)
