"""Targeted pedigree backfill for existing profiles.

    python -m pipeline.backfill_pedigrees [--publish] [--force]

Re-resolves the pedigree for every profile that lacks one, without touching
any other profile data (results, form, earnings stay exactly as built). A
pedigree is only accepted when the roster's sire hint verifies the page —
pedigreequery slugs collide across decades of namesakes, and attaching a
namesake's pedigree would be fabrication. Profiles whose hint cannot be
verified are left with no pedigree ("no data found" on the site).

Rewrites horses.json / portfolio.json from the updated profiles afterwards.
"""

from __future__ import annotations

import argparse
import sys

from scrapers.base import HttpClient
from scrapers.horse_scrapers import PedigreeScraper

from .build_profiles import PROFILES_DIR, slugify, write_index_and_rollup, write_profile
from .run import load_roster, publish
from .schema import HorseProfile, utc_now_iso


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Backfill missing pedigrees")
    parser.add_argument("--publish", action="store_true",
                        help="copy the refreshed JSON into public/data/portfolio")
    parser.add_argument("--force", action="store_true",
                        help="re-resolve pedigrees even where one exists")
    args = parser.parse_args(argv)

    hints = {slugify(e.name): e for e in load_roster()}
    profiles = [
        HorseProfile.model_validate_json(path.read_text(encoding="utf-8"))
        for path in sorted(PROFILES_DIR.glob("*.json"))
    ]

    client = HttpClient()
    scraper = PedigreeScraper(client)
    filled = skipped = unresolved = 0

    for profile in profiles:
        if profile.pedigree is not None and not args.force:
            continue
        entry = hints.get(profile.horse_id)
        sire_hint = entry.sire if entry else None
        if not sire_hint:
            # No way to verify a candidate page against namesakes: leave empty.
            print(f"[pedigree] {profile.name:18} -> skipped (no sire hint to verify)")
            skipped += 1
            continue
        pedigree, url = scraper.fetch(
            profile.name,
            url=entry.pedigree_url,
            expected_sire=sire_hint,
            year_of_birth=entry.year_of_birth or profile.year_of_birth,
        )
        if pedigree is None:
            # Common names sit deep in pedigreequery's numbered namesake
            # slugs; probe further before giving up (still sire-verified).
            deep_url = scraper.resolve_url(
                profile.name,
                expected_sire=sire_hint,
                year_of_birth=entry.year_of_birth or profile.year_of_birth,
                max_candidates=20,
            )
            if deep_url:
                pedigree, url = scraper.fetch(profile.name, url=deep_url,
                                              expected_sire=sire_hint)
        if pedigree is None:
            print(f"[pedigree] {profile.name:18} -> no verified match")
            unresolved += 1
            continue
        profile.pedigree = pedigree
        if url and url not in profile.sources:
            profile.sources.append(url)
        profile.last_updated = utc_now_iso()
        write_profile(profile)
        print(f"[pedigree] {profile.name:18} -> {pedigree.sire.name if pedigree.sire else '?'}"
              f" x {pedigree.dam.name if pedigree.dam else '?'}")
        filled += 1

    write_index_and_rollup(profiles)
    print(f"[done] filled={filled} unresolved={unresolved} skipped={skipped}")

    if args.publish:
        publish()
    return 0


if __name__ == "__main__":
    sys.exit(main())
