"""Export publication figures and baseline constant-dollar COGs from locked inputs."""
from pathlib import Path
import json, shutil
import numpy as np
import pandas as pd
import geopandas as gpd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap,Normalize
from .pipeline import read,paths,cog,TRANSFORM,SHAPE,sha,dump
from .profit_workspace import RUN_ID,BASE_ID
from .core import MGHA_PER_BUAC

def run(root):
    root=Path(root);out=root/'CH4_marginality'/RUN_ID;base=root/'CH4_marginality'/BASE_ID
    (out/'figures').mkdir(exist_ok=True)
    costs=pd.read_csv(base/'tables/economic_scenarios.csv')
    counties=gpd.read_file(base/'CH4_spatial.gpkg',layer='county_aoi')
    extent=(TRANSFORM.c,TRANSFORM.c+SHAPE[1]*30,TRANSFORM.f-SHAPE[0]*30,TRANSFORM.f)
    diverging=LinearSegmentedColormap.from_list('return',['#b35806','#f7f7f7','#2166ac'])
    sequential=LinearSegmentedColormap.from_list('revenue',['#f7fcf0','#7bccc4','#084081'])
    for year in sorted(costs.loc[costs.source=='UNL','year'].unique()):
        c=costs.query('year==@year and source=="UNL"').iloc[0]
        yp,mp,_=paths(root,year,'M1_fixed')        y=read(yp).astype(float)        y=np.where((read(mp)==1)&np.isfinite(y)&(y>=0),y,np.nan)
        rev=y/MGHA_PER_BUAC*c.nass_price_usd_bu
        arrays=[(rev-c.total_cost_usd_ac)*c.to_2021_dollars,(rev-c.cash_cost_usd_ac)*c.to_2021_dollars,rev*c.to_2021_dollars]
        fig,axes=plt.subplots(1,3,figsize=(15,7),layout='constrained')
        for ax,title,a in zip(axes,['Total economic return','Cash margin','Revenue'],arrays):
            cmap=sequential if title=='Revenue' else diverging;vmin,vmax=(0,2000) if title=='Revenue' else (-1000,1000)
            # Display sampling only; all calculations and exported COGs retain            # the unchanged native 30 m array.            im=ax.imshow(a[::4,::4],extent=extent,cmap=cmap,vmin=vmin,vmax=vmax,interpolation='nearest')
            counties.boundary.plot(ax=ax,color='#555555',linewidth=.4)
            ax.set_title(title+(' · unavailable' if not np.isfinite(a).any() else ''),fontsize=12);ax.set_aspect('equal');ax.set_facecolor('#eceeea')
            ax.tick_params(labelsize=8);ax.set_xlabel('Easting (EPSG:5070; m)',fontsize=8)
            cb=fig.colorbar(im,ax=ax,orientation='horizontal',fraction=.045,pad=.03,extend='max' if title=='Revenue' else 'both')
            cb.set_label('Constant 2021 $/acre; saturated map tails',fontsize=8)
            ax.annotate('N',xy=(.92,.94),xytext=(.92,.83),xycoords='axes fraction',ha='center',arrowprops={'arrowstyle':'-|>','color':'#333333'})
            x0=extent[0]+10000;y0=extent[2]+10000;ax.plot([x0,x0+20000],[y0,y0],color='#222222',lw=3);ax.text(x0+10000,y0+2000,'20 km',ha='center',fontsize=8)
            cog(out/f'rasters/{year}_M1_UNL_{title.lower().replace(" ","_")}_2021dollars.tif',a,title+'; constant 2021 USD/acre; baseline')
        axes[0].set_ylabel('Northing (EPSG:5070; m)',fontsize=8)
        fig.suptitle(f'Nebraska MLRA 106 dryland corn · {year}'+(' · EXPERIMENTAL' if year==2021 else '')+f'\nM1 · UNL original-year budget {int(c.budget_number)} · {c.match_designation} · baseline',fontsize=14)
        fig.supxlabel(str(c.get('selected_unl_system','Eastern Nebraska dryland conventional corn after soybean'))+' · '+str(c.geography)+'\n30 m verified yield grid. Gray = no valid observation. Sources: UNL, Nebraska NASS, CPI-U; CH4 locked inventory.',fontsize=8)
        for ext in ['png','pdf']:fig.savefig(out/f'figures/profit_maps_{year}.{ext}',dpi=250)
        plt.close(fig);print('Publication profit map',year,flush=True)
    for name in ['CH4_budget_workbook.xlsx','CH4_methods_results.pdf','CH4_methods_results.md']:
        shutil.copy2(base/name,out/name)
    for name in ['economic_scenarios.csv','year_eligibility.csv','nccpi_associations.csv','source_audit.csv','sensitivity.csv','annual_yield.csv']:
        if (base/'tables'/name).exists():shutil.copy2(base/'tables'/name,out/'tables'/name)
    shutil.copytree(base/'sources',out/'sources',dirs_exist_ok=True)
    dump(out/'publication_figures.json',dict(verified=True,source_run=BASE_ID,map_years=sorted(int(y) for y in costs.loc[costs.source=='UNL','year'].unique()),native_cogs=3*int((costs.source=='UNL').sum()),
                                           rates='constant 2021 USD per acre',areas='hectares',source='UNL',scenario='M1_fixed',sensitivity='baseline'))
    return out

if __name__=='__main__':
    import sys
    run(sys.argv[1] if len(sys.argv)>1 else 'G:/My Drive/PHD/CSP3_GPP_outputs')
