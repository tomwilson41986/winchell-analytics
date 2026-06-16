"""Goffs (IRE) and Goffs UK (Doncaster) — one shared upcoming-sales page.
Sales whose names mark them as the UK arm are attributed to Goffs UK.

Each sale page renders its catalogue as ``<a class="lot-table__lot">`` anchors
carrying the pedigree on ``data-*`` attributes (one anchor per responsive
layout, so the same lot number repeats — deduplicated here)."""

from __future__ import annotations

import re
from datetime import date

from ..base import expand_colour, expand_sex, get_text
from ..models import Lot, RawSale
from .common import harvest_sales

KEY = "goffs"

_URL = "https://www.goffs.com/upcoming-sales"

_UK_ARM_RE = re.compile(r"\bgoffs uk\b|\bdoncaster\b|\buk\b", re.IGNORECASE)


def parse(html: str, ref: date) -> list[RawSale]:
    sales = harvest_sales(
        html,
        house="Goffs",
        country="IRE",
        base_url=_URL,
        ref=ref,
        source_key=KEY,
    )
    for sale in sales:
        if _UK_ARM_RE.search(sale.name):
            sale.house = "Goffs UK"
            sale.country = "UK"
    return sales


def fetch(session, ref: date) -> list[RawSale]:
    return parse(get_text(session, _URL), ref)


def parse_lots(page_html: str) -> list[Lot]:
    from selectolax.parser import HTMLParser

    lots: list[Lot] = []
    seen: set[str] = set()
    for el in HTMLParser(page_html).css("[data-lotnumber]"):
        attr = el.attributes
        lot_no = (attr.get("data-lotnumber") or "").strip()
        sire = (attr.get("data-sirename") or "").strip()
        dam = (attr.get("data-damname") or "").strip()
        name = (attr.get("data-lotname") or "").strip()
        # Skip filter widgets / repeated layout variants of the same lot.
        if not lot_no or lot_no in seen or not (sire or dam or name):
            continue
        seen.add(lot_no)
        lots.append(
            Lot(
                lot_no=lot_no,
                horse_name=name,
                sex=expand_sex(attr.get("data-sex") or ""),
                colour=expand_colour(attr.get("data-colour") or ""),
                sire=sire,
                dam=dam,
                dam_sire=(attr.get("data-damsire") or "").strip(),
                vendor=(attr.get("data-consignor") or "").strip(),
            )
        )
    return lots


def fetch_lots(raw: RawSale, session) -> list[Lot]:
    # The sale page itself carries the catalogue.
    if not raw.url:
        return []
    return parse_lots(get_text(session, raw.url))
