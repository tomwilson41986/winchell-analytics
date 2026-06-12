"""Live sales aggregator: upcoming global thoroughbred auction sales.

Scrapes the sale calendars (and, where published, lot-level catalogues) of
12 auction houses, classifies and dedups them, tracks first-sighting in a
seen-ledger and publishes a JSON feed consumed by the site's Live Sales page.

Layout (see docs/livesales spec):

    models.py    dataclasses + stable catalogue ids
    base.py      HTTP session, retried GETs, tolerant date parsing
    classify.py  pure functions: exclusion, sale type, active/status
    store.py     SQLite seen-ledger ("New" detection) + run log
    sources/     one adapter per auction house (fetch_* network, parse_* pure)
    registry.py  ordered adapter list; per-source failure isolation
    run.py       orchestrator CLI (python -m pipeline.livesales.run)
"""
