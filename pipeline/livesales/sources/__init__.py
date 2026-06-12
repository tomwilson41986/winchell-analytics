"""Source adapters, one module per auction house.

Each module exposes:

    KEY: str                                   # registry key
    fetch(session, ref) -> list[RawSale]       # scrape the sale calendar
    fetch_lots(raw, session) -> list[Lot]      # optional: published lots

``fetch_*`` does the network work; the corresponding ``parse_*`` functions are
pure (HTML/JSON in, dataclasses out) and unit-tested offline against fixtures.
"""
