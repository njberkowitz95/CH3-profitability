"""Academic exports for the explicitly approximate rotation-priority release."""

from pathlib import Path

import json, shutil

import numpy as np

import pandas as pd

import geopandas as gpd

import matplotlib

matplotlib.use('Agg')

import matplotlib.pyplot as plt

from .profit_workspace import BASE_ID, RUN_ID

from .pipeline import sha,dump,cog,read



REFERENCES='''

UNL originals: https://cap.unl.edu/cropbudgets/archive/ and https://digitalcommons.unl.edu/extensionhist/2024/ . Original bytes, SHA-256, selected PDF/printed pages and transcription evidence accompany this release. Repository identifier 2024 is not the production year of the 2001 publication.



USDA NASS Crop Values annual summaries: https://esmis.nal.usda.gov/publication/crop-values-annual-summary . Finalized Nebraska marketing-year corn prices are linked to production year separately from report publication year. USDA ERS Commodity Costs and Returns: https://www.ers.usda.gov/data-products/commodity-costs-and-returns . FINBIN: https://finbin.umn.edu/ . BLS annual CPI-U: https://www.bls.gov/cpi/tables/supplemental-files/historical-cpi-u-202106.pdf and https://www.bls.gov/regions/mid-atlantic/data/consumerpriceindexannualandsemiannual_table.htm .



Literature identified through SciSpace supports treating rotation and tillage as distinct factors: Wilhelm and Wortmann (2004), Tillage and Rotation Interactions for Corn and Soybean Grain Yield as Affected by Precipitation and Air Temperature, doi:10.2134/agronj2004.0425, https://digitalcommons.unl.edu/usdaarsfacpub/66/ ; Rathke, Wienhold, Wilhelm and Diepenbrock (2007), Tillage and rotation effect on corn–soybean energy balances in eastern Nebraska, doi:10.1016/j.still.2007.08.008, https://digitalcommons.unl.edu/usdaarsfacpub/109/ . These references motivate explicit mismatch reporting; they do not justify applying invented yield or cost adjustments.

'''



def run(root):

    root=Path(root);out=root/'CH4_marginality'/BASE_ID;release=root/'CH4_marginality'/RUN_ID

    assert json.loads((out/'validation.json').read_text())['verified']

    costs=pd.read_csv(out/'tables/economic_scenarios.csv',float_precision='round_trip')
    if 'actual_system' not in costs:costs['actual_system']=costs['selected_unl_system']
    prices=json.loads((out/'sources/rotation_annual_prices.json').read_text())
    ledger=json.loads((out/'sources/acquisition_manifest.json').read_text())
    for row in prices:
        original=next((r for r in ledger if r['file']==row['file']),{})
        row['source_url']=original.get('url','See original-year price record');row['source_sha256']=original.get('sha256','See original-year price record')
    pd.DataFrame(prices).to_csv(out/'tables/nass_prices.csv',index=False)
    pd.DataFrame([dict(year=r['year'],cpi_u=r['cpi_u'],to_2021_dollars=270.970/r['cpi_u'],source_url=r.get('cpi_source_url','https://www.bls.gov/regions/mid-atlantic/data/consumerpriceindexannualandsemiannual_table.htm'),definition='Annual CPI-U US city average all items NSA') for r in prices]).to_csv(out/'tables/deflator.csv',index=False)

    s=pd.read_csv(out/'tables/sensitivity.csv',float_precision='round_trip')

    # Fill new constant-dollar columns while retaining existing exact numeric records.

    factor=costs.set_index(['year','source']).to_2021_dollars

    for col in ['mean_revenue_usd_ac','mean_cash_margin_usd_ac','return_p05','return_median','return_p95']:

        key=col+'_2021dollars';new=s.year<2019

        s.loc[new,key]=[r[col]*factor.loc[(r['year'],r['source'])] for r in s.loc[new].to_dict('records')]

    s.to_csv(out/'tables/sensitivity.csv',index=False)

    from .final_checks import verify,pdf_report

    verify(out)

    from .reporting import save,maps

    # The editable workbook is authored and recalculated by verify_workbook.mjs
    # from these final CSV tables with the bundled spreadsheet engine.

    e=pd.read_csv(out/'tables/year_eligibility.csv');a=pd.read_csv(out/'tables/annual_yield.csv')

    base=s.query('price_factor==1 and cost_factor==1')

    b=base.merge(costs[['year','source','match_designation','budget_number','actual_system','geography']],on=['year','source'])

    b['loss_share_percent']=100*b.loss_ha/b.valid_ha

    b.to_csv(out/'tables/baseline_academic_summary.csv',index=False)

    source_columns=['year','source_url','sha256','budget_number','pdf_page','printed_page','actual_system','geography','match_designation','strict_eligible','calculation_eligible','selection_rationale','mismatch_fields']

    e[source_columns].to_csv(out/'tables/rotation_source_ledger.csv',index=False)

    text=['# Historical marginality with closest rotation-matched original-year budgets',

      'Nebraska MLRA 106 dryland corn; '+RUN_ID+'. Economic and quartile marginality receive equal reporting. This release implements the researcher’s rotation-priority choice, not an assertion that no-till and conventional production are equivalent.',

      '## Sources and eligibility',e[['year','budget_number','match_designation','strict_eligible','calculation_eligible','actual_system','geography']].to_markdown(index=False),

      'Exact mode retains only 2019 and experimental 2021. Closest mode permits the verified original-year 2001/2009/2011/2013/2015/2017 candidates. 2003/2005/2007 remain unavailable across all economic sources; their yield quartiles remain available. No neighboring year is substituted.',

      'The 2009 UNL page publishes field/material costs but leaves required additional costs unfilled. Its partial cost is preserved and never represented as full economic return. ERS and usable FINBIN 2009 scenarios are separately labeled. In 2001, combined opportunity/tax accounts prevent a defensible cash-cost separation; full economic cost is published, but cash margin is unavailable. Published rounding and 2011 material residuals are documented in the reconciliation sheet.',

      '## Methods',

      'The latest verified yield, mask, patch and NCCPI inputs were checked by checksum and spatial comparisons. The 22 modeled surfaces, yield equations and 30 m EPSG:5070 grid are unchanged. Budget assumed yields document the source system; calculations apply actual modeled pixel yields. Unchanged 2019 and experimental 2021 values are retained and independently checked. Native pixels represent 0.09 hectares.',

      'Revenue = modeled yield in Mg/ha divided by the documented Mg/ha-per-bu/acre conversion, multiplied by finalized Nebraska crop-year marketing-year price, price factor and FINBIN operator share when applicable. Economic return subtracts source total per-acre cost multiplied by cost factor. Cash margin subtracts only an established cash-cost account. Sources retain their own geography and accounting. ERS Heartland planted-acre costs and FINBIN participant accounts do not establish producer profitability. Land, labor, machinery and overhead are counted once within each source account.',

      'Economic marginality is return strictly below zero. Quartile marginality is yield at or below the annual regional 25th percentile, retaining ties. Source comparisons use the same source-valid support; missing yield and source exclusions retain explicit denominators. Nine combinations vary price and cost independently by −15%, baseline and +15%. Annual CPI-U ratios convert all monetary rates and sums into constant 2021 dollars without changing classifications. Histogram tails are retained.',

      'County–AOI and crop-patch summaries sum native areas and acreage-weighted returns to the regional valid domain. Patches are annual mapped crop units, not persistent farms. Temporal results distinguish changing annual footprints from common-valid pixels. Biennial transitions are calculated only for adjacent available odd years; gaps are recorded, not bridged. Persistence uses available source-valid observation counts. Budget/tillage changes and the 2019 crop-mask source change limit interpretation of trends. Experimental 2021 is outside primary temporal summaries.',

      'Baseline NCCPI associations use 10 km spatial blocks, 1,999 replicates, fixed seed 20260928; 5 km and 20 km checks accompany the primary results. The sample size counts pixels, while uncertainty resamples spatial blocks. Associations do not independently validate modeled profitability.',

      '## Baseline results',b[['year','scenario','source','match_designation','valid_ha','mean_return_2021usd_ac','loss_ha','loss_share_percent','quartile_ha','both_ha','disagree_ha']].to_markdown(index=False,floatfmt='.3f'),

      '## Verification and limitations','Source totals, year alignment, exact/approximate policy gates, annual prices, CPI factors, missing values, quartile ties, sensitivity monotonicity and spatial sums are tested. Reused numeric records are checked exactly. Floating point COG monetary storage is float32; authoritative monetary totals and JSON evidence use full precision. Common-domain return summaries derived from COGs therefore retain that documented storage precision.',

      '## References',REFERENCES]

    (out/'CH4_methods_results.md').write_text('\n\n'.join(text),encoding='utf8')

    # Disconnected points intentionally avoid economic trend lines across gaps.

    for scenario in ['M1_fixed','M2_HI_sensitivity']:

        fig,axes=plt.subplots(2,1,figsize=(11,8),sharex=True,layout='constrained')

        for source,g in b.query('year<2021 and scenario==@scenario').groupby('source'):

            axes[0].scatter(g.year,g.mean_return_2021usd_ac,label=source)

            axes[1].scatter(g.year,g.loss_share_percent,label=source)

        axes[0].axhline(0,color='#777',lw=.7);axes[0].set_ylabel('Mean return (2021 $/acre)');axes[0].legend()

        axes[1].set_ylabel('Negative-return share (%)');axes[1].set_xticks(range(2001,2020,2));axes[1].set_xlabel('Production year; missing years are gaps')

        fig.suptitle(scenario+' · baseline source scenarios\nApproximate no-till budgets before 2019; geography/accounts differ')

        save(fig,out,'economic_temporal_'+scenario)

    county=gpd.read_file(out/'CH4_spatial.gpkg',layer='county_aoi')

    for year in sorted(costs.loc[costs.source=='UNL','year'].unique()):

        c=costs.query('year==@year and source=="UNL"').iloc[0]

        maps(out,county,[(scenario,out/f'rasters/overlap_{year}_{scenario}_UNL.tif') for scenario in ['M1_fixed','M2_HI_sensitivity']],f'{year} · UNL #{int(c.budget_number)} · {c.match_designation}\nEconomic / quartile overlap'+(' · EXPERIMENTAL' if year==2021 else ''),f'overlap_{year}',True)

    # Constant-dollar baseline surfaces accompany nominal rasters for every account/model.

    for c in costs.to_dict('records'):

      for scenario in ['M1_fixed','M2_HI_sensitivity']:

       for metric in ['revenue','cash_margin','total_return']:

        p=out/f'rasters/{metric}_{c["year"]}_{scenario}_{c["source"]}.tif'

        if p.exists():cog(out/'rasters'/p.name.replace('.tif','_2021dollars.tif'),read(p)*c['to_2021_dollars'],f'{metric}; constant 2021 USD/acre; {c["match_designation"]} original-year UNL anchor')

    pdf_report(out)

    for p in (out/'tables').glob('*.csv'):shutil.copy2(p,release/'tables'/p.name) if (release/'tables').exists() else None

    dump(out/'academic_export_verification.json',dict(verified=True,baseline_rows=len(b),policy_register_sha256=sha(out/'tables/year_eligibility.csv'),references='SciSpace literature results; primary articles linked',experimental_2021_separate=True))

    return out

