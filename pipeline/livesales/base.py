"""HTTP session + tolerant text parsing shared by every source adapter.

Network and parsing concerns are split deliberately: adapters expose a
``fetch_*`` function (network, uses this module's session/GET helpers) and a
pure ``parse_*`` function (HTML/JSON in, dataclasses out) so parsers can be
unit-tested offline against captured fixtures.
"""

from __future__ import annotations

import calendar
import json
import re
from datetime import date, timedelta
from typing import Any

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
DEFAULT_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "application/json;q=0.9,image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-GB,en;q=0.9",
}
TIMEOUT_SECONDS = 30


def build_session():
    """HTTP session with Chrome TLS impersonation when available.

    Several of these sites (Fastly / Cloudflare fronted) block datacentre IPs
    presenting default Python TLS fingerprints, so prefer curl_cffi's
    ``impersonate="chrome124"`` and fall back to plain ``requests``.
    """
    try:
        from curl_cffi import requests as curl_requests

        session = curl_requests.Session(impersonate="chrome124")
    except Exception:
        import requests

        session = requests.Session()
    session.headers.update(DEFAULT_HEADERS)
    return session


def _retried(fn):
    """3 attempts, exponential backoff (min 1s, max 8s)."""
    try:
        from tenacity import retry, stop_after_attempt, wait_exponential

        return retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=1, max=8),
            reraise=True,
        )(fn)
    except ImportError:  # tenacity not installed: minimal equivalent
        import time

        def wrapper(*args, **kwargs):
            delay = 1.0
            for attempt in range(3):
                try:
                    return fn(*args, **kwargs)
                except Exception:
                    if attempt == 2:
                        raise
                    time.sleep(min(delay, 8))
                    delay *= 2

        return wrapper


@_retried
def get_text(session, url: str, **kwargs) -> str:
    """GET a URL and return the body text (raises on HTTP errors)."""
    resp = session.get(url, timeout=TIMEOUT_SECONDS, **kwargs)
    resp.raise_for_status()
    return resp.text


def get_json(session, url: str, **kwargs) -> Any:
    """GET a JSON endpoint.

    Several of these APIs answer 200 with an *empty body* when a catalogue is
    not published yet — that is "no data", not an error, so return None.
    """
    body = get_text(session, url, **kwargs)
    if not body or not body.strip():
        return None
    return json.loads(body)


# --- Date-range parsing ----------------------------------------------------- //
#
# The houses publish a dozen formats: "6 – 8 October 2026", "Mon 2 Sep",
# "30 January - 4 February", "October 6-8", "1st - 3rd Dec", with or without
# years. One tolerant parser handles them all.

_MONTHS = {name.lower(): i for i, name in enumerate(calendar.month_name) if name}
_MONTHS.update({name.lower(): i for i, name in enumerate(calendar.month_abbr) if name})
_MONTHS["sept"] = 9

_WEEKDAYS_RE = re.compile(
    r"\b(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day)?\b\.?",
    re.IGNORECASE,
)
_ORDINAL_RE = re.compile(r"(\d)(?:st|nd|rd|th)\b")
_PREFIX_RE = re.compile(r"\b(?:book|day|part)\s*\d+\b[:,]?")
_YEAR_RE = re.compile(r"\b(20\d\d)\b")
_TOKEN_RE = re.compile(r"[a-z]+|\d{1,2}")


def parse_date_range(
    text: str | None, ref: date, dayfirst: bool = True
) -> tuple[date | None, date | None]:
    """Parse a human date span into (start, end). end is None for one-day sales.

    - Missing years are inferred from ``ref``: if the resulting end date would
      be more than 60 days in the past, roll both forward a year (the grace
      keeps a just-finished sale in the current year).
    - A range whose end month precedes its start month crosses a year boundary.
    - Returns (None, None) when no month word is found.
    """
    if not text:
        return (None, None)

    s = text.lower()
    s = re.sub(r"[–—−]", "-", s)  # en/em dashes, minus
    s = s.replace("&", " - ")
    s = re.sub(r"\b(?:to|and)\b", " - ", s)
    s = _WEEKDAYS_RE.sub(" ", s)
    s = _ORDINAL_RE.sub(r"\1", s)
    s = _PREFIX_RE.sub(" ", s)

    year = None
    m = _YEAR_RE.search(s)
    if m:
        year = int(m.group(1))
        s = _YEAR_RE.sub(" ", s)

    # Tokenise into month words and 1-2 digit day numbers, in order.
    items: list[tuple[str, int]] = []
    for tok in _TOKEN_RE.findall(s):
        if tok.isdigit():
            n = int(tok)
            if 1 <= n <= 31:
                items.append(("d", n))
        elif tok in _MONTHS:
            items.append(("m", _MONTHS[tok]))

    month_positions = [i for i, (kind, _) in enumerate(items) if kind == "m"]
    if not month_positions:
        return (None, None)

    # US sources read "October 6-8"; so does any string that *opens* with a
    # month word, regardless of source region.
    month_first = not dayfirst or items[0][0] == "m"

    pairs: list[tuple[int, int]] = []  # (day, month)
    for i, (kind, value) in enumerate(items):
        if kind != "d":
            continue
        if month_first:
            # Nearest month word before the day; else the next one after.
            before = [p for p in month_positions if p < i]
            pos = before[-1] if before else min(p for p in month_positions if p > i)
        else:
            # Day-first: the next month word after the day; else the last before.
            after = [p for p in month_positions if p > i]
            pos = after[0] if after else max(p for p in month_positions if p < i)
        pairs.append((value, items[pos][1]))

    if not pairs:
        return (None, None)

    start_day, start_month = pairs[0]
    end_day, end_month = pairs[-1]

    start_year = year if year is not None else ref.year
    end_year = start_year
    if end_month < start_month:  # e.g. "30 Dec - 2 Jan" crosses the year
        end_year += 1

    try:
        start = date(start_year, start_month, start_day)
        end = date(end_year, end_month, end_day)
    except ValueError:
        return (None, None)

    if year is None and end < ref - timedelta(days=60):
        start = start.replace(year=start.year + 1)
        end = end.replace(year=end.year + 1)

    return (start, None if end == start else end)


# --- UK/IRE colour+sex tokens ----------------------------------------------- //

_SEXES = {"C": "Colt", "F": "Filly", "G": "Gelding", "H": "Horse", "M": "Mare"}
# Longest prefixes first so "DKB" wins over "B".
_COLOURS = [
    ("DKB", "Dark Bay"),
    ("CH", "Chestnut"),
    ("GR", "Grey"),
    ("BR", "Brown"),
    ("BL", "Black"),
    ("RO", "Roan"),
    ("B", "Bay"),
]


def split_sex_colour(token: str) -> tuple[str, str]:
    """Split a catalogue token like "B.F." or "Ch.C" into (colour, sex).

    Returns ("", "") when the token does not look like colour+sex.
    """
    compact = re.sub(r"[^A-Za-z]", "", token or "").upper()
    if len(compact) < 2 or compact[-1] not in _SEXES:
        return ("", "")
    colour_part, sex_letter = compact[:-1], compact[-1]
    for prefix, colour in _COLOURS:
        if colour_part == prefix:
            return (colour, _SEXES[sex_letter])
    return ("", "")


_SEX_COLOUR_TOKEN_RE = re.compile(
    r"\b(?:20\d\d\s+)?((?:dkb|ch|gr|br|bl|ro|b)\.?\s*\.?\s*[cfghm])\.?(?=\s|$|,)",
    re.IGNORECASE,
)


def find_sex_colour(text: str) -> tuple[str, str]:
    """Find a "2023 Ch.F."-style token anywhere in free text."""
    m = _SEX_COLOUR_TOKEN_RE.search(text or "")
    if not m:
        return ("", "")
    return split_sex_colour(m.group(1))
