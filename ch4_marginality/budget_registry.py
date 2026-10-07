"""Validate reviewed original UNL evidence before enabling any economic source."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .core import YEARS

REQUIRED_SYSTEM = {
    'crop': 'corn', 'water': 'dryland', 'tillage': 'conventional',
    'rotation': 'corn-soybean', 'geography': 'Eastern Nebraska',
}
SOURCE_DIR = Path(__file__).parent / 'sources'


def load_registry(source_dir: Path = SOURCE_DIR) -> list[dict[str, Any]]:
    """Read reviewed decisions and reject incomplete, altered, or mismatched evidence.

    Original bytes are mandatory for eligible years. Excluded originals may be
    absent in lightweight CI checkouts; their reviewed provenance remains in the
    register, and any locally present original must still match its checksum.
    """
    source_dir = Path(source_dir)
    registry = json.loads((source_dir / 'unl_budget_registry.json').read_text(encoding='utf-8'))
    if registry['schema_version'] != 1 or registry['required_system'] != REQUIRED_SYSTEM:
        raise ValueError('UNL registry system contract changed')
    rows = registry['years']
    if len(rows) != len(YEARS) or {r['year'] for r in rows} != set(YEARS):
        raise ValueError('UNL registry must contain each target year exactly once')
    manifest = json.loads((source_dir / 'acquisition_manifest.json').read_text(encoding='utf-8'))
    originals = {r['file']: r for r in manifest}
    for row in rows:
        if type(row['eligible']) is not bool or type(row['original_recovered']) is not bool:
            raise ValueError('UNL decisions must be explicit booleans')
        if row['original_recovered']:
            original = originals.get(row['file'], {})
            if row['publication_year'] != row['year'] or not row['sha256'] or not row['source_url']:
                raise ValueError(f'Incomplete exact-year original provenance: {row["year"]}')
            if original.get('sha256') != row['sha256'] or original.get('url') != row['source_url']:
                raise ValueError(f'Original acquisition ledger differs: {row["year"]}')
            path = source_dir / row['file']
            if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() != row['sha256']:
                raise ValueError(f'Original UNL checksum failed: {row["year"]}')
        if row['eligible']:
            if (not row['original_recovered'] or not (source_dir / row['file']).is_file()
                    or row['status'] != 'verified_matching_original'
                    or row['strict_system_match'] is not True
                    or any(row.get(k) != v for k, v in REQUIRED_SYSTEM.items())
                    or not all(row.get(k) for k in ('budget_number', 'pdf_page', 'printed_page',
                                                  'title', 'assumed_yield_bu_ac', 'review_date'))):
                raise ValueError(f'UNL exact-year/system gate failed: {row["year"]}')
        elif row['status'] == 'verified_matching_original':
            raise ValueError(f'Contradictory UNL decision: {row["year"]}')
    return rows


def eligible_years(rows: list[dict[str, Any]]) -> set[int]:
    """Return only explicitly reviewed matching original production years."""
    return {row['year'] for row in rows if row['eligible'] is True}
