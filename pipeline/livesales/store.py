"""SQLite seen-ledger: persists which catalogue_ids we have ever seen so the
first sighting of a sale can be flagged "New", plus a run log for diagnostics."""

from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path

from .models import RawSale

_SCHEMA = """
CREATE TABLE IF NOT EXISTS seen_catalogue (
    catalogue_id TEXT PRIMARY KEY,
    house TEXT NOT NULL, country TEXT NOT NULL, name TEXT NOT NULL,
    start_date TEXT, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS run_log (
    run_date TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT,
    summary_json TEXT
);
"""


class SeenLedger:
    def __init__(self, path: Path | str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.path))
        self.conn.executescript(_SCHEMA)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    def upsert(self, sale: RawSale, today: date) -> tuple[bool, date]:
        """Record a sighting. Returns (is_new, first_seen).

        Inserts with first_seen = today on the first ever sighting; afterwards
        only bumps last_seen. A sale stays "New" for the whole day it first
        appeared (so reruns on the same day agree).
        """
        cid = sale.catalogue_id
        row = self.conn.execute(
            "SELECT first_seen FROM seen_catalogue WHERE catalogue_id = ?", (cid,)
        ).fetchone()
        if row is None:
            self.conn.execute(
                "INSERT INTO seen_catalogue "
                "(catalogue_id, house, country, name, start_date, first_seen, last_seen) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    cid,
                    sale.house,
                    sale.country,
                    sale.name,
                    sale.start_date.isoformat() if sale.start_date else None,
                    today.isoformat(),
                    today.isoformat(),
                ),
            )
            self.conn.commit()
            return (True, today)
        first_seen = date.fromisoformat(row[0])
        self.conn.execute(
            "UPDATE seen_catalogue SET last_seen = ? WHERE catalogue_id = ?",
            (today.isoformat(), cid),
        )
        self.conn.commit()
        return (first_seen == today, first_seen)

    def log_run(self, run_date: date, started_at: datetime, status: str,
                summary: dict) -> None:
        self.conn.execute(
            "INSERT INTO run_log (run_date, started_at, finished_at, status, summary_json) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                run_date.isoformat(),
                started_at.isoformat(),
                datetime.now(timezone.utc).isoformat(),
                status,
                json.dumps(summary),
            ),
        )
        self.conn.commit()
