"""Tattersalls Online — the digital/online arm. The homepage lists current and
upcoming online auctions; lot listings reuse the 4D-style sale pages when an
auction links to one."""

from __future__ import annotations

from datetime import date

from ..base import get_text
from ..models import Lot, RawSale
from . import tattersalls
from .common import harvest_sales

KEY = "tattersalls_online"

_URL = "https://www.tattersallsonline.com/"


def parse(html: str, ref: date) -> list[RawSale]:
    sales = harvest_sales(
        html,
        house="Tattersalls Online",
        country="UK",
        base_url=_URL,
        ref=ref,
        source_key=KEY,
        online=True,
    )
    for sale in sales:
        if "/4DCGI/Sale/" in sale.url:
            sale.catalogue_ref = sale.url.split("?")[0]
    return sales


def fetch(session, ref: date) -> list[RawSale]:
    return parse(get_text(session, _URL), ref)


def fetch_lots(raw: RawSale, session) -> list[Lot]:
    if not raw.catalogue_ref:
        return []
    return tattersalls.fetch_lots(raw, session)
