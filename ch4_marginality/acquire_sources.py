"""Acquire original public research sources without changing their content."""
from __future__ import annotations
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
SOURCES = ROOT / "sources"

def download(url: str, name: str) -> dict:
    """Cache source bytes and return an auditable acquisition record."""
    path = SOURCES / name
    path.parent.mkdir(parents=True, exist_ok=True)
    r = requests.get(url, timeout=90)
    r.raise_for_status()
    if name.endswith('.pdf') and not r.content.startswith(b'%PDF'):
        raise ValueError(f'Not a PDF: {url} ({r.headers.get("Content-Type")})')
    path.write_bytes(r.content)
    return dict(file=name, url=url, resolved_url=r.url,
                retrieved_utc=datetime.now(timezone.utc).isoformat(),
                sha256=hashlib.sha256(r.content).hexdigest(), size_bytes=len(r.content))

def main() -> None:
    """Restore pinned originals without overwriting the reviewed source ledger."""
    records=json.loads((SOURCES/'acquisition_manifest.json').read_text(encoding='utf8'))
    for record in records:
        if not record.get('sha256') or not record.get('url'):continue
        path=SOURCES/record['file']
        if path.exists():
            actual=hashlib.sha256(path.read_bytes()).hexdigest()
        else:
            actual=download(record['url'],record['file'])['sha256']
        if actual!=record['sha256']:raise ValueError(f'Published source changed: {path.name}')
        print(path.name,'verified',flush=True)

if __name__ == '__main__':
    main()
