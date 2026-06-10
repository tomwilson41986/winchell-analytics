"""Per-horse scrapers returning canonical models.

* :class:`PedigreeScraper`  — pedigreequery.com: sire/dam/damsire, a flattened
  three-generation table, and inbreeding derived from duplicated ancestors.
* :class:`HRNScraper`       — Horse Racing Nation: full race-by-race results
  (grades + speed figures), status, owner, trainer and pedigree summary.
* :class:`ResultsScraper`   — Equibase: official charts (per-race earnings),
  fed via browser-saved HTML; takes precedence over HRN when present.
* :class:`SalesScraper`     — Keeneland / Fasig-Tipton auction results.

The pedigree and HRN parsers were written and verified against live markup.
Equibase and the auction houses gate their data behind bot protection /
JavaScript portals, so those parsers are header-driven and block-aware: they run
against pages saved from a browser into ``data/cache/`` and degrade to
``None``/empty on a live block. Anything a source does not provide is left
``None``; nothing is invented.
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
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


def _norm_name(name: str | None) -> str:
    """Compact a horse name for equality: lower-case, strip all non-alphanumerics.

    Collapsing to a spaceless, punctuation-free form means "Giant's Causeway"
    and "GIANTS CAUSEWAY" compare equal.
    """
    if not name:
        return ""
    return re.sub(r"[^a-z0-9]+", "", name.lower())


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

        exp_sire = _norm_name(expected_sire) or None
        for slug in candidates:
            url = f"{self.base}/{slug}"
            html = self.client.get(url)
            if html is None:
                continue
            tree = HTMLParser(html)
            ped = self._parse_tree(tree)
            if ped is None:
                continue
            # The subject's own YOB is not printed on the pedigree table, so it
            # cannot disambiguate here; selection rests on the sire match.
            sire_ok = (
                exp_sire is None
                or (ped.sire is not None and _norm_name(ped.sire.name) == exp_sire)
            )
            if sire_ok:
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


# --------------------------------------------------------------------------- #
# Header-driven table extraction (shared by results + sales)
# --------------------------------------------------------------------------- #


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip()).lower()


def extract_labelled_table(
    tree: HTMLParser, want_headers: set[str]
) -> Optional[list[dict[str, str]]]:
    """Find the table whose header row best matches ``want_headers`` and return
    its body rows as ``{header_label: cell_text}`` dicts.

    Mapping columns by header label (rather than fixed positions) keeps the
    parser resilient to layout changes and to the column-order differences
    between sources. Returns ``None`` when no suitable table is found.
    """
    best: Optional[tuple[int, list[str], list]] = None
    for table in tree.css("table"):
        rows = table.css("tr")
        if len(rows) < 2:
            continue
        # Header row = first row with >=2 th, else first row's cells.
        header_cells = rows[0].css("th") or rows[0].css("td")
        headers = [_norm(c.text()) for c in header_cells]
        if not headers:
            continue
        score = sum(
            1 for h in headers if any(w in h for w in want_headers)
        )
        if score >= 2 and (best is None or score > best[0]):
            best = (score, headers, rows)
    if best is None:
        return None
    _, headers, rows = best
    out: list[dict[str, str]] = []
    for row in rows[1:]:
        cells = row.css("td")
        if not cells:
            continue
        record = {}
        for i, cell in enumerate(cells):
            if i < len(headers) and headers[i]:
                record[headers[i]] = cell.text().strip()
        if any(v for v in record.values()):
            out.append(record)
    return out


def _pick(record: dict[str, str], *needles: str) -> Optional[str]:
    """Return the first value whose header contains any needle."""
    for key, val in record.items():
        if any(n in key for n in needles):
            return val or None
    return None


def _parse_date(text: str | None) -> Optional[date]:
    if not text:
        return None
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%d %b %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(text.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _parse_int(text: str | None) -> Optional[int]:
    if not text:
        return None
    m = re.search(r"-?\d+", text.replace(",", ""))
    return int(m.group()) if m else None


def _parse_furlongs(text: str | None) -> Optional[float]:
    """Convert a distance string to furlongs where possible.

    Handles "6 Furlongs", "1 1/16 Miles", "1m", "7f". Returns None when the
    format is not understood — never guesses.
    """
    if not text:
        return None
    t = text.strip().lower()
    # Mixed-number miles, e.g. "1 1/16 miles".
    m = re.search(r"(\d+)\s+(\d+)/(\d+)\s*m", t)
    if m:
        whole, num, den = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return round((whole + num / den) * 8, 2)
    m = re.search(r"(\d+(?:\.\d+)?)\s*m(?:ile)?", t)
    if m:
        return round(float(m.group(1)) * 8, 2)
    m = re.search(r"(\d+(?:\.\d+)?)\s*f", t)
    if m:
        return float(m.group(1))
    m = re.search(r"(\d+(?:\.\d+)?)\s*fur", t)
    if m:
        return float(m.group(1))
    return None


def _grade_from_text(text: str | None) -> Optional[str]:
    if not text:
        return None
    m = re.search(r"\bG\s?([123])\b", text, re.I) or re.search(r"\(G([123])\)", text, re.I)
    if m:
        return f"G{m.group(1)}"
    if re.search(r"\b(listed|black[\s-]?type)\b", text, re.I):
        return "Listed"
    return None


# --------------------------------------------------------------------------- #
# Results (Equibase)
# --------------------------------------------------------------------------- #


class ResultsScraper:
    """Race results + aggregated form + earnings from Equibase.

    NOTE ON ACCESS: Equibase fronts its profile pages with Imperva bot
    protection. When the fetch returns a challenge page :class:`HttpClient`
    yields no body and this scraper returns empty results — no fabrication.
    The parser is header-driven, so it also runs against a results page saved
    from a browser and dropped into ``data/cache/`` (a ToS-clean way to supply
    data). It has therefore been validated structurally but not against a live
    Equibase fetch, which is currently blocked.
    """

    RESULT_HEADERS = {"date", "track", "finish", "fin", "dist", "jockey", "race"}

    def __init__(self, client: HttpClient) -> None:
        self.client = client
        self.base = SOURCES["equibase"]["base_url"]

    def results_url(self, refno: str, registry: str = "T") -> str:
        return (
            f"{self.base}/profiles/Results.cfm?"
            f"type=Horse&refno={refno}&registry={registry}"
        )

    def fetch(
        self, *, refno: Optional[str] = None, url: Optional[str] = None
    ) -> tuple[list[RaceResult], Optional[str]]:
        """Return ``(results, source_url)``; empty list when blocked/absent."""
        if url is None:
            if refno is None:
                return [], None
            url = self.results_url(refno)
        tree = get_html(self.client, url)
        if tree is None:
            return [], None
        return self.parse_results(tree), url

    @classmethod
    def parse_results(cls, tree: HTMLParser) -> list[RaceResult]:
        rows = extract_labelled_table(tree, cls.RESULT_HEADERS)
        if not rows:
            return []
        out: list[RaceResult] = []
        for r in rows:
            fin = _pick(r, "fin")
            dist = _pick(r, "dist")
            race_name = _pick(r, "race", "stakes", "cond") or ""
            grade = _grade_from_text(race_name) or _grade_from_text(_pick(r, "grade"))
            out.append(
                RaceResult(
                    race_date=_parse_date(_pick(r, "date")),
                    track=_pick(r, "track"),
                    race_name=race_name or None,
                    surface=_pick(r, "surf", "course"),
                    distance_furlongs=_parse_furlongs(dist),
                    going=_pick(r, "cond", "going", "track cond"),
                    grade=grade,
                    finish_position=_parse_int(fin),
                    field_size=_parse_int(_pick(r, "field", "starters", "#")),
                    margin=_pick(r, "margin", "beaten", "lengths"),
                    jockey=_pick(r, "jockey"),
                    trainer=_pick(r, "trainer"),
                    earnings=_money_to_int(_pick(r, "earn", "purse", "$")),
                    currency="USD",
                    speed_figure=_parse_int(_pick(r, "speed", "fig", "spd")),
                    comment=_pick(r, "comment", "trip", "note"),
                )
            )
        return out


# --------------------------------------------------------------------------- #
# Sales (Keeneland / Fasig-Tipton)
# --------------------------------------------------------------------------- #


class SalesScraper:
    """Auction results by horse name / hip across enabled sale houses.

    Keeneland and Fasig-Tipton expose historical results through JavaScript
    "digital" portals rather than name-searchable static HTML, so a live
    fetch typically yields nothing here and the scraper returns an empty list
    (no fabrication). The parser is header-driven and runs against a results
    page saved from a browser and dropped into ``data/cache/``.
    """

    SALE_HEADERS = {"hip", "lot", "price", "name", "consignor", "buyer", "sold"}
    HOUSES = {
        "keeneland": "Keeneland",
        "fasigtipton": "Fasig-Tipton",
    }

    def __init__(self, client: HttpClient) -> None:
        self.client = client

    def fetch(self, name: str, urls: Optional[list[str]] = None) -> list[SaleRecord]:
        """Return sale records for ``name`` from any reachable source URLs."""
        records: list[SaleRecord] = []
        for source, label in self.HOUSES.items():
            cfg = SOURCES.get(source, {})
            if not cfg.get("enabled"):
                continue
            for url in self._candidate_urls(source, urls):
                tree = get_html(self.client, url)
                if tree is None:
                    continue
                records.extend(self.parse_sales(tree, name=name, house=label))
        return records

    @staticmethod
    def _candidate_urls(source: str, urls: Optional[list[str]]) -> list[str]:
        # Without a public name-search API we rely on caller-supplied result
        # URLs (or browser-saved pages in the cache). No guessing of endpoints.
        return urls or []

    @classmethod
    def parse_sales(
        cls, tree: HTMLParser, *, name: str, house: Optional[str] = None
    ) -> list[SaleRecord]:
        rows = extract_labelled_table(tree, cls.SALE_HEADERS)
        if not rows:
            return []
        target = _norm(name)
        out: list[SaleRecord] = []
        for r in rows:
            row_name = _pick(r, "name", "horse")
            if row_name and target and target not in _norm(row_name):
                continue
            price_text = _pick(r, "price", "amount", "sold", "$")
            rna = bool(price_text and re.search(r"rna|not\s*sold|buy[\s-]?back|out", price_text, re.I))
            out.append(
                SaleRecord(
                    sale_house=house,
                    sale_name=_pick(r, "sale", "session"),
                    sale_date=_parse_date(_pick(r, "date")),
                    lot=_pick(r, "hip", "lot"),
                    price=None if rna else _money_to_int(price_text),
                    currency="USD",
                    buyer=_pick(r, "buyer", "purchaser"),
                    consignor=_pick(r, "consignor", "seller"),
                    rfna=rna,
                )
            )
        return out


# --------------------------------------------------------------------------- #
# Horse Racing Nation (industry results + connections)
# --------------------------------------------------------------------------- #


@dataclass
class HRNConnections:
    """Connection / status facts from an HRN horse page."""

    status: Optional[str] = None       # "Active" / "Retired" / ...
    sex: Optional[str] = None          # "Horse" / "Mare" / "Filly" / ...
    owner: Optional[str] = None
    trainer: Optional[str] = None
    breeder: Optional[str] = None
    country: Optional[str] = None
    sire: Optional[str] = None
    dam: Optional[str] = None
    damsire: Optional[str] = None


class HRNScraper:
    """Race results and connections from horseracingnation.com.

    HRN serves horse pages as static HTML (the generic robots agent is allowed
    on ``/horse/`` paths). The results table carries the grade in the race name
    and an HRN speed figure per run, so graded wins, best speed figure and the
    class-trajectory score all populate from real data. Career earnings are not
    on the page, so that field is left to other sources.
    """

    def __init__(self, client: HttpClient) -> None:
        self.client = client
        self.base = SOURCES["horseracingnation"]["base_url"]

    @staticmethod
    def _slug(name: str) -> str:
        s = re.sub(r"[^\w\s'-]", "", name.strip())
        return re.sub(r"\s+", "_", s)

    def resolve(
        self, name: str, expected_sire: Optional[str] = None, max_candidates: int = 6
    ) -> Optional[tuple[str, HTMLParser]]:
        base_slug = self._slug(name)
        candidates = [base_slug] + [f"{base_slug}_{i}" for i in range(2, max_candidates + 1)]
        exp = _norm_name(expected_sire) if expected_sire else None
        for slug in candidates:
            url = f"{self.base}/horse/{slug}"
            body = self.client.get(url)
            if not body:
                continue
            tree = HTMLParser(body)
            if tree.css_first("table.horse-table") is None and tree.css_first("dl") is None:
                continue
            if exp:
                conn = self._connections(tree)
                if conn.sire and _norm_name(conn.sire) != exp:
                    continue
            return url, tree
        return None

    def fetch(
        self, name: str, *, expected_sire: Optional[str] = None
    ) -> tuple[list[RaceResult], Optional[HRNConnections], Optional[str]]:
        found = self.resolve(name, expected_sire=expected_sire)
        if found is None:
            return [], None, None
        url, tree = found
        return self.parse_results(tree), self._connections(tree), url

    @staticmethod
    def _connections(tree: HTMLParser) -> HRNConnections:
        conn = HRNConnections()
        dl = tree.css_first("dl")
        if dl is None:
            return conn
        pairs: dict[str, str] = {}
        dts, dds = dl.css("dt"), dl.css("dd")
        for dt, dd in zip(dts, dds):
            key = dt.text(strip=True).rstrip(":").lower()
            pairs[key] = dd.text(separator=" ", strip=True)
        # "Age: 13 years old - Horse" -> sex is the trailing token.
        age = pairs.get("age", "")
        if "-" in age:
            conn.sex = age.split("-")[-1].strip() or None
        conn.status = pairs.get("status") or None
        conn.owner = pairs.get("owner(s)") or pairs.get("owner") or None
        conn.trainer = pairs.get("trainer") or None
        # "Pedigree: Candy Ride - Quiet Giant by Giant's Causeway"
        ped = pairs.get("pedigree", "")
        m = re.match(r"\s*(.+?)\s*-\s*(.+?)\s+by\s+(.+?)\s*$", ped)
        if m:
            conn.sire, conn.dam, conn.damsire = (g.strip() for g in m.groups())
        bred = pairs.get("bred", "")
        if bred:
            conn.country = bred.split(" by")[0].strip() or None
        return conn

    @classmethod
    def parse_results(cls, tree: HTMLParser) -> list[RaceResult]:
        table = tree.css_first("table.horse-table") or (
            tree.css("table")[0] if tree.css("table") else None
        )
        if table is None:
            return []
        rows = table.css("tr")
        # Locate the header row carrying "Date" + "Finish".
        header_idx = None
        headers: list[str] = []
        for i, row in enumerate(rows):
            cells = [_norm(c.text()) for c in row.css("th, td")]
            if any("date" in c for c in cells) and any("finish" in c for c in cells):
                header_idx, headers = i, cells
                break
        if header_idx is None:
            return []

        def col(*needles: str) -> Optional[int]:
            for idx, h in enumerate(headers):
                if any(n in h for n in needles):
                    return idx
                    
            return None

        ci = {
            "date": col("date"),
            "finish": col("finish"),
            "track": col("trk", "track"),
            "distance": col("distance", "dist"),
            "surface": col("surface"),
            "race": col("race"),
            "time": col("time"),
        }
        out: list[RaceResult] = []
        for row in rows[header_idx + 1 :]:
            tds = row.css("td")
            if len(tds) < len(headers):
                continue

            def cell(key: str) -> Optional[str]:
                idx = ci[key]
                return tds[idx].text(strip=True) if idx is not None and idx < len(tds) else None

            fin_text = cell("finish") or ""
            fm = re.search(r"(\d+)\w{2}\s*\((\d+)\)", fin_text) or re.search(r"(\d+)\w{2}", fin_text)
            finish = int(fm.group(1)) if fm else None
            speed = int(fm.group(2)) if fm and fm.lastindex and fm.lastindex >= 2 else None
            race_name = cell("race")
            out.append(
                RaceResult(
                    race_date=_parse_date(cell("date")),
                    track=cell("track"),
                    race_name=race_name,
                    surface=cell("surface"),
                    distance_furlongs=_parse_furlongs(cell("distance")),
                    grade=_grade_from_text(race_name),
                    finish_position=finish,
                    speed_figure=speed,
                    comment=cell("time"),
                )
            )
        return out
