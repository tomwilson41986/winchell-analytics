"""Helpers shared by the source adapters.

``harvest_sales`` is a tolerant HTML calendar reader for the houses whose
listing pages are plain HTML without a stable documented structure (Goffs,
Arqana, Inglis, Magic Millions, NZB, ...): it scans link-bearing blocks for a
parseable date span. Sites with documented structures or JSON APIs get
dedicated parsers in their own modules. ``pick`` is a forgiving dict getter
for the JSON APIs, whose field names vary in case and style.
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from urllib.parse import urljoin

from selectolax.parser import HTMLParser

from ..base import parse_date_range
from ..models import RawSale

# Containers tried in order; the first selector that yields valid sales wins.
# Specific card-ish classes first so we do not split one card into many <li>s.
_DEFAULT_SELECTORS = [
    "[class*='sale-card']",
    "[class*='event-card']",
    "[class*='auction-card']",
    "[class*='card']",
    "[class*='sale']",
    "[class*='event']",
    "[class*='auction']",
    "article",
    "tr",
    "li",
]

# Link texts that are navigation/action chrome, not sale names.
_NAV_NOISE = re.compile(
    r"^(home|sales?|calendar|results?|news|contact|about|login|register|more"
    r"|read more|view|view (all|deadlines?)|details|catalogue|enter( now)?"
    r"|deadlines?|entries|nominate|buy|sell|upcoming( sales?)?|all sales?)$",
    re.IGNORECASE,
)

# A "name" that is a bare hostname (site title leaking into a heading).
_DOMAIN_NAME_RE = re.compile(r"^[\w-]+(\.[\w-]+)+$")

# A "name" that is really just a date span ("May 18-19", "6 - 8 October").
_DATE_NAME_RE = re.compile(
    r"^[\s\d,&/.-]*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)"
    r"[a-z]*[\s\d,&/.-]*)+$",
    re.IGNORECASE,
)

# Containers that are editorial content, not calendar entries.
_EDITORIAL_RE = re.compile(r"news|article|blog|press|post|story", re.IGNORECASE)

# Elements likely to hold the sale's own date line, checked before falling
# back to the whole block's text (which may contain unrelated dates).
_DATE_ELEMENT_SELECTOR = "time, [class*='date'], [class*='Date'], [class*='meta']"

# No thoroughbred auction runs longer than this; a wider "range" means the
# block text mixed in unrelated dates, so keep the start and drop the end.
_MAX_SALE_DAYS = 21


def _candidate_name(node) -> str:
    for sel in ("h1", "h2", "h3", "h4", "a"):
        el = node.css_first(sel)
        if el is None:
            continue
        text = re.sub(r"\s+", " ", el.text(strip=True) or "").strip()
        if (
            len(text) > 3
            and not _NAV_NOISE.match(text)
            and not _DATE_NAME_RE.match(text)
            and not _DOMAIN_NAME_RE.match(text)
        ):
            return text
    return ""


def _is_editorial(node, depth: int = 3) -> bool:
    current = node
    for _ in range(depth):
        if current is None:
            return False
        if _EDITORIAL_RE.search(current.attributes.get("class") or ""):
            return True
        current = current.parent
    return False


def _block_dates(node, ref: date, dayfirst: bool) -> tuple[date | None, date | None]:
    candidates = [el.text(separator=" ", strip=True) or "" for el in
                  node.css(_DATE_ELEMENT_SELECTOR)]
    candidates.append(node.text(separator=" ", strip=True) or "")
    for text in candidates:
        start, end = parse_date_range(text, ref, dayfirst=dayfirst)
        if start is None:
            continue
        if end is not None and (end < start or end - start > timedelta(days=_MAX_SALE_DAYS)):
            end = None
        return (start, end)
    return (None, None)


def harvest_sales(
    html: str,
    *,
    house: str,
    country: str,
    base_url: str,
    ref: date,
    source_key: str,
    dayfirst: bool = True,
    online: bool = False,
    selectors: list[str] | None = None,
) -> list[RawSale]:
    """Scan an HTML calendar page for blocks that pair a link with a date span.

    A block qualifies when it contains an anchor with a real destination, a
    plausible name (not nav chrome, not just a date) and a recoverable start
    date; editorial containers (news/blog cards) are skipped. Blocks are
    deduplicated on (name, start month) so nested matches do not double-count.
    """
    tree = HTMLParser(html)
    for selector in selectors or _DEFAULT_SELECTORS:
        found: list[RawSale] = []
        seen: set[tuple[str, str]] = set()
        for node in tree.css(selector):
            if _is_editorial(node):
                continue
            link = node.css_first("a[href]")
            if link is None:
                continue
            href = (link.attributes.get("href") or "").strip()
            if not href or href.startswith(("#", "javascript:", "mailto:")):
                continue
            name = _candidate_name(node)
            if not name:
                continue
            start, end = _block_dates(node, ref, dayfirst)
            if start is None:
                continue
            dedup_key = (name.lower(), start.strftime("%Y-%m"))
            if dedup_key in seen:
                continue
            seen.add(dedup_key)
            text = node.text(separator=" ", strip=True) or ""
            found.append(
                RawSale(
                    house=house,
                    country=country,
                    name=name,
                    start_date=start,
                    end_date=end,
                    url=urljoin(base_url, href),
                    online=online,
                    description=text[:400],
                    source_key=source_key,
                )
            )
        if found:
            return found
    return []


def _norm_key(key: str) -> str:
    return re.sub(r"[^a-z0-9]", "", key.lower())


def pick(record: dict, *keys: str, default: str = "") -> str:
    """Get the first matching key from a JSON record, tolerating case and
    naming-style differences ("lotNumber" matches "lot_number")."""
    if not isinstance(record, dict):
        return default
    normalised = {_norm_key(k): v for k, v in record.items()}
    for key in keys:
        value = normalised.get(_norm_key(key))
        if value is not None and value != "":
            return str(value).strip()
    return default


def as_records(payload) -> list[dict]:
    """Unwrap the list of records from a JSON API response, whatever the
    envelope ({"data": [...]}, {"results": [...]}, {"lots": [...]}, or a bare
    list)."""
    if payload is None:
        return []
    if isinstance(payload, list):
        return [r for r in payload if isinstance(r, dict)]
    if isinstance(payload, dict):
        for key in ("data", "results", "lots", "items", "horses", "sales"):
            value = payload.get(key)
            if isinstance(value, list):
                return [r for r in value if isinstance(r, dict)]
    return []
