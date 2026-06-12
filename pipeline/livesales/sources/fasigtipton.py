"""Fasig-Tipton (US). HTML yearly calendar; lots come from the Django API in
two hops: resolve the sale identifier (URL slug) to a numeric sale id, then
page the horses endpoint."""

from __future__ import annotations

from datetime import date
from urllib.parse import urlparse

from ..base import get_json, get_text
from ..models import Lot, RawSale
from .common import as_records, harvest_sales, pick

KEY = "fasigtipton"

_BASE = "https://www.fasigtipton.com"
_CALENDAR_URL = _BASE + "/calendar/{year}"
_SALES_API = _BASE + "/django/api/sales/?sale_identifier={code}"
_HORSES_API = _BASE + "/django/api/horses/?sale={sale_id}"


def parse(html: str, ref: date) -> list[RawSale]:
    sales = harvest_sales(
        html,
        house="Fasig-Tipton",
        country="US",
        base_url=_BASE,
        ref=ref,
        source_key=KEY,
        dayfirst=False,
    )
    for sale in sales:
        # The sale code is the last path segment of the sale page URL.
        path = urlparse(sale.url).path.rstrip("/")
        sale.catalogue_ref = path.rsplit("/", 1)[-1] if path else ""
    return sales


def fetch(session, ref: date) -> list[RawSale]:
    return parse(get_text(session, _CALENDAR_URL.format(year=ref.year)), ref)


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
    sales_payload = get_json(session, _SALES_API.format(code=raw.catalogue_ref))
    records = as_records(sales_payload)
    if not records:
        return []
    sale_id = pick(records[0], "id", "saleId", "sale_id")
    if not sale_id:
        return []
    return parse_lots(get_json(session, _HORSES_API.format(sale_id=sale_id)))
