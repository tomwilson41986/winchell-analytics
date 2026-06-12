"""Arqana (FR). The catalogues/results page lists upcoming sales alongside
past ones; the orchestrator's in-scope filter drops anything already finished."""

from __future__ import annotations

from datetime import date

from ..base import get_text
from ..models import RawSale
from .common import harvest_sales

KEY = "arqana"

_URL = "https://www.arqana.com/catalogues_results.html"


def parse(html: str, ref: date) -> list[RawSale]:
    return harvest_sales(
        html,
        house="Arqana",
        country="FR",
        base_url=_URL,
        ref=ref,
        source_key=KEY,
    )


def fetch(session, ref: date) -> list[RawSale]:
    return parse(get_text(session, _URL), ref)


fetch_lots = None  # lot pages are bespoke HTML; not scraped yet
