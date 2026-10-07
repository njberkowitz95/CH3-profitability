"""Compose the final academic report from verified numerical outputs."""
from pathlib import Path
import json
import shutil
from xml.sax.saxutils import escape
import pandas as pd
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, LongTable, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader


def run(out: Path) -> None:
    out=Path(out)
    if not json.loads((out/'validation.json').read_text())['verified']:
        raise ValueError('Report requires a completed verified analysis')
    data=pd.read_csv(out/'tables/annual_profitability.csv')
    eligibility=pd.read_csv(out/'tables/year_eligibility.csv')
    accounts=pd.read_csv(out/'tables/economic_scenarios.csv')
    baseline=data[(data.source=='UNL')&(data.scenario=='M1_fixed')]
    primary=baseline[baseline.year<2021]
    experimental=baseline[baseline.year==2021]
    assoc=pd.read_csv(out/'tables/nccpi_associations.csv')
    assoc=assoc[(assoc.source=='UNL')&(assoc.scenario=='M1_fixed')&(assoc.block_m==10000)]
    common=pd.read_csv(out/'tables/common_valid_profit.csv')
    common=common[(common.source=='UNL')&(common.scenario=='M1_fixed')&(common.policy=='closest_rotation')]
    headings=['Year','Mean $/ac','Median $/ac','Profit %','Breakeven %','Loss %','Valid ha']
    def result_table(df):
        return [headings]+[[str(r.year),f'{r.profit_mean_usd_ac_2021dollars:,.2f}',f'{r.profit_median_usd_ac_2021dollars:,.2f}',f'{r.profitable_percent:.2f}',f'{r.breakeven_percent:.2f}',f'{r.loss_percent:.2f}',f'{r.valid_ha:,.2f}'] for r in df.itertuples()]
    sections=[
      ('Scope and estimand',
       'Chapter 3 estimates modeled spatial crop profitability for Nebraska MLRA 106 dryland corn in odd production years 2001–2021. The primary estimand is grain revenue minus total economic costs, expressed in dollars per acre. Positive (>0), exactly zero (=0), and negative (<0) unrounded returns are classified separately. Missing yields and unavailable source accounts are not zero-profit observations. Chapter 4 and both yield-model parameterizations are unchanged.'),
      ('Retained yield models',
       'The inherited production-efficiency sequence allocates annual NPP to the growing season using seasonal GPP divided by full-calendar-year GPP; biomass equals 2.5 times seasonal NPP, and aboveground biomass equals biomass divided by (1 + root-to-shoot ratio). Yield equals aboveground biomass times harvest index divided by (1 − grain moisture), with a factor of 10 converting kg/m² to Mg/ha. The retained root-to-shoot ratio is 0.18 and grain-moisture reporting basis is 0.155. M1 fixes harvest index at 0.50; M2 uses the existing year-specific evidence and fixed fills, retaining mixed-support and provisional harvest-index limitations. Some M2 estimates use site grain yield and cannot provide independent same-site yield validation. Chapter 3 reads the verified resulting rasters without recalculating or modifying this equation chain. The 2021 irrigation mask uses the documented LGRIP2020 proxy, which is one reason its results remain experimental.'),
      ('Input provenance and accounting',
       'The analysis locks the same completed, verified input families as Chapter 4 using file checksums, including the 2019/2021 core-filter remask. The raster grid is 30 m, EPSG:5070; each cell represents 0.09 ha. Published UNL budget yields never replace the modeled yields. Grain revenue uses Nebraska NASS crop-year marketing-year prices and any documented FINBIN operator-share adjustment. Total published per-acre costs are fixed within each source account and are not re-scaled by modeled yield. Cash margins are reported only where cash costs are supported. ERS Heartland accounts and FINBIN state/county operator-account proxies remain separate from UNL accounts, with their own geography and coverage.'),
      ('Budget policies and uncertainty',
       'Closest rotation-matched budgets prioritize original-year dryland corn after soybean. No-till and geographic mismatches remain explicit; no tillage adjustment is invented and no equivalence is claimed. Exact-only policy permits only strict production-system matches. Original budgets remain unrecovered for 2003, 2005 and 2007, blocking economics under all sources. The 2009 original is an eligibility anchor, but its incomplete UNL full-cost account cannot produce UNL total profit. Other eligible 2009 source accounts remain separate. Nine combinations use price and cost factors of 0.85, 1 and 1.15. Annual BLS CPI-U converts rates and totals to constant 2021 dollars without changing classifications.'),
      ('Spatial statistics and denominators',
       'Pixel results are aggregated to annual mapped crop patches, county–AOI intersections and the AOI. The mapped crop area includes missing-yield crop pixels; valid economic area additionally requires source coverage. Coverage is valid economic area divided by mapped crop area. Profit-class shares use valid economic area. Summaries include mean, median, population standard deviation, 5th and 95th percentiles, total monetary return and class hectares. Totals convert hectares to acres using 10000/4046.8564224. Histograms retain both tails. Lowest-quartile yield uses yield at or below the annual regional 25th percentile, retaining ties. Six cells cross-classify the three profit classes with quartile membership.'),
      ('Temporal support and interpretation',
       'Annual footprints and their common-valid-pixel intersection are reported separately. Profitability frequency is the fraction of observed eligible primary seasons with positive return; an observation-count raster supplies its denominator. It is not a predicted probability. Three-state transitions are computed only between adjacent available biennial years and do not bridge gaps. Experimental 2021 is reported separately and excluded from primary temporal summaries. The 2019 mask-source change and historical budget-system differences constrain temporal interpretation. Exact-only primary summaries contain only 2019 and cannot establish multi-season persistence.'),
      ('NCCPI association',
       'Baseline Pearson associations for continuous profit and point-biserial associations for positive-profit status use the retained spatial-block procedure: 10 km blocks, 1,999 bootstrap replicates, seed 20260928, with 5 and 20 km sensitivity checks. Intervals require adequate spatial-block support and defined replicates. With spatially uniform prices, operator share and costs, continuous profit is an affine transform of yield and inherits its correlation with NCCPI. These associations are not independent producer-level profitability validation.'),
      ('Crop and pixel identities',
       'Pixel and annual crop-patch IDs are preserved, including crop pixels with missing yield. On the fixed grid the one-based pixel ID equals row × 5469 + column + 1, with zero-based row and column. The namespace CH4G5070V1 is retained for cross-chapter joins. Patch keys include year and release provenance; they denote mapped crop units, not ownership or persistent farm parcels.'),
    ]
    md=['# Chapter 3: Spatial and Temporal Crop Profitability',f'Release: {out.name}. All monetary tables below use baseline assumptions and constant 2021 dollars unless stated otherwise.']
    for title,body in sections:md+=['## '+title,body]
    md+=['## Primary results: M1, UNL',primary[['year','profit_mean_usd_ac_2021dollars','profit_median_usd_ac_2021dollars','profitable_percent','breakeven_percent','loss_percent','valid_ha']].to_markdown(index=False),
         '## Experimental 2021: M1, UNL',experimental[['year','profit_mean_usd_ac_2021dollars','profitable_percent','breakeven_percent','loss_percent','valid_ha']].to_markdown(index=False),
         '## Limits and verification','These are conditional modeled returns, not observed farm net income. Mapped crop units are not farms. The outputs retain source exclusions and accounting differences; they do not support pooling UNL, ERS and FINBIN as interchangeable estimates. Reconciliations test internal consistency and agreement with unchanged Chapter 4 monetary outputs, not independent economic validity. Complete tables cover both models and all nine sensitivities. Deployment evidence is maintained separately from numerical validation.']
    literature=Path(__file__).resolve().parents[1]/'docs/CH3_literature_record.md'
    if literature.exists():
        shutil.copy2(literature,out/'sources/CH3_literature_record.md')
        md+=['## Literature and formal sources',literature.read_text(encoding='utf-8')]
    md+=['## Source files','Original UNL budgets and reconciled transcriptions, USDA ERS Commodity Costs and Returns records, FINBIN enterprise reports, Nebraska NASS prices and BLS CPI-U factors remain in sources/, the economic-input tables and CH4_source_budget_workbook.xlsx. Input and output manifests provide the file-level provenance.']
    (out/'CH3_methods_results.md').write_text('\n\n'.join(md),encoding='utf-8')
    styles=getSampleStyleSheet();styles['BodyText'].fontSize=10;styles['BodyText'].leading=14
    story=[]
    def paragraph(text,style='BodyText'):
        story.extend([Paragraph(escape(text),styles[style]),Spacer(1,8)])
    def table(rows,widths=None):
        wrapped=[[Paragraph(escape(str(x)),styles['BodyText']) for x in row] for row in rows]
        obj=LongTable(wrapped,colWidths=widths or [470/len(rows[0])]*len(rows[0]),repeatRows=1,hAlign='LEFT')
        obj.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#dce8ef')),('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,0),.7,colors.HexColor('#173e55')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f5f7f8')])]))
        story.extend([obj,Spacer(1,14)])
    def figure(name,caption):
        path=out/'figures'/f'{name}.png'
        w,h=ImageReader(str(path)).getSize();story.append(Image(str(path),width=470,height=470*h/w));paragraph(caption)
    paragraph('Chapter 3','Title');paragraph('Spatial and Temporal Crop Profitability','Title');paragraph('Nebraska MLRA 106 · 30 m EPSG:5070 · '+out.name)
    for title,body in sections:paragraph(title,'Heading2');paragraph(body)
    story.append(PageBreak());paragraph('Primary results: M1, UNL','Heading1');table(result_table(primary))
    paragraph('Mean and median rates are 2021 USD/acre. Profit and loss shares use source-valid area; exact breakeven is retained separately in the complete tables. Available years are shown without filling gaps. A negative mean can coexist with a majority of profitable area.')
    figure('primary_profitability','Figure 1. Both yield scenarios and separate source accounts. Points are shown without lines across unavailable years; experimental 2021 is excluded.')
    paragraph('Experimental 2021','Heading1');table(result_table(experimental));figure('profit_classes_2021','Figure 2. Experimental 2021, M1, baseline source accounts. Source-specific areas and accounting definitions differ.')
    story.append(PageBreak());paragraph('Original-year budget eligibility','Heading1')
    table([['Year','UNL sheet','Designation','Actual system / exclusion']]+[[int(r.year),str(int(r.budget_number)) if pd.notna(r.budget_number) else 'Unavailable',r.match_designation if pd.notna(r.match_designation) else 'Unavailable',str(r.actual_system) if pd.notna(r.actual_system) else str(r.status)] for r in eligibility.itertuples()],[42,54,80,294])
    paragraph('Account scope','Heading1');table([['Source','Geography','Interpretation']]+[[s,str(g.geography.iloc[0]),str(g.account.iloc[0])] for s,g in accounts.groupby('source')],[85,155,230])
    paragraph('Common-valid primary support: M1, UNL','Heading1');table([['Year','Common ha','Mean $/ac (2021)','Profitable ha']]+[[int(r.year),f'{r.common_ha:,.2f}',f'{r.mean_profit_2021usd_ac:,.2f}',f'{r.profitable_ha:,.2f}'] for r in common.itertuples()],[50,130,150,140])
    paragraph('NCCPI baseline associations: M1, UNL, 10 km','Heading1');table([['Year','Metric','r','95% interval','Blocks']]+[[int(r.year),r.metric,f'{r.r:.3f}' if pd.notna(r.r) else 'Unavailable',f'{r.ci_low:.3f} to {r.ci_high:.3f}' if pd.notna(r.ci_low) and pd.notna(r.ci_high) else 'Unavailable',int(r.blocks)] for r in assoc.itertuples()],[45,95,60,190,80])
    paragraph('Limits, literature and reproducibility','Heading1')
    paragraph(md[md.index('## Limits and verification')+1])
    for citation in ['Massey et al. (2008). Profitability Maps as an Input for Site-Specific Management Decision Making. Agronomy Journal 100:52–59. DOI: 10.2134/agronj2007.0057.', 'Brandes et al. (2016). Subfield profitability analysis reveals an economic case for cropland diversification. Environmental Research Letters 11:014009. DOI: 10.1088/1748-9326/11/1/014009.', 'Original UNL production-year publications; USDA ERS Commodity Costs and Returns; FINBIN enterprise accounts; Nebraska NASS crop-year marketing prices; BLS annual CPI-U. Complete URLs, checksums and accounting definitions are preserved in the source records.']:
        paragraph(citation)
    paragraph('Code: https://github.com/njberkowitz95/CH3-profitability. Numerical validation, Earth Engine verification and live-app checks are separate release records. All figures and CSV/GPKG/COG outputs derive from the locked input inventory.')
    def footer(canvas,doc):
        canvas.setFont('Helvetica',8);canvas.drawString(48,25,'CH3 · Modeled profitability · '+out.name);canvas.drawRightString(565,25,str(doc.page))
    SimpleDocTemplate(str(out/'CH3_methods_results.pdf'),leftMargin=48,rightMargin=48,topMargin=42,bottomMargin=42).build(story,onFirstPage=footer,onLaterPages=footer)
