"""Orchestrator for the live-sales aggregator.

    python -m pipeline.livesales.run [--date YYYY-MM-DD] [--skip-lots] [--dry-run]

Fetches every source (failures isolated per source), dedups on catalogue_id,
filters to in-scope thoroughbred sales, marks New via the seen-ledger and
Active from the dates, pulls published lot catalogues, and writes the JSON
feed the Live Sales page consumes to ``public/data/sales/live/``.
``--dry-run`` writes a preview file under ``data/sales/live/`` instead and
leaves the ledger untouched.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from . import classify
from .base import build_session
from .config import DATA_DIR, FEED_FILENAME, PUBLISH_DIR, STATE_FILENAME, Settings
from .models import COUNTRY_ORDER, HOUSE_WEBSITE, Catalogue, RawSale
from .registry import SOURCES
from .store import SeenLedger

log = logging.getLogger("livesales")


def london_today() -> date:
    """'Today' is computed in Europe/London, matching the houses' calendars."""
    return datetime.now(ZoneInfo("Europe/London")).date()


def collect_raw_sales(
    session, today: date, sources=None
) -> tuple[list[RawSale], dict[str, str]]:
    """Run every source with per-source failure isolation; dedup across
    sources on catalogue_id (first source wins)."""
    source_status: dict[str, str] = {}
    by_id: dict[str, RawSale] = {}
    for source in sources if sources is not None else SOURCES:
        try:
            sales = source.fetch(session, today)
        except Exception as exc:
            log.warning("source %s failed: %r", source.key, exc)
            source_status[source.key] = f"ERR:{type(exc).__name__}"
            continue
        source_status[source.key] = str(len(sales))
        for sale in sales:
            sale.source_key = sale.source_key or source.key
            by_id.setdefault(sale.catalogue_id, sale)
    return (list(by_id.values()), source_status)


def build_catalogues(
    raw_sales: list[RawSale],
    today: date,
    settings: Settings,
    ledger: SeenLedger | None,
) -> list[Catalogue]:
    """Classify in-scope sales; ledger=None (dry runs) marks nothing New."""
    catalogues: list[Catalogue] = []
    for sale in raw_sales:
        if not classify.in_scope(sale, today, settings.horizon_days):
            continue
        if ledger is not None:
            is_new, first_seen = ledger.upsert(sale, today)
        else:
            is_new, first_seen = False, None
        active = classify.is_active(sale, today, settings.active_lead_days)
        catalogues.append(
            Catalogue(
                raw=sale,
                sale_type=classify.sale_type(sale),
                is_new=is_new,
                is_active=active,
                status_label=classify.status_label(sale, active, is_new),
                first_seen=first_seen,
            )
        )
    return catalogues


def attach_lots(catalogues: list[Catalogue], session) -> None:
    """Fetch published lot catalogues, isolating failures per catalogue. An
    empty result means "catalogue not published yet" — not an error."""
    fetchers = {s.key: s.fetch_lots for s in SOURCES}
    for cat in catalogues:
        fetch_lots = fetchers.get(cat.raw.source_key)
        if fetch_lots is None:
            continue
        try:
            cat.lots = fetch_lots(cat.raw, session)
        except Exception as exc:
            log.warning("lots for %s failed: %r", cat.catalogue_id, exc)
            cat.lots_error = f"ERR:{type(exc).__name__}"


def sort_catalogues(catalogues: list[Catalogue]) -> list[Catalogue]:
    """Fixed country order (unknown codes last under "Other" — never dropped);
    within a country: Active, then New, then start date (undated last), name."""
    def key(cat: Catalogue):
        country = cat.raw.country
        country_rank = (
            COUNTRY_ORDER.index(country) if country in COUNTRY_ORDER else len(COUNTRY_ORDER)
        )
        start = cat.raw.start_date
        return (
            country_rank,
            not cat.is_active,
            not cat.is_new,
            start is None,
            start or date.max,
            cat.raw.name.lower(),
        )

    return sorted(catalogues, key=key)


def serialize_feed(catalogues: list[Catalogue], source_status: dict[str, str]) -> dict:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "catalogues": [
            {
                "id": cat.catalogue_id,
                "house": cat.raw.house,
                "country": cat.raw.country,
                "name": cat.raw.name,
                "sale_type": cat.sale_type,
                "start_date": cat.raw.start_date.isoformat() if cat.raw.start_date else None,
                "end_date": cat.raw.end_date.isoformat() if cat.raw.end_date else None,
                "is_active": cat.is_active,
                "is_new": cat.is_new,
                "status": cat.status_label,
                "url": cat.raw.url,
                "house_url": HOUSE_WEBSITE.get(cat.raw.house, ""),
                "online": cat.raw.online,
                "first_seen": cat.first_seen.isoformat() if cat.first_seen else None,
                "lots_error": cat.lots_error,
                "lots": [
                    {
                        "lot_no": lot.lot_no,
                        "horse_name": lot.horse_name,
                        "sex": lot.sex,
                        "colour": lot.colour,
                        "sire": lot.sire,
                        "dam": lot.dam,
                        "dam_sire": lot.dam_sire,
                        "vendor": lot.vendor,
                    }
                    for lot in cat.lots
                ],
            }
            for cat in catalogues
        ],
        "diagnostics": {
            "source_status": ", ".join(f"{k}={v}" for k, v in source_status.items())
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Aggregate upcoming thoroughbred sales")
    parser.add_argument("--date", help="override 'today' (YYYY-MM-DD)")
    parser.add_argument("--skip-lots", action="store_true", help="calendar only, no lot fetches")
    parser.add_argument("--dry-run", action="store_true",
                        help="write a preview feed; do not touch the ledger or publish")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    today = date.fromisoformat(args.date) if args.date else london_today()
    settings = Settings.from_env()
    started_at = datetime.now(timezone.utc)

    session = build_session()
    raw_sales, source_status = collect_raw_sales(session, today)

    ledger = None if args.dry_run else SeenLedger(DATA_DIR / STATE_FILENAME)
    catalogues = sort_catalogues(build_catalogues(raw_sales, today, settings, ledger))
    if not args.skip_lots:
        attach_lots(catalogues, session)

    feed = serialize_feed(catalogues, source_status)
    summary = {
        "sources": source_status,
        "in_scope": len(catalogues),
        "active": sum(1 for c in catalogues if c.is_active),
        "new": sum(1 for c in catalogues if c.is_new),
        "lots": sum(len(c.lots) for c in catalogues),
    }

    if args.dry_run:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        feed_path = DATA_DIR / "live_sales.preview.json"
    else:
        PUBLISH_DIR.mkdir(parents=True, exist_ok=True)
        feed_path = PUBLISH_DIR / FEED_FILENAME
    feed_path.write_text(json.dumps(feed, indent=2, ensure_ascii=False) + "\n")
    log.info("wrote %s (%s)", feed_path, json.dumps(summary))

    if ledger is not None:
        ledger.log_run(today, started_at, "ok", summary)
        ledger.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
