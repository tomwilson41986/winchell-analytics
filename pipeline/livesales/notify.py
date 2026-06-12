"""Per-user Web Push notifications for live-sales subscriptions.

    python -m pipeline.livesales.notify [--dry-run]

Runs right after the aggregator in the daily workflow. Reads every user's
sale and sire subscriptions from Supabase (service-role key), diffs the
freshly generated feed against the ``push_sent`` ledger, and sends one Web
Push per user summarising what is new: entries by watched sires/damsires,
catalogues publishing or growing, subscribed sales going active.

The first time a subscription is seen, its current state is recorded
*silently* (baseline) so users are only pushed about changes that happen
after they subscribed. Exits quietly when the Supabase/VAPID environment is
not configured, so the workflow step can run unconditionally.

Required environment:
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
    VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:... or https origin)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from dataclasses import dataclass, field

import requests

from .config import FEED_FILENAME, PUBLISH_DIR

log = logging.getLogger("livesales.notify")

SITE_URL = "/sales/live"
MAX_BODY_LINES = 6


def normalize_horse_name(name: str) -> str:
    """Mirror of normalizeHorseName in src/lib/saleSubscriptions.ts — the two
    must agree or site-side counts and pipeline pushes will disagree."""
    lowered = (name or "").lower()
    lowered = re.sub(r"\([a-z]{2,4}\)\s*$", "", lowered)
    return re.sub(r"[^a-z0-9]+", " ", lowered).strip()


# --- Pure event computation --------------------------------------------------- //


@dataclass
class UserEvents:
    """What one user should be told this run, plus the ledger rows to write."""

    lines: list[str] = field(default_factory=list)
    sent_keys: list[str] = field(default_factory=list)  # includes silent baselines


def _sale_state_keys(cat: dict) -> list[str]:
    keys = []
    if cat["lots"]:
        keys.append(f"sale-lots|{cat['id']}|{len(cat['lots'])}")
    if cat["is_active"]:
        keys.append(f"sale-active|{cat['id']}")
    return keys


def _sire_lot_keys(cat: dict, sire_key: str) -> list[str]:
    keys = []
    for lot in cat["lots"]:
        if (
            normalize_horse_name(lot.get("sire", "")) == sire_key
            or normalize_horse_name(lot.get("dam_sire", "")) == sire_key
        ):
            keys.append(f"sire|{sire_key}|{cat['id']}|{lot.get('lot_no', '')}")
    return keys


def compute_user_events(
    catalogues: list[dict],
    sale_sub_ids: list[str],
    sire_subs: list[tuple[str, str]],  # (sire_key, display name)
    already_sent: set[str],
) -> UserEvents:
    out = UserEvents()
    by_id = {c["id"]: c for c in catalogues}

    for catalogue_id in sale_sub_ids:
        cat = by_id.get(catalogue_id)
        if cat is None:
            continue
        baseline = f"baseline|sale|{catalogue_id}"
        if baseline not in already_sent:
            out.sent_keys.append(baseline)
            out.sent_keys.extend(
                k for k in _sale_state_keys(cat) if k not in already_sent
            )
            continue
        lots = len(cat["lots"])
        lots_key = f"sale-lots|{catalogue_id}|{lots}"
        if lots and lots_key not in already_sent:
            had_lots_before = any(
                k.startswith(f"sale-lots|{catalogue_id}|") for k in already_sent
            )
            out.lines.append(
                f"{cat['name']}: catalogue {'now ' if had_lots_before else 'published — '}{lots} lots"
            )
            out.sent_keys.append(lots_key)
        active_key = f"sale-active|{catalogue_id}"
        if cat["is_active"] and active_key not in already_sent:
            out.lines.append(f"{cat['name']} is now active")
            out.sent_keys.append(active_key)

    for sire_key, sire_name in sire_subs:
        baseline = f"baseline|sire|{sire_key}"
        current_keys: list[str] = []
        sale_names: list[str] = []
        for cat in catalogues:
            matched = _sire_lot_keys(cat, sire_key)
            if matched:
                current_keys.extend(matched)
                sale_names.append(cat["name"])
        if baseline not in already_sent:
            out.sent_keys.append(baseline)
            out.sent_keys.extend(k for k in current_keys if k not in already_sent)
            continue
        new_keys = [k for k in current_keys if k not in already_sent]
        if new_keys:
            n = len(new_keys)
            out.lines.append(
                f"{n} new {'entry' if n == 1 else 'entries'} by {sire_name}"
                f" ({', '.join(sale_names)})"
            )
            out.sent_keys.extend(new_keys)

    return out


# --- Supabase REST (service role; bypasses RLS) -------------------------------- //


class SupabaseRest:
    def __init__(self, url: str, service_key: str):
        self.base = url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        }

    def fetch_all(self, table: str, select: str) -> list[dict]:
        rows: list[dict] = []
        page = 1000
        offset = 0
        while True:
            resp = requests.get(
                f"{self.base}/{table}",
                headers={**self.headers, "Range": f"{offset}-{offset + page - 1}"},
                params={"select": select},
                timeout=30,
            )
            resp.raise_for_status()
            batch = resp.json()
            rows.extend(batch)
            if len(batch) < page:
                return rows
            offset += page

    def insert_ignore_duplicates(self, table: str, rows: list[dict]) -> None:
        if not rows:
            return
        resp = requests.post(
            f"{self.base}/{table}",
            headers={
                **self.headers,
                "Prefer": "resolution=ignore-duplicates,return=minimal",
            },
            json=rows,
            timeout=30,
        )
        resp.raise_for_status()

    def delete_push_endpoint(self, endpoint: str) -> None:
        requests.delete(
            f"{self.base}/push_subscriptions",
            headers=self.headers,
            params={"endpoint": f"eq.{endpoint}"},
            timeout=30,
        )


# --- Delivery ------------------------------------------------------------------ //


def send_webpush(device: dict, payload: dict, private_key: str, subject: str) -> bool:
    """Send one push. Returns False when the endpoint is gone (unsubscribe)."""
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info={
                "endpoint": device["endpoint"],
                "keys": {"p256dh": device["p256dh"], "auth": device["auth"]},
            },
            data=json.dumps(payload),
            vapid_private_key=private_key,
            vapid_claims={"sub": subject},
        )
        return True
    except WebPushException as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in (404, 410):
            return False  # endpoint expired or user revoked permission
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Push live-sales notifications")
    parser.add_argument("--dry-run", action="store_true",
                        help="compute and print, but send/record nothing")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    supabase_url = os.environ.get("SUPABASE_URL", "")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    vapid_private = os.environ.get("VAPID_PRIVATE_KEY", "")
    vapid_subject = os.environ.get("VAPID_SUBJECT", "")
    if not (supabase_url and service_key and vapid_private and vapid_subject):
        log.info("push notifications not configured (missing Supabase/VAPID env); skipping")
        return 0

    feed_path = PUBLISH_DIR / FEED_FILENAME
    if not feed_path.exists():
        log.warning("no feed at %s — run pipeline.livesales.run first", feed_path)
        return 1
    catalogues = json.loads(feed_path.read_text())["catalogues"]

    db = SupabaseRest(supabase_url, service_key)
    sale_rows = db.fetch_all("sale_subscriptions", "user_id,catalogue_id")
    sire_rows = db.fetch_all("sire_subscriptions", "user_id,sire_key,sire_name")
    devices = db.fetch_all("push_subscriptions", "user_id,endpoint,p256dh,auth")
    sent_rows = db.fetch_all("push_sent", "user_id,event_key")

    sales_by_user: dict[str, list[str]] = {}
    for row in sale_rows:
        sales_by_user.setdefault(row["user_id"], []).append(row["catalogue_id"])
    sires_by_user: dict[str, list[tuple[str, str]]] = {}
    for row in sire_rows:
        sires_by_user.setdefault(row["user_id"], []).append(
            (row["sire_key"], row["sire_name"])
        )
    devices_by_user: dict[str, list[dict]] = {}
    for row in devices:
        devices_by_user.setdefault(row["user_id"], []).append(row)
    sent_by_user: dict[str, set[str]] = {}
    for row in sent_rows:
        sent_by_user.setdefault(row["user_id"], set()).add(row["event_key"])

    pushed = 0
    for user_id in set(sales_by_user) | set(sires_by_user):
        events = compute_user_events(
            catalogues,
            sales_by_user.get(user_id, []),
            sires_by_user.get(user_id, []),
            sent_by_user.get(user_id, set()),
        )
        if not events.lines and not events.sent_keys:
            continue
        if args.dry_run:
            log.info("user %s: %d lines %s", user_id, len(events.lines), events.lines)
            continue

        if events.lines:
            shown = events.lines[:MAX_BODY_LINES]
            if len(events.lines) > len(shown):
                shown.append(f"…and {len(events.lines) - len(shown)} more")
            payload = {
                "title": "Live Sales update",
                "body": "\n".join(shown),
                "url": SITE_URL,
                "tag": "live-sales",
            }
            for device in devices_by_user.get(user_id, []):
                try:
                    delivered = send_webpush(device, payload, vapid_private, vapid_subject)
                except Exception as exc:
                    log.warning("push to %s failed: %r", device["endpoint"][:60], exc)
                    continue
                if delivered:
                    pushed += 1
                else:
                    db.delete_push_endpoint(device["endpoint"])

        # Record both real sends and silent baselines so we never repeat them.
        db.insert_ignore_duplicates(
            "push_sent",
            [{"user_id": user_id, "event_key": k} for k in events.sent_keys],
        )

    log.info("done: %d pushes delivered", pushed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
