"""OBS — Ocala Breeders' Sales (US). HTML homepage calendar; published
catalogues are exposed by the WordPress plugin's JSON API keyed on a numeric
sale id recovered from the sale URL."""

from __future__ import annotations

import re
from datetime import date

from ..base import get_json, get_text
from ..models import Lot, RawSale
from .common import as_records, harvest_sales, pick

KEY = "obs"

_BASE = "https://obssales.com/"
_LOTS_URL = "https://obssales.com/wp-json/obs-catalog-wp-plugin/v1/horse-sales/{sale_id}"

_SALE_ID_RE = re.compile(r"(\d{2,})(?:/|$|\?)")


def parse(html: str, ref: date) -> list[RawSale]:
    sales = harvest_sales(
        html,
        house="OBS",
        country="US",
        base_url=_BASE,
        ref=ref,
        source_key=KEY,
        dayfirst=False,
    )
    for sale in sales:
        id_match = _SALE_ID_RE.search(sale.url)
        if id_match:
            sale.catalogue_ref = id_match.group(1)
    return sales


def fetch(session, ref: date) -> list[RawSale]:
    return parse(get_text(session, _BASE), ref)


def parse_lots(payload) -> list[Lot]:
    lots: list[Lot] = []
    for record in as_records(payload):
        lot_no = pick(record, "hip", "hipNumber", "lot", "lotNumber")
        if not lot_no:
            continue
        lots.append(
            Lot(
                lot_no=lot_no,
                horse_name=pick(record, "name", "horseName"),
                sex=pick(record, "sex", "gender"),
                colour=pick(record, "color", "colour"),
                sire=pick(record, "sire", "sireName"),
                dam=pick(record, "dam", "damName"),
                dam_sire=pick(record, "broodmareSire", "damSire", "sireOfDam"),
                vendor=pick(record, "consignor", "vendor"),
            )
        )
    return lots


def fetch_lots(raw: RawSale, session) -> list[Lot]:
    if not raw.catalogue_ref:
        return []
    return parse_lots(get_json(session, _LOTS_URL.format(sale_id=raw.catalogue_ref)))
