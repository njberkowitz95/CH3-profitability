"""Independent delivery checks, a printable report and an auditable app payload."""
from pathlib import Path
import json,hashlib
import numpy as np
import pandas as pd
import rasterio
from .core import MGHA_PER_BUAC

def records(frame):
    # Round-trip float precision is essential: rounding a quartile downward can
    # exclude tied float32 yields. Pandas' decimal-limited JSON is unsuitable.
    values=frame.astype(object).where(pd.notna(frame),None).to_dict(orient='records')
    return json.loads(json.dumps(values,allow_nan=False,default=lambda x:x.item()))

def verify(out):
    out=Path(out)
    a=pd.read_csv(out/'tables/annual_yield.csv',float_precision='round_trip');s=pd.read_csv(out/'tables/sensitivity.csv',float_precision='round_trip')
    eligibility=pd.read_csv(out/'tables/year_eligibility.csv')
    costs=pd.read_csv(out/'tables/economic_scenarios.csv')
    assert len(a)==22 and len(s)==len(costs)*2*9
    assert set(s.year)==set(eligibility[eligibility.eligible].year)==set(costs.year)
    assert set(pd.read_csv(out/'tables/common_valid_yield.csv').year)==set(range(2001,2020,2))
    for _,g in s.groupby(['year','scenario','source']):
        assert len(g)==9 and g.quartile_ha.nunique()==1
        for _,h in g.groupby('price_factor'):assert np.all(np.diff(h.sort_values('cost_factor').loss_ha)>=0)
        for _,h in g.groupby('cost_factor'):assert np.all(np.diff(h.sort_values('price_factor').loss_ha)<=0)
    pc=pd.read_csv(out/'tables/patch_statistics.csv');cc=pd.read_csv(out/'tables/county_statistics.csv')
    for _,r in a.iterrows():
        for f in (pc,cc):
            g=f[(f.year==r.year)&(f.scenario==r.scenario)&(f.source=='yield_only')]
            assert np.isclose(g.valid_ha.sum(),r.valid_ha)
            assert np.isclose(g.missing_ha.sum(),r.missing_ha)
            assert np.isclose(g.quartile_ha.sum(),r.quartile_ha)
    for _,r in s[(s.price_factor==1)&(s.cost_factor==1)].iterrows():
        for f in (pc,cc):
            g=f[(f.year==r.year)&(f.scenario==r.scenario)&(f.source==r.source)]
            assert np.isclose(g.return_usd_ac_sum_usd.sum(),r.total_return_usd)
            assert np.isclose(g.economic_loss_ha.sum(),r.loss_ha)
    ee=json.loads((out/'ee_ingestion_verification.json').read_text())
    metadata=ee['ch4_verified_yields_corefilter_20260928'];stats=ee['native_statistics']
    rows=[]
    for i,r in a.sort_values(['year','scenario']).reset_index(drop=True).iterrows():
        band=metadata['bands'][i]['id'];n=stats[band+'_count'];mean=stats[band+'_mean']
        assert n==r.n and abs(mean-r['mean'])<1e-5
        rows.append({'year':int(r.year),'scenario':r.scenario,'count':n,'mean_difference':mean-r['mean']})
    raster_count=0
    for p in (out/'rasters').glob('*.tif'):
        with rasterio.open(p) as ds:
            assert ds.crs.to_epsg()==5070 and ds.res==(30,30)
            assert ds.tags(ns='IMAGE_STRUCTURE').get('LAYOUT')=='COG' and ds.nodata==-9999
        raster_count+=1
    report={'verified':True,'annual_surfaces':22,'sensitivity_rows':len(s),'cog_count':raster_count,
            'areas_and_dollars_reconciled':True,'ee_native_checks':rows,'blocked_years':eligibility.loc[~eligibility.eligible,'year'].tolist()}
    (out/'validation.json').write_text(json.dumps(report,indent=2))
    payload={'years':list(range(2001,2022,2)),'mgha_per_buac':MGHA_PER_BUAC,
        'asset':'projects/ee-njberkowitz95/assets/ch4_verified_yields_corefilter_20260928',
        'county_scope_asset':'projects/ee-njberkowitz95/assets/ch4_finbin_county_scope_corefilter_20260928',
        'annual':records(a),'costs':records(pd.read_csv(out/'tables/economic_scenarios.csv',float_precision='round_trip')),
        'eligibility':records(eligibility),'sensitivity':records(s)}
    (out/'app_data.json').write_text(json.dumps(payload,indent=2,allow_nan=False))
    return report

def pdf_report(out):
    from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,Image,PageBreak
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from matplotlib import font_manager
    from bs4 import BeautifulSoup
    import markdown
    out=Path(out)
    pdfmetrics.registerFont(TTFont('DejaVu',font_manager.findfont('DejaVu Sans')))
    for name,weight,slant in [('DejaVu-Bold','bold','normal'),('DejaVu-Oblique','normal','italic'),('DejaVu-BoldOblique','bold','italic')]:
        pdfmetrics.registerFont(TTFont(name,font_manager.findfont(font_manager.FontProperties(family='DejaVu Sans',weight=weight,style=slant))))
    pdfmetrics.registerFontFamily('DejaVu',normal='DejaVu',bold='DejaVu-Bold',italic='DejaVu-Oblique',boldItalic='DejaVu-BoldOblique')
    styles=getSampleStyleSheet()
    for style in styles.byName.values():style.fontName='DejaVu'
    styles['Normal'].fontSize=9;styles['Normal'].leading=13
    styles['BodyText'].fontSize=6;styles['BodyText'].leading=8
    story=[]
    soup=BeautifulSoup(markdown.markdown((out/'CH4_methods_results.md').read_text(encoding='utf8'),extensions=['tables']),'html.parser')
    for el in soup.children:
        if not getattr(el,'name',None):continue
        if el.name=='table':
            data=[[Paragraph(cell.get_text(),styles['BodyText']) for cell in row.find_all(['th','td'])] for row in el.find_all('tr')]
            table=Table(data,colWidths=[499/len(data[0])]*len(data[0]),repeatRows=1)
            table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e1edf1')),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,-1),.25,colors.lightgrey)]))
            story.extend([table,Spacer(1,12)])
        else:
            style=styles['Heading'+el.name[1]] if el.name in ['h1','h2','h3'] else styles['Normal']
            content=''.join(str(c) for c in el.contents).replace('<code>','<font face="DejaVu">').replace('</code>','</font>')
            story.extend([Paragraph(content,style),Spacer(1,7)])
    for p in sorted((out/'figures').glob('*.png')):
        story.append(PageBreak());story.append(Paragraph(p.stem.replace('_',' ').title(),styles['Heading2']))
        image=Image(str(p));scale=min(499/image.imageWidth,680/image.imageHeight)
        image.drawWidth=image.imageWidth*scale;image.drawHeight=image.imageHeight*scale;story.append(image)
    def footer(canvas,doc):
        release_id=out.parent.name if out.name=='analysis' else out.name
        canvas.setFont('DejaVu',8);canvas.drawString(48,25,'CH4 marginality • '+release_id);canvas.drawRightString(547,25,str(doc.page))
    SimpleDocTemplate(str(out/'CH4_methods_results.pdf'),pagesize=A4,rightMargin=48,leftMargin=48,topMargin=45,bottomMargin=45).build(story,onFirstPage=footer,onLaterPages=footer)

if __name__=='__main__':
    import sys
    output=Path(sys.argv[1]);print(json.dumps(verify(output),indent=2));pdf_report(output)
