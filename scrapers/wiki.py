"""Open, citable enrichment from Wikipedia.

Wikipedia article content is openly licensed (CC BY-SA), so this is a
terms-clean way to gather real racing data for notable horses: career record,
total earnings, owner (which lets us *confirm* the Winchell match), trainer,
breeder, colour/sex/foaling year, the list of major wins, and — handily — the
Equibase refno embedded in the profile citation.

Wikipedia's robots.txt disallows the action API (``/w/``) and the REST API
(``/api/``) but permits ordinary article pages (``/wiki/<Title>``), so we fetch
the rendered article and parse its ``table.infobox``. Nothing is invented:
fields absent from the article are left ``None``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field as dc_field
from typing import Optional
from urllib.parse import quote

from selectolax.parser import HTMLParser

from .base import HttpClient
from .config import SOURCES, is_winchell_owner
from pipeline.schema import FormSummary


@dataclass
class WikiEnrichment:
    """Real facts parsed from a horse's Wikipedia infobox."""

    title: str
    source_url: str
    year_of_birth: Optional[int] = None
    sex: Optional[str] = None
    colour: Optional[str] = None
    country: Optional[str] = None
    breeder: Optional[str] = None
    trainer: Optional[str] = None
    owner_raw: Optional[str] = None
    sire: Optional[str] = None
    dam: Optional[str] = None
    damsire: Optional[str] = None
    equibase_refno: Optional[str] = None
    form: Optional[FormSummary] = None
    major_wins: list[str] = dc_field(default_factory=list)

    @property
    def owner_is_winchell(self) -> bool:
        return is_winchell_owner(self.owner_raw)


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (name or "").lower())


def _parse_record(text: str) -> Optional[tuple[int, int, int, int]]:
    """Parse "19: 12-3-2" -> (starts, wins, seconds, thirds). Dash-tolerant."""
    m = re.search(r"(\d+)\s*:\s*(\d+)\s*[-–—]\s*(\d+)\s*[-–—]\s*(\d+)", text)
    if not m:
        return None
    return tuple(int(m.group(i)) for i in range(1, 5))  # type: ignore[return-value]


def _parse_earnings(text: str) -> Optional[int]:
    # First run of digits/commas (ignores trailing "[1]" ref markers etc.).
    m = re.search(r"\d[\d,]+", text)
    if not m:
        return None
    return int(m.group().replace(",", ""))


def _parse_year(text: str) -> Optional[int]:
    m = re.search(r"(1[89]\d\d|20\d\d)", text)
    return int(m.group(1)) if m else None


_YEAR_ONLY = re.compile(r"^\d{4}$")


def _txt(node) -> str:
    """Plain text of a node with spaces between child text nodes/links."""
    if node is None:
        return ""
    return re.sub(r"\s+", " ", node.text(separator=" ", strip=True)).strip()


class WikiScraper:
    """Resolve a horse's Wikipedia article and parse its infobox table."""

    def __init__(self, client: HttpClient) -> None:
        self.client = client
        self.base = SOURCES["wikipedia"]["base_url"]

    @staticmethod
    def _infobox_rows(box: HTMLParser) -> dict[str, object]:
        """Map infobox label -> value <td> node (keyed by lower-case label)."""
        rows: dict[str, object] = {}
        for tr in box.css("tr"):
            th = tr.css_first("th")
            td = tr.css_first("td")
            if th and td:
                rows[th.text(strip=True).lower()] = td
        return rows

    def resolve(
        self, name: str, expected_sire: Optional[str] = None
    ) -> Optional[tuple[str, str, HTMLParser, str]]:
        """Return (title, url, infobox, full_html) for the best-matching article."""
        for title in (f"{name} (horse)", name):
            body = self.client.get(f"{self.base}/wiki/{quote(title.replace(' ', '_'))}")
            if not body:
                continue
            tree = HTMLParser(body)
            box = tree.css_first("table.infobox")
            if box is None:
                continue
            rows = self._infobox_rows(box)
            # Must look like a racehorse infobox.
            if "sire" not in rows and "record" not in rows:
                continue
            if expected_sire:
                sire_td = rows.get("sire")
                sire = _txt(sire_td) if sire_td else ""  # type: ignore[union-attr]
                if sire and _norm(sire) != _norm(expected_sire):
                    continue
            url = f"{self.base}/wiki/{quote(title.replace(' ', '_'))}"
            return title, url, box, body
        return None

    def fetch(
        self, name: str, *, expected_sire: Optional[str] = None
    ) -> tuple[Optional[WikiEnrichment], Optional[str]]:
        found = self.resolve(name, expected_sire=expected_sire)
        if found is None:
            return None, None
        title, url, box, html = found
        return self._parse(title, url, box, html), url

    def _parse(
        self, title: str, url: str, box: HTMLParser, html: str
    ) -> WikiEnrichment:
        rows = self._infobox_rows(box)

        def text_of(label: str) -> Optional[str]:
            td = rows.get(label)
            return _txt(td) if td else None  # type: ignore[union-attr]

        enr = WikiEnrichment(title=title, source_url=url)
        enr.sex = text_of("sex")
        enr.colour = text_of("color") or text_of("colour")
        enr.country = text_of("country")
        enr.breeder = text_of("breeder")
        enr.trainer = text_of("trainer")
        enr.owner_raw = text_of("owner")
        enr.sire = text_of("sire")
        enr.dam = text_of("dam")
        enr.damsire = text_of("damsire")
        foaled = text_of("foaled")
        if foaled:
            enr.year_of_birth = _parse_year(foaled)

        # Major wins: the row(s) following the "Major wins" header.
        enr.major_wins = self._major_wins(box)

        m = re.search(r"refno=(\d+)", html)
        if m:
            enr.equibase_refno = m.group(1)

        rec = _parse_record(text_of("record") or "")
        earnings_text = text_of("earnings")
        earnings = _parse_earnings(earnings_text) if earnings_text else None
        if rec or earnings is not None:
            starts, wins, seconds, thirds = rec or (0, 0, 0, 0)
            enr.form = FormSummary(
                starts=starts,
                wins=wins,
                seconds=seconds,
                thirds=thirds,
                total_earnings=earnings,
                currency="USD" if earnings is not None else None,
                # Listed major wins are, by definition, black-type victories.
                black_type_wins=len(enr.major_wins),
            )
        return enr

    @staticmethod
    def _major_wins(box: HTMLParser) -> list[str]:
        trs = box.css("tr")
        for i, tr in enumerate(trs):
            if "major win" in tr.text(strip=True).lower():
                wins: list[str] = []
                # Collect links from the immediately following rows until the
                # next header row.
                for tr2 in trs[i + 1 : i + 3]:
                    if tr2.css_first("th") and not tr2.css_first("td"):
                        break
                    for a in tr2.css("a"):
                        name = a.text(strip=True)
                        if name and not _YEAR_ONLY.match(name) and name not in wins:
                            wins.append(name)
                return wins
        return []
