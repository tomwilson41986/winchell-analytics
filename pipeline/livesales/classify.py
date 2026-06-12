"""Pure classification functions: exclusion filter, sale-type bucket,
active/in-scope logic and the display status label."""

from __future__ import annotations

import re
from datetime import date, timedelta

from .models import RawSale

# --- Exclusion: jumps / National Hunt / store / non-thoroughbred ------------- //

_EXCLUDE_PATTERNS = [
    r"national hunt",
    r"\bn\.?h\.?\b",
    r"\bjump(s|ing)?\b",
    r"steeple",
    r"\bstore(s)?\b",
    r"point[\s-]?to[\s-]?point",
    r"\bp2p\b",
    r"\baqps\b",
    r"arab",
    r"\bpony\b|\bponies\b",
    r"trotting|harness|standardbred",
    r"land rover",
]
_EXCLUDE_RE = re.compile("|".join(_EXCLUDE_PATTERNS), re.IGNORECASE)

# NH sales whose listings carry no keyword — matched as substrings of the name.
_EXCLUDED_NAMES = ["derby sale", "land rover", "arkle", "sportsmans"]


def is_excluded(sale: RawSale) -> bool:
    haystack = f"{sale.name} {sale.description} {sale.type_hint}"
    if _EXCLUDE_RE.search(haystack):
        return True
    name = sale.name.lower()
    return any(blocked in name for blocked in _EXCLUDED_NAMES)


# --- Sale type: first matching rule wins (most specific first) --------------- //

SALE_TYPE_RULES: list[tuple[str, str, re.Pattern[str]]] = [
    ("Breeze Up", "⏱️", re.compile(
        r"breeze[\s-]?up|ready[\s-]?to[\s-]?run|\brtr\b", re.IGNORECASE)),
    ("HIT", "\U0001f3c7", re.compile(
        r"horses? in training|horses? of racing age|\bhit\b|\bhra\b"
        r"|horses? of all ages|racing age", re.IGNORECASE)),
    ("Foal / Weanling", "\U0001f37c", re.compile(
        r"weanling|\bfoal", re.IGNORECASE)),
    ("Broodmare", "♀️", re.compile(
        r"broodmare|breeding stock|\bmares?\b|in[\s-]?foal", re.IGNORECASE)),
    ("Yearling", "\U0001f40e", re.compile(r"yearling", re.IGNORECASE)),
    ("Mixed", "\U0001f500", re.compile(
        r"\bmixed\b|breeding\s*(?:&|and)", re.IGNORECASE)),
]

SALE_TYPE_ICONS = {name: icon for name, icon, _ in SALE_TYPE_RULES}
_BUCKET_NAMES = {name.lower() for name, _, _ in SALE_TYPE_RULES}


def sale_type(sale: RawSale) -> str:
    # Trust a source-side category only when it names one of our buckets.
    hint = sale.type_hint.strip().lower()
    if hint in _BUCKET_NAMES:
        return next(n for n, _, _ in SALE_TYPE_RULES if n.lower() == hint)
    # The sale name is authoritative; the description (often harvested block
    # text that can mention neighbouring sales) only breaks ties.
    for haystack in (sale.name, sale.description):
        for name, _, pattern in SALE_TYPE_RULES:
            if pattern.search(haystack):
                return name
    return "Mixed"


# --- Active / Upcoming ------------------------------------------------------- //

_LIVE_HINTS = {"live", "bidding-open", "bidding open", "open"}


def is_active(sale: RawSale, today: date, active_lead_days: int = 2) -> bool:
    """Active from `active_lead_days` before the first day through the last
    day inclusive. Undated sales count as active while their source-side
    status says bidding is open (rolling online auctions)."""
    if sale.start_date is None:
        return sale.status_hint.strip().lower() in _LIVE_HINTS
    end = sale.end_date or sale.start_date
    return sale.start_date - timedelta(days=active_lead_days) <= today <= end


def in_scope(sale: RawSale, today: date, horizon_days: int = 30) -> bool:
    """Upcoming: not excluded, not finished, starting within the horizon.
    Undated sales are kept."""
    if is_excluded(sale):
        return False
    if sale.start_date is None:
        return True
    end = sale.end_date or sale.start_date
    if end < today:
        return False
    return sale.start_date <= today + timedelta(days=horizon_days)


def status_label(sale: RawSale, active: bool, new: bool) -> str:
    parts = [label for label, on in (("Active", active), ("New", new)) if on]
    if parts:
        return " · ".join(parts)
    hint = sale.status_hint.strip().replace("-", " ")
    return hint.title() if hint else "Upcoming"
