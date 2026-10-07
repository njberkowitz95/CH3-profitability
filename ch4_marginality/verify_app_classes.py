"""Compare native GEE classifications with direct raster calculations."""
from pathlib import Path
import json
import ee
from .pipeline import TRANSFORM,SHAPE

def run(out):
    out=Path(out);d=json.loads((out/'app_data_candidate.json').read_text())
    ee.Initialize(project='ee-njberkowitz95')
    image=ee.Image(d['asset']);county=ee.Image(d['county_scope_asset']).select(0).eq(1)
    region=ee.Geometry.Rectangle([TRANSFORM.c,TRANSFORM.f-SHAPE[0]*30,TRANSFORM.c+SHAPE[1]*30,TRANSFORM.f],proj='EPSG:5070',geodesic=False)
    rows=[]
    cases=[(2019,'M1_fixed','UNL'),(2019,'M2_HI_sensitivity','UNL'),(2021,'M1_fixed','UNL'),(2021,'M2_HI_sensitivity','UNL'),(2019,'M1_fixed','FINBIN_county')]
    for year,scenario,source in cases:
        a=next(r for r in d['annual'] if r['year']==year and r['scenario']==scenario)
        c=next(r for r in d['costs'] if r['year']==year and r['source']==source)
        expected=next(r for r in d['sensitivity'] if r['year']==year and r['scenario']==scenario and r['source']==source and r['price_factor']==r['cost_factor']==1)
        idx=d['years'].index(year)*2+(scenario!='M1_fixed')
        y=image.select([idx]).toDouble();y=y.updateMask(y.gte(0))
        if source=='FINBIN_county':y=y.updateMask(county)
        q=y.lte(a['cutoff_Mg_ha'])
        loss=y.divide(d['mgha_per_buac']).multiply(c['nass_price_usd_bu']).multiply(c['operator_share']).subtract(c['total_cost_usd_ac']).lt(0)
        values=ee.Image.cat([q.rename('quartile_ha'),loss.rename('loss_ha'),q.And(loss).rename('both_ha'),q.neq(loss).rename('disagree_ha')])
        native=values.reduceRegion(reducer=ee.Reducer.sum(),geometry=region,crs='EPSG:5070',crsTransform=list(TRANSFORM)[:6],maxPixels=1e9,tileScale=4).getInfo()
        passed=all(abs(native[k]-round(expected[k]/.09))<.01 for k in native)
        rows.append({'year':year,'scenario':scenario,'source':source,'pixel_counts':native,'exact_classification_match':passed})
        (out/'ee_classification_verification.json').write_text(json.dumps(rows,indent=2))
        assert passed,rows[-1]
        print(year,scenario,source,'native classes match',flush=True)

if __name__=='__main__':
    import sys
    run(sys.argv[1])
