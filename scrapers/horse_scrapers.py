"""Per-horse scrapers returning canonical models.

* :class:`PedigreeScraper`  — pedigreequery.com: sire/dam/damsire, a flattened
  three-generation table, and inbreeding derived from duplicated ancestors.
* :class:`ResultsScraper`   — Equibase: full race results, an aggregated
  :class:`FormSummary`, and career earnings.
* :class:`SalesScraper`     — Keeneland / Fasig-Tipton auction results.

Each parser was written against the live markup of a real page (see the module
tests / ``--verify`` output). Anything a source does not provide is left
``None``; nothing is invented.
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime
from typing import Optional

from selectolax.parser import HTMLParser

from .base import HttpClient, get_html
from .config import SOURCES
from pipeline.schema import (
    Pedigree,
    PedigreeNode,
    RaceResult,
    SaleRecord,
)

# --------------------------------------------------------------------------- #
# Shared helpers
# --------------------------------------------------------------------------- #

_YEAR_RE = re.compile(r"\b(1[89]\d\d|20\d\d)\b")
_COUNTRY_RE = re.compile(r"\(([A-Z]{2,3})\)")


def slugify_pq(name: str) -> str:
    """pedigreequery slug for a horse name: lower-case, spaces → ``+``."""
    cleaned = re.sub(r"[^\w\s'-]", "", name.strip().lower())
    cleaned = re.sub(r"\s+", "+", cleaned)
    return cleaned


def _money_to_int(text: str | None) -> Optional[int]:
    """Parse a currency string like ``"$1,234,567"`` to an int, else None."""
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


# --------------------------------------------------------------------------- #
# Pedigree
# --------------------------------------------------------------------------- #


class PedigreeScraper:
    """Fetch and parse a pedigree from pedigreequery.com."""

    def __init__(self, client: HttpClient) -> None:
        self.client = client
        self.base = SOURCES["pedigreequery"]["base_url"]

    # -- public API ---------------------------------------------------- #

    def resolve_url(
        self,
        name: str,
        *,
        expected_sire: Optional[str] = None,
        year_of_birth: Optional[int] = None,
        max_candidates: int = 8,
    ) -> Optional[str]:
        """Find the correct page URL for ``name``.

        Horse names collide on pedigreequery (the bare slug may be a namesake
        from decades ago), so when an expected sire or year of birth is known
        — typically from Equibase — we probe the bare slug then numbered
        variants and return the first whose sire / YOB matches. With no hint
        we return the bare slug.
        """
        base_slug = slugify_pq(name)
        candidates = [base_slug] + [f"{base_slug}{i}" for i in range(2, max_candidates + 1)]
        if expected_sire is None and year_of_birth is None:
            url = f"{self.base}/{base_slug}"
            return url if self.client.get(url) is not None else None

        exp_sire = (expected_sire or "").strip().lower() or None
        for slug in candidates:
            url = f"{self.base}/{slug}"
            html = self.client.get(url)
            if html is None:
                continue
            tree = HTMLParser(html)
            ped = self._parse_tree(tree)
            if ped is None:
                continue
            sire_ok = (
                exp_sire is None
                or (ped.sire and ped.sire.name and ped.sire.name.lower() == exp_sire)
            )
            year_ok = year_of_birth is None  # YOB of the subject isn't on this table
            if sire_ok and year_ok:
                return url
        return None

    def fetch(
        self,
        name: str,
        *,
        url: Optional[str] = None,
        expected_sire: Optional[str] = None,
        year_of_birth: Optional[int] = None,
    ) -> tuple[Optional[Pedigree], Optional[str]]:
        """Return ``(Pedigree, source_url)`` for a horse, or ``(None, None)``."""
        if url is None:
            url = self.resolve_url(
                name, expected_sire=expected_sire, year_of_birth=year_of_birth
            )
        if url is None:
            return None, None
        tree = get_html(self.client, url)
        if tree is None:
            return None, None
        ped = self._parse_tree(tree)
        return ped, (url if ped is not None else None)

    # -- parsing ------------------------------------------------------- #

    @staticmethod
    def _parse_cell(td) -> Optional[PedigreeNode]:
        link = td.css_first("a.horseName") or td.css_first("a")
        if link is None:
            return None
        name = link.text().strip()
        if not name:
            return None
        full = td.text()
        # Text after the name carries "(USA) b. 1999 [..]".
        tail = full.replace(name, "", 1)
        country_m = _COUNTRY_RE.search(tail)
        year_m = _YEAR_RE.search(tail)
        return PedigreeNode(
            name=name,
            year_of_birth=int(year_m.group(1)) if year_m else None,
            country=country_m.group(1) if country_m else None,
        )

    def _parse_tree(self, tree: HTMLParser) -> Optional[Pedigree]:
        table = tree.css_first("table.pedigreetable")
        if table is None:
            return None

        # Walk ancestor cells in document order (a pre-order traversal of the
        # pedigree binary tree). ``data-g`` gives the generation directly.
        # We reconstruct each ancestor's position (sire/dam path) by counting
        # children seen so far for the parent at the generation above.
        positions: dict[tuple[str, ...], PedigreeNode] = {}
        all_nodes: list[tuple[int, PedigreeNode]] = []  # (generation, node) for inbreeding
        last_path_at_gen: dict[int, tuple[str, ...]] = {0: ()}
        child_count: dict[tuple[str, ...], int] = defaultdict(int)

        for td in table.css("td[data-g]"):
            node = self._parse_cell(td)
            if node is None:
                continue
            try:
                gen = int(td.attributes.get("data-g", ""))
            except (TypeError, ValueError):
                continue
            parent = last_path_at_gen.get(gen - 1)
            if parent is None:
                continue
            idx = child_count[parent]
            child_count[parent] += 1
            label = "sire" if idx == 0 else "dam"
            path = parent + (label,)
            last_path_at_gen[gen] = path
            all_nodes.append((gen, node))
            if gen <= 3:
                positions[path] = node

        if not positions:
            return None

        def at(*path: str) -> Optional[PedigreeNode]:
            return positions.get(tuple(path))

        extended = {"_".join(path): node for path, node in positions.items()}

        return Pedigree(
            sire=at("sire"),
            dam=at("dam"),
            damsire=at("dam", "sire"),
            extended=extended,
            inbreeding=self._inbreeding(all_nodes),
        )

    @staticmethod
    def _inbreeding(all_nodes: list[tuple[int, PedigreeNode]]) -> list[str]:
        """Derive inbreeding notation from ancestors duplicated across the tree.

        For each name appearing more than once, list the generations at which
        it occurs, e.g. ``"Mr. Prospector 4x4"``. Computed from the parsed
        table only — nothing assumed.
        """
        gens_by_name: dict[str, list[int]] = defaultdict(list)
        for gen, node in all_nodes:
            if node.name:
                gens_by_name[node.name].append(gen)
        out: list[str] = []
        for name, gens in gens_by_name.items():
            if len(gens) >= 2:
                out.append(f"{name.title()} {'x'.join(str(g) for g in sorted(gens))}")
        # Most-duplicated first, then alphabetical for stability.
        out.sort(key=lambda s: (-s.count("x"), s))
        return out
