"""Comparable publication maps with explicit missingness, CRS and scale."""
from pathlib import Path
import numpy as np
import pandas as pd
import rasterio
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap, ListedColormap, BoundaryNorm, TwoSlopeNorm
from matplotlib.patches import Patch


def run(out: Path) -> None:
    out=Path(out);rows=pd.read_csv(out/'tables/annual_profitability.csv')
    accounts=pd.read_csv(out/'tables/economic_scenarios.csv')
    continuous=LinearSegmentedColormap.from_list('profit',['#b35806','#f7f7f7','#2166ac']);continuous.set_bad('#dedede')
    classes=ListedColormap(['#b35806','#999999','#2166ac']);classes.set_bad('#dedede')
    sequential=plt.get_cmap('Blues').copy();sequential.set_bad('#dedede')
    def layer(ax,path,cmap,norm):
        with rasterio.open(path) as src:
            a=src.read(1,out_shape=(900,921),masked=True);b=src.bounds
        im=ax.imshow(a,cmap=cmap,norm=norm,extent=[b.left,b.right,b.bottom,b.top],interpolation='nearest')
        ax.set_axis_off()
        x=b.left+.08*(b.right-b.left);y=b.bottom+.08*(b.top-b.bottom)
        ax.plot([x,x+50000],[y,y],color='#222',lw=2);ax.text(x+25000,y+3500,'50 km',ha='center',fontsize=8)
        return im
    def save(fig,name):
        fig.savefig(out/'figures'/f'{name}.png',dpi=300,bbox_inches='tight')
        fig.savefig(out/'figures'/f'{name}.pdf',bbox_inches='tight');plt.close(fig)
    for (year,source),group in rows.groupby(['year','source']):
        account=accounts[(accounts.year==year)&(accounts.source==source)].iloc[0]
        for metric in ['profit','profit_class']:
            fig,axes=plt.subplots(1,2,figsize=(11,6));fig.subplots_adjust(bottom=.16,right=.85,top=.85)
            for ax,row in zip(axes,group.sort_values('scenario').to_dict('records')):
                stem=f'{year}_{row["scenario"]}_{source}'
                path=out/'rasters'/(f'profit_{stem}_2021.tif' if metric=='profit' else f'profit_class_{stem}_p1.00_c1.00.tif')
                im=layer(ax,path,continuous if metric=='profit' else classes,TwoSlopeNorm(vmin=-1000,vcenter=0,vmax=1000) if metric=='profit' else BoundaryNorm([-1.5,-.5,.5,1.5],3))
                ax.set_title(row['scenario'],fontsize=11)
            if metric=='profit':
                bar=fig.colorbar(im,ax=axes,shrink=.75,extend='both',label='2021 USD/acre')
                bar.set_ticks([-1000,-500,0,500,1000]);bar.set_ticklabels(['≤ −1,000','−500','0','500','≥ 1,000'])
            else:
                fig.legend(handles=[Patch(color=c,label=l) for c,l in [('#b35806','Loss < 0'),('#999999','Breakeven = 0'),('#2166ac','Profit > 0')]],loc='lower center',bbox_to_anchor=(.5,.075),ncol=3)
            fig.suptitle(f'{year} · {source} · '+('Modeled profit' if metric=='profit' else 'Unrounded profitability classes')+(' · EXPERIMENTAL' if year==2021 else ''),fontsize=14)
            fig.text(.08,.025,'Nebraska MLRA 106 · EPSG:5070 · native 30 m grid · baseline price/cost · gray: no valid crop observation\n'+f'UNL #{int(account.budget_number)} anchor: {account.match_designation}; {account.selected_unl_system}\nAccount geography: {account.geography}'+(' · FINBIN operator-account proxy' if source.startswith('FINBIN') else ''),fontsize=7.5)
            save(fig,('profit_maps_' if metric=='profit' else 'profit_class_maps_')+f'{year}_{source}')
    for policy in ['closest_rotation','exact']:
        for source in sorted(rows.source.unique()):
            fig,axes=plt.subplots(1,2,figsize=(11,6));fig.subplots_adjust(bottom=.13,top=.85)
            for ax,scenario in zip(axes,['M1_fixed','M2_HI_sensitivity']):
                im=layer(ax,out/f'rasters/profitable_frequency_{scenario}_{source}_{policy}.tif',sequential,plt.Normalize(0,1));ax.set_title(scenario)
            fig.colorbar(im,ax=axes,shrink=.75,label='Fraction of observed eligible seasons with profit > 0')
            fig.suptitle(f'Primary-season profitability frequency · {source} · {policy}',fontsize=13)
            fig.text(.08,.035,'Nebraska MLRA 106 · EPSG:5070 · native 30 m grid · baseline · 2021 excluded\nGray: no eligible observations. Refer to observation-count raster; frequency is not a predicted probability.'+('\nExact policy has one primary year (2019); this is not multi-season persistence.' if policy=='exact' else ''),fontsize=8)
            save(fig,f'profit_frequency_{source}_{policy}')
