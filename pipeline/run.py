"""Winchell Analytics pipeline CLI.

    python -m pipeline.run --refresh-roster      # discover the roster -> roster.json
    python -m pipeline.run --build-profiles      # scrape + score -> profiles + index
    python -m pipeline.run --publish             # copy JSON into the frontend

Flags compose, e.g. ``--refresh-roster --build-profiles --publish`` runs the
full chain. Network access is polite and cached; blocked sources degrade to
"no data found" rather than fabricated values.
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from scrapers.base import HttpClient
from scrapers.config import SOURCES, enabled_sources, is_winchell_owner
from scrapers.horse_scrapers import (
    HRNScraper,
    PedigreeScraper,
    ResultsScraper,
    SalesScraper,
)
from scrapers.owner_discovery import RosterEntry, discover_roster, from_seed
from scrapers.wiki import WikiScraper

from .build_profiles import build_profile, write_index_and_rollup, write_profile
from .schema import HorseProfile
from .score import summarise_form

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ROSTER_PATH = DATA_DIR / "roster.json"
PROFILES_DIR = DATA_DIR / "profiles"
# The existing Vite app fetches static JSON from public/data at runtime.
PUBLISH_DIR = Path(__file__).resolve().parent.parent / "public" / "data" / "portfolio"


# --------------------------------------------------------------------------- #
# Roster
# --------------------------------------------------------------------------- #


def refresh_roster(client: HttpClient, owner_urls=None, results_urls=None) -> list[RosterEntry]:
    roster = discover_roster(
        client, owner_urls=owner_urls, results_urls=results_urls
    )
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ROSTER_PATH.write_text(
        json.dumps([e.to_dict() for e in roster], indent=2), encoding="utf-8"
    )
    print(f"[roster] {len(roster)} horses -> {ROSTER_PATH.relative_to(DATA_DIR.parent)}")
    return roster


def load_roster() -> list[RosterEntry]:
    if ROSTER_PATH.exists():
        data = json.loads(ROSTER_PATH.read_text(encoding="utf-8"))
        return [
            RosterEntry(
                name=d["name"],
                year_of_birth=d.get("year_of_birth"),
                sire=d.get("sire"),
                equibase_refno=d.get("equibase_refno"),
                pedigree_url=d.get("pedigree_url"),
                discovered_via=d.get("discovered_via", "seed"),
            )
            for d in data
        ]
    # Fall back to the seed list if the roster has not been written yet.
    return from_seed()


# --------------------------------------------------------------------------- #
# Profiles
# --------------------------------------------------------------------------- #


def build_profiles(client: HttpClient, roster: list[RosterEntry]) -> list[HorseProfile]:
    ped_scraper = PedigreeScraper(client)
    results_scraper = ResultsScraper(client)
    sales_scraper = SalesScraper(client)
    wiki_scraper = WikiScraper(client)
    hrn_scraper = HRNScraper(client)

    profiles: list[HorseProfile] = []
    for entry in roster:
        sources: list[str] = []

        # Industry results + connections (primary): full race-by-race rows with
        # grades and speed figures, plus status / owner / trainer. Run first so
        # its sire can resolve pedigree/Wikipedia for owner-discovered horses
        # that arrive without a seed hint.
        hrn_results, conn, hrn_url = ([], None, None)
        if SOURCES["horseracingnation"]["enabled"]:
            hrn_results, conn, hrn_url = hrn_scraper.fetch(
                entry.name, expected_sire=entry.sire
            )
            if hrn_url:
                sources.append(hrn_url)

        sire_hint = entry.sire or (conn.sire if conn else None)

        pedigree, ped_url = (None, None)
        if SOURCES["pedigreequery"]["enabled"]:
            pedigree, ped_url = ped_scraper.fetch(
                entry.name,
                url=entry.pedigree_url,
                expected_sire=sire_hint,
                year_of_birth=entry.year_of_birth,
            )
            if ped_url:
                sources.append(ped_url)

        # Open, citable enrichment: record, earnings, owner confirmation, bio,
        # and the Equibase refno (used to target imported result charts).
        enr, enr_url = (None, None)
        if SOURCES["wikipedia"]["enabled"]:
            enr, enr_url = wiki_scraper.fetch(entry.name, expected_sire=sire_hint)
            if enr_url and enr:
                sources.append(enr_url)
                if enr.equibase_refno and not entry.equibase_refno:
                    entry.equibase_refno = enr.equibase_refno

        # An imported/reachable Equibase chart, when present, takes precedence
        # over HRN for the race-by-race rows.
        eq_results, res_url = ([], None)
        if SOURCES["equibase"]["enabled"] and entry.equibase_refno:
            eq_results, res_url = results_scraper.fetch(refno=entry.equibase_refno)
            if res_url and eq_results:
                sources.append(res_url)

        results = eq_results or hrn_results

        sales = sales_scraper.fetch(entry.name) if enabled_sources() else []

        # Form from results (rich: grades, speed, trajectory); fall back to the
        # Wikipedia record when no per-race rows resolved.
        form = summarise_form(results) if results else (enr.form if enr else None)
        # HRN/Equibase carry no career earnings total; fill it from Wikipedia.
        if (
            form is not None
            and form.total_earnings is None
            and enr is not None
            and enr.form is not None
            and enr.form.total_earnings is not None
        ):
            form.total_earnings = enr.form.total_earnings
            form.currency = "USD"

        # Connections: prefer HRN's racing-programme values, fall back to Wikipedia.
        owner_raw = (conn.owner if conn else None) or (enr.owner_raw if enr else None)
        ownership_note = f"Roster match via {entry.discovered_via}."
        if is_winchell_owner(owner_raw):
            src = "HRN" if conn and is_winchell_owner(conn.owner) else "Wikipedia"
            ownership_note = f"Ownership confirmed ({src}): {owner_raw}."
        elif owner_raw:
            ownership_note = (
                f"Winchell roster (seed); racing owner of record: {owner_raw}."
            )

        profile = build_profile(
            entry.name,
            year_of_birth=entry.year_of_birth or (enr.year_of_birth if enr else None),
            sex=(conn.sex if conn else None) or (enr.sex if enr else None),
            colour=enr.colour if enr else None,
            country=(conn.country if conn else None) or (enr.country if enr else None),
            breeder=enr.breeder if enr else None,
            current_trainer=(conn.trainer if conn else None) or (enr.trainer if enr else None),
            status=conn.status if conn else None,
            ownership_note=ownership_note,
            pedigree=pedigree,
            sales=sales,
            results=results,
            form=form,
            sources=sources,
        )
        if profile.pedigree is None and entry.sire:
            profile.ownership_note = (
                f"{profile.ownership_note} Sire (seed): {entry.sire}."
            )
        write_profile(profile)
        profiles.append(profile)
        flags = []
        if pedigree:
            flags.append("pedigree")
        if results:
            src = "Equibase" if eq_results else "HRN"
            flags.append(f"{len(results)} results ({src})")
        elif enr and enr.form:
            flags.append("record+earnings")
        if form and form.total_earnings:
            flags.append("earnings")
        if sales:
            flags.append(f"{len(sales)} sales")
        print(f"[profile] {entry.name:18} -> {', '.join(flags) or 'no data found'}")

    horses_path, portfolio_path = write_index_and_rollup(profiles)
    print(f"[index] {horses_path.name}, {portfolio_path.name} written")
    return profiles


# --------------------------------------------------------------------------- #
# Publish
# --------------------------------------------------------------------------- #


def publish() -> None:
    """Copy generated JSON into the frontend's static data directory.

    The site reads these at runtime from ``/data/portfolio/``. Committing them
    back to the repo (see the GitHub Action) triggers a Netlify rebuild.
    """
    PUBLISH_DIR.mkdir(parents=True, exist_ok=True)
    (PUBLISH_DIR / "profiles").mkdir(parents=True, exist_ok=True)

    copied = 0
    for fname in ("portfolio.json", "horses.json"):
        src = DATA_DIR / fname
        if src.exists():
            shutil.copy2(src, PUBLISH_DIR / fname)
            copied += 1
    if PROFILES_DIR.exists():
        for prof in PROFILES_DIR.glob("*.json"):
            shutil.copy2(prof, PUBLISH_DIR / "profiles" / prof.name)
            copied += 1
    print(f"[publish] {copied} files -> {PUBLISH_DIR.relative_to(PUBLISH_DIR.parents[2])}")

    # --- Optional S3 sync (uncomment + provide credentials/bucket) ---------
    # import boto3
    # s3 = boto3.client("s3")
    # bucket = os.environ["WINCHELL_S3_BUCKET"]
    # for path in PUBLISH_DIR.rglob("*.json"):
    #     key = f"portfolio/{path.relative_to(PUBLISH_DIR)}"
    #     s3.upload_file(str(path), bucket, key,
    #                    ExtraArgs={"ContentType": "application/json"})


# --------------------------------------------------------------------------- #
# Import browser-saved HTML
# --------------------------------------------------------------------------- #


def import_html(
    client: HttpClient,
    file: str,
    *,
    url: str | None = None,
    refno: str | None = None,
) -> None:
    """Seed the cache with a page you saved from your browser.

    Equibase result charts and auction-house pages are gated against automated
    fetching, but you can open them in your own browser and save the HTML. Drop
    that file in here, keyed by its source URL (or, for an Equibase horse, just
    its ``--refno``), and the next ``--build-profiles`` parses it through the
    normal path — no access control is circumvented.
    """
    if refno and not url:
        url = ResultsScraper(client).results_url(refno)
    if not url:
        raise SystemExit("--import-html requires --url or --refno")
    body = Path(file).read_text(encoding="utf-8", errors="replace")
    path = client.cache_put(url, body)
    try:
        shown = path.relative_to(DATA_DIR.parent)
    except ValueError:
        shown = path
    print(f"[import] {file} -> cached for {url}")
    print(f"[import] stored at {shown}")


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Winchell Analytics pipeline")
    parser.add_argument("--refresh-roster", action="store_true", help="rediscover the roster")
    parser.add_argument(
        "--owner-url",
        action="append",
        default=[],
        metavar="URL",
        help="Equibase owner page to discover runners from (repeatable; "
        "import the saved page first with --import-html --url URL)",
    )
    parser.add_argument("--build-profiles", action="store_true", help="scrape + score profiles")
    parser.add_argument("--publish", action="store_true", help="copy JSON into the frontend")
    parser.add_argument(
        "--import-html",
        metavar="FILE",
        help="seed the cache with a browser-saved page (use with --url or --refno)",
    )
    parser.add_argument("--url", help="source URL the imported FILE was saved from")
    parser.add_argument("--refno", help="Equibase refno for the imported results chart")
    parser.add_argument(
        "--offline",
        action="store_true",
        help="never hit the network; use cached responses only",
    )
    args = parser.parse_args(argv)

    if not any(
        [args.refresh_roster, args.build_profiles, args.publish, args.import_html]
    ):
        parser.print_help()
        return 1

    # Each source throttles to its own published crawl-delay (per-host), with a
    # conservative default for anything else.
    from urllib.parse import urlparse

    host_limits = {
        urlparse(cfg["base_url"]).netloc: float(cfg["rate_limit_seconds"])
        for cfg in SOURCES.values()
    }
    client = HttpClient(
        rate_limit_seconds=2.0, host_rate_limits=host_limits, offline=args.offline
    )
    try:
        if args.import_html:
            import_html(client, args.import_html, url=args.url, refno=args.refno)
        roster = (
            refresh_roster(client, owner_urls=args.owner_url)
            if args.refresh_roster
            else load_roster()
        )
        if args.build_profiles:
            build_profiles(client, roster)
        if args.publish:
            publish()
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
