"""NZB — New Zealand Bloodstock.

The calendar is generic HTML (harvested by ``common.harvest_sales``). Each
sale page embeds its catalogue as an HTML-entity-encoded ``{"lots": [...]}``
JSON blob, so ``fetch_lots`` reads the sale page itself and decodes it.
"""

from __future__ import annotations

import html as html_lib
import json
import re
from datetime import date

from ..base import expand_colour, expand_sex, get_text
from ..models import Lot, RawSale
from .common import harvest_sales, pick

KEY = "nzb"

_URL = "https://www.nzb.co.nz/sales/upcoming"

_LOTS_JSON_RE = re.compile(r'\{\s*"lots"\s*:')

# NZB's sale headings run the date straight onto the name with no separator
# ("National Weanling Sale25 June 2026 at Karaka"); trim it at the first
# "<day> <month>" so the displayed name and the sire-search results stay clean.
_NAME_DATE_RE = re.compile(
    r"\s*\d{1,2}(?:\s*[&-]\s*\d{1,2})?\s+"
    r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)",
    re.IGNORECASE,
)


def _clean_name(name: str) -> str:
    return _NAME_DATE_RE.split(name, maxsplit=1)[0].strip() or name


def parse(html: str, ref: date) -> list[RawSale]:
    sales = harvest_sales(
        html,
        house="NZB",
        country="NZ",
        base_url=_URL,
        ref=ref,
        source_key=KEY,
    )
    for sale in sales:
        sale.name = _clean_name(sale.name)
    return sales


def fetch(session, ref: date) -> list[RawSale]:
    return parse(get_text(session, _URL), ref)


def _extract_lots_object(page_html: str) -> dict | None:
    """Recover the embedded ``{"lots": [...]}`` object via a balanced-brace
    scan (the array contains nested objects, so a regex cannot bound it)."""
    text = html_lib.unescape(page_html or "")
    match = _LOTS_JSON_RE.search(text)
    if match is None:
        return None
    start = match.start()
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _with_suffix(name: str, suffix: str) -> str:
    """Append a country suffix the way the other houses publish it: "Redwood"
    + "GB" -> "Redwood (GB)"."""
    name = (name or "").strip()
    suffix = (suffix or "").strip()
    return f"{name} ({suffix})" if name and suffix else name


def parse_lots(page_html: str) -> list[Lot]:
    payload = _extract_lots_object(page_html)
    if not payload:
        return []
    lots: list[Lot] = []
    for record in payload.get("lots", []):
        if not isinstance(record, dict) or record.get("withdrawn"):
            continue
        lot_no = pick(record, "lot", "lotNumber", "lot_no")
        if not lot_no:
            continue
        lots.append(
            Lot(
                lot_no=lot_no,
                horse_name=pick(record, "horsename", "name", "horseName"),
                sex=expand_sex(pick(record, "sex", "gender")),
                colour=expand_colour(pick(record, "colour", "color")),
                sire=_with_suffix(
                    pick(record, "sire", "sireName"), pick(record, "sire_suffix")
                ),
                dam=_with_suffix(
                    pick(record, "dam", "damName"), pick(record, "dam_suffix")
                ),
                dam_sire=_with_suffix(
                    pick(record, "dam_sire", "damSire", "sireOfDam", "broodmareSire"),
                    pick(record, "dam_sire_suffix"),
                ),
                vendor=pick(record, "vendor", "consignor", "seller"),
            )
        )
    return lots


def fetch_lots(raw: RawSale, session) -> list[Lot]:
    if not raw.url:
        return []
    return parse_lots(get_text(session, raw.url))
