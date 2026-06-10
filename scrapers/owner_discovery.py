"""Discover the Winchell roster.

Three independent paths, results merged and de-duplicated by lower-cased name:

1. **Owner/stable page** — Equibase lists a stable's runners on its owner
   profile. Parsed when reachable.
2. **Results-page scan** — walk recent result charts and keep any runner whose
   owner string passes the Winchell guard (:func:`config.is_winchell_owner`).
3. **Seed bootstrap** — ``data/seed_horses.txt``, a hand-maintained list of
   confirmed Winchell horses with optional hints (year, sire, Equibase refno,
   pedigree URL) so profiles resolve even when (1) and (2) are blocked.

Paths (1) and (2) depend on Equibase, which is bot-protected; when blocked they
contribute nothing and the seed list carries the roster. No names are invented.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from selectolax.parser import HTMLParser

from .base import HttpClient, get_html
from .config import SOURCES, is_winchell_owner

SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "seed_horses.txt"


class RosterEntry:
    """A discovered horse and the hints needed to resolve its profile."""

    __slots__ = (
        "name",
        "year_of_birth",
        "sire",
        "equibase_refno",
        "pedigree_url",
        "discovered_via",
    )

    def __init__(
        self,
        name: str,
        *,
        year_of_birth: Optional[int] = None,
        sire: Optional[str] = None,
        equibase_refno: Optional[str] = None,
        pedigree_url: Optional[str] = None,
        discovered_via: str = "seed",
    ) -> None:
        self.name = name.strip()
        self.year_of_birth = year_of_birth
        self.sire = sire
        self.equibase_refno = equibase_refno
        self.pedigree_url = pedigree_url
        self.discovered_via = discovered_via

    @property
    def key(self) -> str:
        return self.name.lower()

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "year_of_birth": self.year_of_birth,
            "sire": self.sire,
            "equibase_refno": self.equibase_refno,
            "pedigree_url": self.pedigree_url,
            "discovered_via": self.discovered_via,
        }

    def merge(self, other: "RosterEntry") -> None:
        """Fill any blank fields on this entry from ``other``."""
        for attr in ("year_of_birth", "sire", "equibase_refno", "pedigree_url"):
            if getattr(self, attr) is None and getattr(other, attr) is not None:
                setattr(self, attr, getattr(other, attr))


# --------------------------------------------------------------------------- #
# Seed bootstrap
# --------------------------------------------------------------------------- #


def from_seed(path: Path = SEED_PATH) -> list[RosterEntry]:
    """Parse ``seed_horses.txt``.

    Format: one horse per line, ``#`` comments and blank lines ignored. Fields
    are ``|``-separated and all but the name are optional::

        name | year_of_birth | sire | equibase_refno | pedigree_url
    """
    if not path.exists():
        return []
    entries: list[RosterEntry] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        name = parts[0]
        if not name:
            continue
        yob = None
        if len(parts) > 1 and parts[1]:
            try:
                yob = int(parts[1])
            except ValueError:
                yob = None
        entries.append(
            RosterEntry(
                name=name,
                year_of_birth=yob,
                sire=(parts[2] if len(parts) > 2 and parts[2] else None),
                equibase_refno=(parts[3] if len(parts) > 3 and parts[3] else None),
                pedigree_url=(parts[4] if len(parts) > 4 and parts[4] else None),
                discovered_via="seed",
            )
        )
    return entries


# --------------------------------------------------------------------------- #
# Equibase owner/stable page
# --------------------------------------------------------------------------- #


def from_owner_page(client: HttpClient, owner_url: str) -> list[RosterEntry]:
    """Parse runners from an Equibase owner/stable profile page.

    Returns an empty list when the page is blocked or has no recognisable
    horse links.
    """
    tree = get_html(client, owner_url)
    if tree is None:
        return []
    return _entries_from_horse_links(tree, via="owner_page")


def _entries_from_horse_links(tree: HTMLParser, *, via: str) -> list[RosterEntry]:
    """Pull each horse off an Equibase owner page via its profile link.

    Owner pages list a stable's runners, each linking to its own horse profile
    (``Results.cfm?type=Horse&refno=...``). We key on those horse links so we
    never pick up the owner/trainer/jockey links that share the same script.
    """
    out: list[RosterEntry] = []
    seen: set[str] = set()
    for a in tree.css("a[href*='refno=']"):
        href = a.attributes.get("href", "")
        # Only horse-profile links (not type=People/Trainer/Jockey).
        if "type=Horse" not in href:
            continue
        name = a.text().strip()
        # Skip empties and non-name link text (dates, numbers, glyphs).
        if not name or name.lower() in seen or not any(ch.isalpha() for ch in name):
            continue
        m = href.split("refno=")
        refno = m[1].split("&")[0] if len(m) > 1 and m[1].split("&")[0] else None
        seen.add(name.lower())
        out.append(RosterEntry(name=name, equibase_refno=refno, discovered_via=via))
    return out


# --------------------------------------------------------------------------- #
# Results-page scan
# --------------------------------------------------------------------------- #


def scan_results_page(client: HttpClient, results_url: str) -> list[RosterEntry]:
    """Keep runners on a result chart whose owner passes the Winchell guard.

    Equibase charts pair each runner with its owner; we accept only rows where
    :func:`is_winchell_owner` is true. Returns empty when the page is blocked.
    """
    tree = get_html(client, results_url)
    if tree is None:
        return []
    out: list[RosterEntry] = []
    seen: set[str] = set()
    for table in tree.css("table"):
        for row in table.css("tr"):
            cells = [c.text().strip() for c in row.css("td")]
            if not cells:
                continue
            if any(is_winchell_owner(c) for c in cells):
                # The horse name is the row's first linked cell.
                link = row.css_first("a")
                name = link.text().strip() if link else None
                if name and name.lower() not in seen:
                    seen.add(name.lower())
                    out.append(RosterEntry(name=name, discovered_via="results_scan"))
    return out


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #


def discover_roster(
    client: HttpClient,
    *,
    owner_urls: Optional[list[str]] = None,
    results_urls: Optional[list[str]] = None,
    seed_path: Path = SEED_PATH,
) -> list[RosterEntry]:
    """Run all enabled discovery paths and return a de-duplicated roster."""
    merged: dict[str, RosterEntry] = {}

    def add(entries: list[RosterEntry]) -> None:
        for e in entries:
            if e.key in merged:
                merged[e.key].merge(e)
            else:
                merged[e.key] = e

    # Seed first so its rich hints (pedigree URL, sire, refno) win as the base.
    add(from_seed(seed_path))

    if SOURCES.get("equibase", {}).get("enabled"):
        for url in owner_urls or []:
            add(from_owner_page(client, url))
        for url in results_urls or []:
            add(scan_results_page(client, url))

    return sorted(merged.values(), key=lambda e: e.name.lower())
