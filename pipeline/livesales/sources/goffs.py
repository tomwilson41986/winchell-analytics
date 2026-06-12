"""Goffs (IRE) and Goffs UK (Doncaster) — one shared upcoming-sales page.
Sales whose names mark them as the UK arm are attributed to Goffs UK."""

from __future__ import annotations

import re
from datetime import date

from ..base import get_text
from ..models import RawSale
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


fetch_lots = None  # lot pages are bespoke HTML; not scraped yet
