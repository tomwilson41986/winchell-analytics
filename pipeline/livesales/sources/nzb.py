"""NZB — New Zealand Bloodstock."""

from __future__ import annotations

from datetime import date

from ..base import get_text
from ..models import RawSale
from .common import harvest_sales

KEY = "nzb"

_URL = "https://www.nzb.co.nz/sales/upcoming"


def parse(html: str, ref: date) -> list[RawSale]:
    return harvest_sales(
        html,
        house="NZB",
        country="NZ",
        base_url=_URL,
        ref=ref,
        source_key=KEY,
    )


def fetch(session, ref: date) -> list[RawSale]:
    return parse(get_text(session, _URL), ref)


fetch_lots = None  # lot pages are bespoke HTML; not scraped yet
