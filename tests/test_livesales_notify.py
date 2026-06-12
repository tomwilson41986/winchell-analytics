"""Push-notification event computation: silent baselines on first sight, then
diffs only — plus the name normalisation that must mirror the frontend."""

from pipeline.livesales.notify import compute_user_events, normalize_horse_name


def cat(cid="tatts|july-sale|2026-07", name="July Sale", lots=(), active=False):
    return {
        "id": cid,
        "name": name,
        "is_active": active,
        "lots": [
            {"lot_no": str(i + 1), "sire": sire, "dam_sire": dam_sire}
            for i, (sire, dam_sire) in enumerate(lots)
        ],
    }


def test_normalize_mirrors_frontend():
    assert normalize_horse_name("Gun Runner (USA)") == "gun runner"
    assert normalize_horse_name("  GUN-RUNNER ") == "gun runner"
    assert normalize_horse_name("") == ""


def test_sale_subscription_baselines_silently_then_notifies():
    feed = [cat(lots=[("A", ""), ("B", "")], active=False)]
    sub = ["tatts|july-sale|2026-07"]

    # First run: nothing pushed, current state recorded.
    first = compute_user_events(feed, sub, [], set())
    assert first.lines == []
    assert "baseline|sale|tatts|july-sale|2026-07" in first.sent_keys
    assert "sale-lots|tatts|july-sale|2026-07|2" in first.sent_keys

    sent = set(first.sent_keys)

    # No change: quiet.
    second = compute_user_events(feed, sub, [], sent)
    assert second.lines == [] and second.sent_keys == []

    # Catalogue grows and the sale goes active: one line each.
    grown = [cat(lots=[("A", ""), ("B", ""), ("C", "")], active=True)]
    third = compute_user_events(grown, sub, [], sent)
    assert any("now 3 lots" in line for line in third.lines)
    assert any("now active" in line for line in third.lines)


def test_catalogue_publishing_after_subscribe_notifies():
    empty = [cat(lots=[])]
    sub = ["tatts|july-sale|2026-07"]
    sent = set(compute_user_events(empty, sub, [], set()).sent_keys)

    published = [cat(lots=[("A", ""), ("B", "")])]
    events = compute_user_events(published, sub, [], sent)
    assert events.lines == ["July Sale: catalogue published — 2 lots"]


def test_sire_subscription_diffs_individual_lots():
    sire_sub = [("gun runner", "Gun Runner")]
    feed = [cat(lots=[("Gun Runner (USA)", ""), ("Other Sire", "")])]

    first = compute_user_events(feed, [], sire_sub, set())
    assert first.lines == []  # baseline
    sent = set(first.sent_keys)

    # One new lot by the sire, one as damsire: both count, existing one doesn't.
    grown = [
        cat(
            lots=[
                ("Gun Runner (USA)", ""),
                ("Other Sire", ""),
                ("Gun Runner (USA)", ""),
                ("X", "Gun Runner"),
            ]
        )
    ]
    events = compute_user_events(grown, [], sire_sub, sent)
    assert events.lines == ["2 new entries by Gun Runner (July Sale)"]
    assert len([k for k in events.sent_keys if k.startswith("sire|")]) == 2


def test_unknown_catalogue_id_is_ignored():
    events = compute_user_events([cat()], ["nonexistent|id|x"], [], set())
    assert events.lines == [] and events.sent_keys == []
