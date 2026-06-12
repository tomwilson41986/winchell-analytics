"""Pure classification rules: exclusion filter, sale-type buckets, the
active/in-scope windows and status labels (livesales spec §5-6)."""

from datetime import date

from pipeline.livesales import classify
from pipeline.livesales.models import RawSale

TODAY = date(2026, 6, 12)


def sale(name, start=None, end=None, **kwargs) -> RawSale:
    return RawSale(
        house=kwargs.pop("house", "Tattersalls"),
        country=kwargs.pop("country", "UK"),
        name=name,
        start_date=start,
        end_date=end,
        url="https://example.test/sale",
        **kwargs,
    )


# --- exclusion --------------------------------------------------------------- //


def test_excludes_jumps_and_stores():
    assert classify.is_excluded(sale("National Hunt Sale"))
    assert classify.is_excluded(sale("May Store Sale"))
    assert classify.is_excluded(sale("Spring NH Sale"))
    assert classify.is_excluded(sale("Point-to-Point Sale"))
    assert classify.is_excluded(sale("Harness Yearling Sale"))


def test_excludes_named_nh_sales_without_keywords():
    assert classify.is_excluded(sale("The Derby Sale"))
    assert classify.is_excluded(sale("Arkle Showcase"))


def test_exclusion_reads_description_and_type_hint():
    assert classify.is_excluded(sale("June Sale", description="AQPS and jumps stock"))
    assert classify.is_excluded(sale("June Sale", type_hint="Store"))


def test_flat_sales_not_excluded():
    assert not classify.is_excluded(sale("October Yearling Sale Book 1"))
    assert not classify.is_excluded(sale("Breeze Up Sale"))


# --- sale type --------------------------------------------------------------- //


def test_sale_type_buckets():
    assert classify.sale_type(sale("Craven Breeze Up Sale")) == "Breeze Up"
    assert classify.sale_type(sale("July Horses in Training Sale")) == "HIT"
    assert classify.sale_type(sale("November Foal Sale")) == "Foal / Weanling"
    assert classify.sale_type(sale("December Breeding Stock Sale")) == "Broodmare"
    assert classify.sale_type(sale("October Yearling Sale")) == "Yearling"
    assert classify.sale_type(sale("Summer Sale")) == "Mixed"


def test_most_specific_rule_wins():
    # "Breeze Up" beats the later buckets even when other words match too.
    assert classify.sale_type(sale("Breeze Up & Horses in Training")) == "Breeze Up"
    # A weanling+mare sale buckets as Foal / Weanling (more specific first).
    assert classify.sale_type(sale("Weanling and Mares Sale")) == "Foal / Weanling"


def test_name_outranks_noisy_description():
    s = sale("Perth Winter Yearling Sale",
             description="Winter Weanling Sale · Winter Yearling Sale")
    assert classify.sale_type(s) == "Yearling"


def test_description_breaks_ties_when_name_says_nothing():
    s = sale("June Special", description="two-year-olds breeze up")
    assert classify.sale_type(s) == "Breeze Up"


def test_type_hint_trusted_only_for_known_buckets():
    assert classify.sale_type(sale("Special Sale", type_hint="Yearling")) == "Yearling"
    assert classify.sale_type(sale("October Yearling Sale", type_hint="Flagship")) == "Yearling"


# --- active / in-scope ------------------------------------------------------- //


def test_active_window_includes_lead_days():
    s = sale("X", start=date(2026, 6, 14), end=date(2026, 6, 16))
    assert classify.is_active(s, TODAY)  # 2 days out
    assert classify.is_active(s, date(2026, 6, 16))  # last day
    assert not classify.is_active(s, date(2026, 6, 11))  # 3 days out
    assert not classify.is_active(s, date(2026, 6, 17))  # finished


def test_undated_sale_active_only_when_source_says_live():
    assert classify.is_active(sale("Rolling Auction", status_hint="live"), TODAY)
    assert classify.is_active(sale("Rolling Auction", status_hint="bidding-open"), TODAY)
    assert not classify.is_active(sale("Rolling Auction"), TODAY)


def test_in_scope_window():
    assert classify.in_scope(sale("X", start=date(2026, 6, 20)), TODAY)
    # Started but not finished: still in scope.
    assert classify.in_scope(
        sale("X", start=date(2026, 6, 10), end=date(2026, 6, 13)), TODAY
    )
    # Finished yesterday: out.
    assert not classify.in_scope(sale("X", start=date(2026, 6, 11)), TODAY)
    # Beyond the 30-day horizon: out.
    assert not classify.in_scope(sale("X", start=date(2026, 7, 20)), TODAY)
    # Undated sales are kept.
    assert classify.in_scope(sale("Rolling Auction"), TODAY)
    # Excluded sales are out regardless of dates.
    assert not classify.in_scope(sale("Store Sale", start=date(2026, 6, 20)), TODAY)


# --- status label ------------------------------------------------------------ //


def test_status_labels():
    s = sale("X")
    assert classify.status_label(s, active=True, new=True) == "Active · New"
    assert classify.status_label(s, active=True, new=False) == "Active"
    assert classify.status_label(s, active=False, new=True) == "New"
    assert (
        classify.status_label(sale("X", status_hint="catalogue-available"), False, False)
        == "Catalogue Available"
    )
    assert classify.status_label(s, active=False, new=False) == "Upcoming"
