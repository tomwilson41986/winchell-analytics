"""Magic Millions (AUS).

The calendar is generic HTML (harvested by ``common.harvest_sales``). Lots
live on a separate catalogue host keyed by a short sale code (e.g. ``26PMY``):
``fetch_lots`` reads the sale page to recover that code, then parses the
catalogue table, whose cells are anchored by ``id`` ("sire-1", "dam-1", ...).
"""

from __future__ import annotations

import re
from datetime import date

from selectolax.parser import HTMLParser

from ..base import expand_colour, expand_sex, get_text
from ..models import Lot, RawSale
from .common import harvest_sales

KEY = "magicmillions"

_URL = "https://www.magicmillions.com.au/sales/?upcoming=true"
_CATALOGUE_HOST = "https://catalogue.magicmillions.com.au"
_SALE_CODE_RE = re.compile(r"catalogue\.magicmillions\.com\.au/sale/([A-Za-z0-9]+)")


def parse(html: str, ref: date) -> list[RawSale]:
    return harvest_sales(
        html,
        house="Magic Millions",
        country="AUS",
        base_url=_URL,
        ref=ref,
        source_key=KEY,
    )


def fetch(session, ref: date) -> list[RawSale]:
    return parse(get_text(session, _URL), ref)


def parse_lots(catalogue_html: str) -> list[Lot]:
    lots: list[Lot] = []
    for row in HTMLParser(catalogue_html).css("tr"):
        cells = row.css("td")
        by_id: dict[str, str] = {}
        colour_idx: int | None = None
        for i, cell in enumerate(cells):
            cell_id = cell.attributes.get("id") or ""
            if not cell_id:
                continue
            key = cell_id.rsplit("-", 1)[0]
            by_id[key] = (cell.text(strip=True) or "").strip()
            if key == "colour":
                colour_idx = i
        lot_no = by_id.get("lotnumber", "")
        if not lot_no:
            continue
        # Sex sits in the unlabelled cell immediately after Colour.
        sex = ""
        if colour_idx is not None and colour_idx + 1 < len(cells):
            sex = (cells[colour_idx + 1].text(strip=True) or "").strip()
        vendor_cell = row.css_first(".cataloguenameinfo")
        vendor = (vendor_cell.text(strip=True) or "").strip() if vendor_cell else ""
        lots.append(
            Lot(
                lot_no=lot_no,
                horse_name="",  # yearlings are catalogued unnamed
                sex=expand_sex(sex),
                colour=expand_colour(by_id.get("colour", "")),
                sire=by_id.get("sire", ""),
                dam=by_id.get("dam", ""),
                dam_sire=by_id.get("damsire", ""),
                vendor=vendor,
            )
        )
    return lots


def fetch_lots(raw: RawSale, session) -> list[Lot]:
    if not raw.url:
        return []
    code_match = _SALE_CODE_RE.search(get_text(session, raw.url))
    if code_match is None:
        return []  # catalogue not linked yet
    code = code_match.group(1)
    return parse_lots(get_text(session, f"{_CATALOGUE_HOST}/sale/{code}/0"))
