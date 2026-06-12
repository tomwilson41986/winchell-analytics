"""Tattersalls (Newmarket, UK) and Tattersalls Ireland.

Both run the same 4D-served calendar: `.sale-card` blocks carrying the sale
name, a date line and a status CSS class. The internal sale code (e.g. JUL26)
sits in the heading href and doubles as the lot-listing URL. Fetching lots
requires seeding the 4D session cookie via the sale's /Main/Overview page
before requesting the lot table itself.
"""

from __future__ import annotations

import re
from datetime import date
from urllib.parse import urljoin

from selectolax.parser import HTMLParser

from ..base import find_sex_colour, get_text, parse_date_range
from ..models import Lot, RawSale

KEY = "tattersalls"

_CALENDARS = [
    # (calendar URL, house, country, lot-page host)
    (
        "https://secure.tattersalls.com/4DCGI/Sale/SaleDates?site=NMT",
        "Tattersalls",
        "UK",
        "https://secure.tattersalls.com",
    ),
    (
        "https://secure.tattersalls.ie/4DCGI/Sale/SaleDates",
        "Tattersalls Ireland",
        "IRE",
        "https://secure.tattersalls.ie",
    ),
]

_SALE_CODE_RE = re.compile(r"/4DCGI/Sale/([A-Za-z0-9]+)")
_STATUS_RE = re.compile(r"sale-card--status-([a-z-]+)")


def parse_sale_cards(
    html: str, house: str, country: str, host: str, ref: date
) -> list[RawSale]:
    sales: list[RawSale] = []
    for card in HTMLParser(html).css(".sale-card"):
        heading = card.css_first(".sale-card__heading a")
        if heading is None:
            continue
        name = (heading.text(strip=True) or "").strip()
        href = heading.attributes.get("href") or ""
        if not name:
            continue

        code_match = _SALE_CODE_RE.search(href)
        code = code_match.group(1) if code_match else ""

        meta = card.css_first(".sale-card__meta-item-text")
        start, end = parse_date_range(
            meta.text(strip=True) if meta else "", ref, dayfirst=True
        )

        status_match = _STATUS_RE.search(card.attributes.get("class") or "")
        status_hint = status_match.group(1) if status_match else ""

        sales.append(
            RawSale(
                house=house,
                country=country,
                name=name,
                start_date=start,
                end_date=end,
                url=urljoin(host, href) if href else host,
                status_hint=status_hint,
                source_key=KEY,
                # Everything fetch_lots needs: the sale's 4D listing URL.
                catalogue_ref=f"{host}/4DCGI/Sale/{code}" if code else "",
            )
        )
    return sales


def fetch(session, ref: date) -> list[RawSale]:
    sales: list[RawSale] = []
    errors: list[Exception] = []
    for url, house, country, host in _CALENDARS:
        try:
            sales.extend(parse_sale_cards(get_text(session, url), house, country, host, ref))
        except Exception as exc:  # one host down must not hide the other
            errors.append(exc)
    if not sales and errors:
        raise errors[0]
    return sales


_BY_RE = re.compile(r"<span[^>]*class=\"[^\"]*small[^\"]*\"[^>]*>\s*BY\s*</span>([^<]*)")
_EX_RE = re.compile(r"<span[^>]*class=\"[^\"]*small[^\"]*\"[^>]*>\s*EX\s*</span>([^<]*)")


def parse_lot_table(html: str) -> list[Lot]:
    lots: list[Lot] = []
    for row in HTMLParser(html).css("tr"):
        lot_link = row.css_first("td.lot a.ll")
        if lot_link is None:
            continue
        lot_no = (lot_link.text(strip=True) or "").strip()

        tdh = row.css_first("td.tdh")
        name = ""
        sire = dam = ""
        colour = sex = ""
        if tdh is not None:
            name_link = tdh.css_first("a.hn")
            if name_link is not None:
                name = (name_link.text(strip=True) or "").strip()
            tdh_html = tdh.html or ""
            by = _BY_RE.search(tdh_html)
            ex = _EX_RE.search(tdh_html)
            sire = " ".join(by.group(1).split()).strip(",;–-") if by else ""
            dam = " ".join(ex.group(1).split()).strip(",;–-") if ex else ""
            colour, sex = find_sex_colour(tdh.text(separator=" "))

        vendor = ""
        cells = row.css("td")
        for i, cell in enumerate(cells):
            if "col2type" in (cell.attributes.get("class") or "") and i + 1 < len(cells):
                vendor = (cells[i + 1].text(strip=True) or "").strip()
                break

        lots.append(
            Lot(
                lot_no=lot_no,
                horse_name=name,
                sex=sex,
                colour=colour,
                sire=sire,
                dam=dam,
                vendor=vendor,
            )
        )
    return lots


def fetch_lots(raw: RawSale, session) -> list[Lot]:
    if not raw.catalogue_ref:
        return []
    # Seed the 4D session cookie first or the lot table comes back empty.
    get_text(session, f"{raw.catalogue_ref}/Main/Overview")
    return parse_lot_table(get_text(session, raw.catalogue_ref))
