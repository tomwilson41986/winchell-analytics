"""Gavelhouse (NZ) — an online rolling auction with a clean JSON API. Sales may
carry no dates at all; the active flag then comes from the source-side status
("live"/"open"), see classify.is_active."""

from __future__ import annotations

import re
from datetime import date

from ..base import get_json, parse_date_range
from ..models import Lot, RawSale
from .common import as_records, pick

KEY = "gavelhouse"

_BASE = "https://gavelhouse.co.nz"
_CATALOGUE_URL = f"{_BASE}/api/currentcatalogue"
_LOTS_URL = f"{_BASE}/api/lots?catalogue={{id}}&detail=2"


def parse_catalogues(payload, ref: date) -> list[RawSale]:
    if payload is None:
        return []
    records = as_records(payload)
    if not records and isinstance(payload, dict):
        records = [payload]  # endpoint may return the single current catalogue

    sales: list[RawSale] = []
    for record in records:
        cat_id = pick(record, "id", "catalogueId", "catalogue_id")
        name = pick(record, "name", "title", "catalogueName")
        if not cat_id or not name:
            continue
        start, end = parse_date_range(
            pick(record, "dates", "dateRange", "closingDate", "endDate"), ref
        )
        if start is None:  # catalogue names often carry the date themselves
            start, end = parse_date_range(name, ref)
        # The API's status is sometimes a numeric state code; only a textual
        # status is meaningful downstream. A *current* catalogue is live.
        status = pick(record, "status", "state")
        if not re.search(r"[a-z]", status, re.IGNORECASE):
            status = "live"
        sales.append(
            RawSale(
                house="Gavelhouse",
                country="NZ",
                name=name,
                start_date=start,
                end_date=end,
                url=pick(record, "url", "link") or _BASE,
                online=True,
                status_hint=status,
                source_key=KEY,
                catalogue_ref=cat_id,
            )
        )
    return sales


def fetch(session, ref: date) -> list[RawSale]:
    return parse_catalogues(get_json(session, _CATALOGUE_URL), ref)


def parse_lots(payload) -> list[Lot]:
    lots: list[Lot] = []
    for record in as_records(payload):
        lot_no = pick(record, "lotNumber", "lot_no", "lot", "number")
        if not lot_no:
            continue
        lots.append(
            Lot(
                lot_no=lot_no,
                horse_name=pick(record, "name", "horseName", "title"),
                sex=pick(record, "sex", "gender"),
                colour=pick(record, "colour", "color"),
                sire=pick(record, "sire", "sireName"),
                dam=pick(record, "dam", "damName"),
                dam_sire=pick(record, "damSire", "dam_sire", "sireOfDam",
                              "broodmareSire"),
                vendor=pick(record, "vendor", "consignor", "seller"),
            )
        )
    return lots


def fetch_lots(raw: RawSale, session) -> list[Lot]:
    if not raw.catalogue_ref:
        return []
    return parse_lots(get_json(session, _LOTS_URL.format(id=raw.catalogue_ref)))
