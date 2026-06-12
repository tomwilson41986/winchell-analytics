"""Stable catalogue identity, cross-source dedup, the seen-ledger ("New"
detection) and the country-grouped sort order."""

from datetime import date

from pipeline.livesales.models import Catalogue, RawSale, slug
from pipeline.livesales.run import sort_catalogues
from pipeline.livesales.store import SeenLedger


def sale(house="Tattersalls", name="October Yearling Sale Book 1",
         start=date(2026, 10, 6), country="UK") -> RawSale:
    return RawSale(
        house=house, country=country, name=name,
        start_date=start, end_date=None, url="https://example.test",
    )


def test_slug_normalises_accents_and_punctuation():
    assert slug("Vente d'Été — Deauville") == "vente-d-ete-deauville"
    assert slug("  October  Yearling ") == "october-yearling"


def test_catalogue_id_keys_on_start_month():
    a = sale(start=date(2026, 10, 6))
    b = sale(start=date(2026, 10, 7))  # source nudged the date a day
    c = sale(start=date(2026, 11, 6))  # different month: a different sale
    assert a.catalogue_id == b.catalogue_id
    assert a.catalogue_id != c.catalogue_id
    assert a.catalogue_id == "tattersalls|october-yearling-sale-book-1|2026-10"


def test_books_stay_distinct_and_undated_uses_nd():
    book2 = sale(name="October Yearling Sale Book 2")
    assert sale().catalogue_id != book2.catalogue_id
    assert sale(start=None).catalogue_id.endswith("|nd")


def test_seen_ledger_new_detection(tmp_path):
    ledger = SeenLedger(tmp_path / "state.sqlite")
    s = sale()
    day1, day2 = date(2026, 6, 11), date(2026, 6, 12)

    is_new, first_seen = ledger.upsert(s, day1)
    assert is_new and first_seen == day1

    # Re-run on the same day: still New (reruns agree).
    is_new, first_seen = ledger.upsert(s, day1)
    assert is_new and first_seen == day1

    # Next day: no longer New, first_seen preserved.
    is_new, first_seen = ledger.upsert(s, day2)
    assert not is_new and first_seen == day1
    ledger.close()


def cat(raw, active=False, new=False) -> Catalogue:
    return Catalogue(raw=raw, sale_type="Mixed", is_new=new, is_active=active,
                     status_label="", first_seen=None)


def test_sort_country_order_then_active_new_date_name():
    us = cat(sale(house="Keeneland", country="US", name="September Sale"))
    uk_active = cat(sale(name="July Sale", start=date(2026, 7, 1)), active=True)
    uk_new = cat(sale(name="August Sale", start=date(2026, 8, 1)), new=True)
    uk_later = cat(sale(name="Z Sale", start=date(2026, 9, 1)))
    uk_undated = cat(sale(name="Rolling Sale", start=None))
    other = cat(sale(house="X", country="ZA", name="Cape Sale"))

    result = sort_catalogues([other, us, uk_later, uk_undated, uk_new, uk_active])
    names = [c.raw.name for c in result]
    # UK first (active, then new, then dated, undated last), US after, unknown
    # country codes last — never dropped.
    assert names == ["July Sale", "August Sale", "Z Sale", "Rolling Sale",
                     "September Sale", "Cape Sale"]
