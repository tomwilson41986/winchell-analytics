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
from scrapers.config import SOURCES, enabled_sources
from scrapers.horse_scrapers import PedigreeScraper, ResultsScraper, SalesScraper
from scrapers.owner_discovery import RosterEntry, discover_roster, from_seed

from .build_profiles import build_profile, write_index_and_rollup, write_profile
from .schema import HorseProfile

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

    profiles: list[HorseProfile] = []
    for entry in roster:
        sources: list[str] = []

        pedigree, ped_url = (None, None)
        if SOURCES["pedigreequery"]["enabled"]:
            pedigree, ped_url = ped_scraper.fetch(
                entry.name,
                url=entry.pedigree_url,
                expected_sire=entry.sire,
                year_of_birth=entry.year_of_birth,
            )
            if ped_url:
                sources.append(ped_url)

        results, res_url = ([], None)
        if SOURCES["equibase"]["enabled"] and entry.equibase_refno:
            results, res_url = results_scraper.fetch(refno=entry.equibase_refno)
            if res_url and results:
                sources.append(res_url)

        sales = sales_scraper.fetch(entry.name) if enabled_sources() else []

        sire_from_seed = entry.sire
        profile = build_profile(
            entry.name,
            year_of_birth=entry.year_of_birth,
            ownership_note=f"Roster match via {entry.discovered_via}.",
            pedigree=pedigree,
            sales=sales,
            results=results,
            sources=sources,
        )
        # Keep the verified sire hint visible even when no pedigree resolved.
        if profile.pedigree is None and sire_from_seed:
            profile.ownership_note = (
                f"{profile.ownership_note} Sire (seed): {sire_from_seed}."
            )
        write_profile(profile)
        profiles.append(profile)
        flags = []
        if pedigree:
            flags.append("pedigree")
        if results:
            flags.append(f"{len(results)} results")
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
# CLI
# --------------------------------------------------------------------------- #


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Winchell Analytics pipeline")
    parser.add_argument("--refresh-roster", action="store_true", help="rediscover the roster")
    parser.add_argument("--build-profiles", action="store_true", help="scrape + score profiles")
    parser.add_argument("--publish", action="store_true", help="copy JSON into the frontend")
    parser.add_argument(
        "--offline",
        action="store_true",
        help="never hit the network; use cached responses only",
    )
    args = parser.parse_args(argv)

    if not any([args.refresh_roster, args.build_profiles, args.publish]):
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
        roster = refresh_roster(client) if args.refresh_roster else load_roster()
        if args.build_profiles:
            build_profiles(client, roster)
        if args.publish:
            publish()
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
