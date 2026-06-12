"""Environment-driven configuration for the live-sales run."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# Seen-ledger state (committed across runs so "New" detection persists).
DATA_DIR = REPO_ROOT / "data" / "sales" / "live"
# The feed is written straight to public/ and fetched at runtime: anything
# under /data/**/*.json is eagerly bundled into the JS bundle by src/lib/data.ts,
# and a lots-heavy feed does not belong there.
PUBLISH_DIR = REPO_ROOT / "public" / "data" / "sales" / "live"
FEED_FILENAME = "live_sales.json"
STATE_FILENAME = "state.sqlite"


@dataclass(frozen=True)
class Settings:
    active_lead_days: int = 2  # "Active" from N days before the first day
    horizon_days: int = 30  # keep sales starting within N days

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            active_lead_days=int(os.environ.get("ACTIVE_LEAD_DAYS", "2")),
            horizon_days=int(os.environ.get("HORIZON_DAYS", "30")),
        )
