"""Separate strict system matching from user-approved rotation-priority eligibility."""
from pathlib import Path
import hashlib, json
from .budget_registry import load_registry, SOURCE_DIR

POLICIES = ('exact', 'closest_rotation')

def load_policy(source_dir=SOURCE_DIR, policy='closest_rotation'):
    if policy not in POLICIES:
        raise ValueError('Unknown budget policy')
    source_dir=Path(source_dir)
    strict=load_registry(source_dir)
    selected=json.loads((source_dir/'unl_rotation_selections.json').read_text(encoding='utf-8'))
    if selected['production_year_substitution_allowed'] is not False:
        raise ValueError('Neighboring-year budgets are prohibited')
    choices={r['year']:r for r in selected['years']}
    if len(choices)!=len(selected['years']):raise ValueError('Duplicate budget year')
    output=[]
    for row in strict:
        r={k:v for k,v in row.items() if k!='candidates'}
        r.update(strict_eligible=row['eligible'],calculation_eligible=False,match_designation='Unavailable',
                 selection_rationale='',mismatch_fields='',actual_system='',policy=policy)
        choice=choices.get(row['year'])
        if choice:
            if not row['original_recovered'] or row['publication_year']!=row['year']:
                raise ValueError('Selection lacks an original production-year publication')
            if row['eligible']:
                candidate=row
            else:
                matches=[c for c in row['candidates'] if c['budget_number']==choice['budget_number']]
                if len(matches)!=1:raise ValueError('Selected budget not in reviewed original')
                candidate=matches[0]
                if not candidate.get('visual_verified'):raise ValueError('Selected page not visually verified')
            for key in ['budget_number','pdf_page','printed_page']:
                if candidate[key]!=choice[key]:raise ValueError('Selected original page differs')
            title=candidate['title'].lower()
            if 'corn' not in title or 'soybean' not in title or not any(w in title for w in ['dryland','rainfed']) or 'irrigated' in title or 'soybean' not in str(candidate.get('rotation','')).lower():
                raise ValueError('Rotation-priority choice must be dryland corn after soybean')
            path=source_dir/row['file']
            if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=row['sha256']:
                raise ValueError('Selected original bytes absent or altered')
            exact=row['eligible']
            if choice['match_designation']!=('Exact' if exact else 'Approximate'):
                raise ValueError('An approximate budget cannot become an exact match')
            r.update({k:candidate.get(k) for k in ['budget_number','pdf_page','printed_page','title','assumed_yield_bu_ac','geography','tillage','rotation']})
            r.update(match_designation=choice['match_designation'],selection_rationale=choice['selection_rationale'],
                     mismatch_fields=choice['mismatch_fields'],actual_system=candidate['title'],
                     calculation_eligible=exact or policy=='closest_rotation',
                     unl_full_return_available=choice['unl_full_return_available'])
        r['eligible']=r['calculation_eligible']
        r['status']='verified_'+r['match_designation'].lower()+'_original' if r['eligible'] else row['status']
        output.append(r)
    return output
