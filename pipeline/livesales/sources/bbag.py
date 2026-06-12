"""BBAG — Baden-Badener Auktionsgesellschaft (DE). HTML events page per year;
lot catalogues are served by the 3forone auction backend as JSON, keyed on the
event's URL slug."""

from __future__ import annotations

from datetime import date
from urllib.parse import urlparse

from ..base import get_json, get_text
from ..models import Lot, RawSale
from .common import as_records, harvest_sales, pick

KEY = "bbag"

_CALENDAR_URL = "https://bbag-sales.de/events{year}~en_GB"
_LOTS_URL = "https://backend.3forone.auction/api/v1/bbag-auction/auction/{slug}/auctionlots"


def parse(html: str, ref: date) -> list[RawSale]:
    sales = harvest_sales(
        html,
        house="BBAG",
        country="DE",
        base_url="https://bbag-sales.de/",
        ref=ref,
        source_key=KEY,
    )
    for sale in sales:
        path = urlparse(sale.url).path.rstrip("/")
        sale.catalogue_ref = path.rsplit("/", 1)[-1] if path else ""
    return sales


def fetch(session, ref: date) -> list[RawSale]:
    return parse(get_text(session, _CALENDAR_URL.format(year=ref.year)), ref)


def parse_lots(payload) -> list[Lot]:
    lots: list[Lot] = []
    for record in as_records(payload):
        lot_no = pick(record, "lotNumber", "lot_no", "lot", "number", "catalogNumber")
        if not lot_no:
            continue
        lots.append(
            Lot(
                lot_no=lot_no,
                horse_name=pick(record, "name", "horseName", "title"),
                sex=pick(record, "sex", "gender"),
                colour=pick(record, "colour", "color"),
                sire=pick(record, "sire", "sireName", "father"),
                dam=pick(record, "dam", "damName", "mother"),
                dam_sire=pick(record, "damSire", "dam_sire", "sireOfDam",
                              "broodmareSire"),
                vendor=pick(record, "vendor", "consignor", "seller"),
            )
        )
    return lots


def fetch_lots(raw: RawSale, session) -> list[Lot]:
    if not raw.catalogue_ref:
        return []
    return parse_lots(get_json(session, _LOTS_URL.format(slug=raw.catalogue_ref)))
