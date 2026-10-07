"""Explicit opt-in release context; earlier immutable releases keep their defaults."""
import os
ROTATION_RELEASE = '20260929_rotation_priority_budget_v1'
ROTATION = os.environ.get('CH4_BUDGET_POLICY') == 'closest_rotation'
RUN_ID = ROTATION_RELEASE if ROTATION else '20260929_profit_app_v1'
BASE_ID = ROTATION_RELEASE+'/analysis' if ROTATION else '20260928_corefilter_exact_year_v2'
ASSET_PREFIX = 'projects/ee-njberkowitz95/assets/'+('ch4_rotation_20260929' if ROTATION else 'ch4_profit_20260929')
