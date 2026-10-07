"""Publication evidence charts from completed, reconciled Chapter 3 tables."""
from pathlib import Path
import textwrap
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import TwoSlopeNorm, LinearSegmentedColormap


def run(out: Path) -> None:
    """Export source/model-specific sensitivities, overlap, counties and uncertainty."""
    out=Path(out)
    aoi=pd.read_csv(out/'tables/aoi_sensitivity.csv')
    county=pd.read_csv(out/'tables/county_sensitivity.csv')
    bins=pd.read_csv(out/'tables/distribution_bins.csv')
    associations=pd.read_csv(out/'tables/nccpi_associations.csv')
    baseline=aoi[(aoi.price_factor==1)&(aoi.cost_factor==1)]
    accounts=pd.read_csv(out/'tables/economic_scenarios.csv')
    cmap=LinearSegmentedColormap.from_list('profit',['#b35806','#f7f7f7','#2166ac'])
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
    def save(fig,name):
        fig.text(.02,-.15,textwrap.fill(context,140),fontsize=7,va='top')
        fig.savefig(out/'figures'/f'{name}.png',dpi=300,bbox_inches='tight')
        fig.savefig(out/'figures'/f'{name}.pdf',bbox_inches='tight');plt.close(fig)
    for r in baseline.to_dict('records'):
        year,scenario,source=r['year'],r['scenario'],r['source']
        stem=f'{year}_{scenario}_{source}'
        title=f'{year} · {scenario} · {source}'+(' · EXPERIMENTAL' if year==2021 else '')
        if source.startswith('FINBIN'):title+=' · operator-account proxy'
        account=accounts[(accounts.year==year)&(accounts.source==source)].iloc[0]
        context=f"UNL #{int(account.budget_number)} anchor: {account.match_designation}; {account.selected_unl_system}. Account geography: {account.geography}. Rates: 2021 USD/acre; area shares use source-valid hectares."
        g=aoi[(aoi.year==year)&(aoi.scenario==scenario)&(aoi.source==source)]
        mat=g.pivot(index='price_factor',columns='cost_factor',values='profit_mean_usd_ac_2021dollars')
        fig,ax=plt.subplots(figsize=(6,5));im=ax.imshow(mat,cmap=cmap,norm=TwoSlopeNorm(vmin=-1000,vcenter=0,vmax=1000))
        for i,pf in enumerate(mat.index):
            for j,cf in enumerate(mat.columns):
                row=g[(g.price_factor==pf)&(g.cost_factor==cf)].iloc[0]
                ax.text(j,i,f'${mat.iloc[i,j]:,.2f}/ac\n{row.profitable_percent:.1f}% profitable',ha='center',va='center',fontsize=9)
        ax.set_xticks(range(3),['−15%','Baseline','+15%']);ax.set_yticks(range(3),['−15%','Baseline','+15%'])
        ax.set(xlabel='Cost adjustment',ylabel='Price adjustment',title=title)
        fig.colorbar(im,ax=ax,label='Mean profit (2021 USD/acre)',extend='both');save(fig,f'sensitivity_{stem}')
        c=county[(county.year==year)&(county.scenario==scenario)&(county.source==source)&(county.price_factor==1)&(county.cost_factor==1)]
        c=c.sort_values('profit_mean_usd_ac_2021dollars')
        fig,axes=plt.subplots(1,2,figsize=(11,6),sharey=True)
        axes[0].barh(c.NAME,c.profit_mean_usd_ac_2021dollars,color=['#2166ac' if v>0 else '#b35806' for v in c.profit_mean_usd_ac_2021dollars]);axes[0].axvline(0,color='#777',lw=.7)
        axes[1].barh(c.NAME,c.profitable_percent,color='#2166ac');axes[1].set_xlim(0,100)
        axes[0].set_xlabel('Mean profit (2021 USD/acre)');axes[1].set_xlabel('Profitable share of valid area (%)');fig.suptitle(title+' · baseline county–AOI results');save(fig,f'counties_{stem}')
        labels=['Loss / nonquartile','Loss / quartile','Breakeven / nonquartile','Breakeven / quartile','Profit / nonquartile','Profit / quartile']
        fields=['loss_nonquartile_ha','loss_quartile_ha','breakeven_nonquartile_ha','breakeven_quartile_ha','profitable_nonquartile_ha','profitable_quartile_ha']
        fig,ax=plt.subplots(figsize=(8,4));ax.barh(labels,[r[k] for k in fields],color=['#b35806','#e69f00','#777777','#bbbbbb','#2166ac','#67a9cf']);ax.set(xlabel='Native area (ha)',title=title+' · profitability × yield quartile');save(fig,f'quartile_overlap_{stem}')
        b=bins[(bins.year==year)&(bins.scenario==scenario)&(bins.source==source)&(bins.price_factor==1)&(bins.cost_factor==1)&(bins.metric=='profit')&(bins.basis.astype(str)=='2021')]
        fig,ax=plt.subplots(figsize=(11,4));ax.bar(b.label,b.area_ha,color='#2166ac');ax.tick_params(axis='x',labelrotation=65,labelsize=8);ax.set(xlabel='2021 USD/acre (tails retained)',ylabel='Native area (ha)',title=title+' · baseline profit distribution');save(fig,f'distribution_{stem}')
        assoc=associations[(associations.year==year)&(associations.scenario==scenario)&(associations.source==source)]
        fig,ax=plt.subplots(figsize=(8,4))
        for i,x in enumerate(assoc.to_dict('records')):
            if np.isfinite(x['r']):
                ax.plot(x['r'],i,'o',color='#2166ac')
                if np.isfinite(x['ci_low']) and np.isfinite(x['ci_high']):ax.plot([x['ci_low'],x['ci_high']],[i,i],color='#2166ac')
        ax.set_yticks(range(len(assoc)),[f'{x.metric} · {x.block_m/1000:g} km' for x in assoc.itertuples()]);ax.axvline(0,color='#777',lw=.7);ax.set(xlim=(-1,1),xlabel='Correlation and 95% spatial-block interval',title=title+' · baseline NCCPI association');save(fig,f'nccpi_{stem}')
