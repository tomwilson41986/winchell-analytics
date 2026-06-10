"""Owner matching guard, slugify, and rollup assembly."""

from pipeline.build_profiles import build_profile, build_rollup, slugify
from pipeline.schema import FormSummary, Pedigree, PedigreeNode
from scrapers.config import is_winchell_owner


def test_owner_guard_accepts_variants():
    assert is_winchell_owner("Winchell Thoroughbreds LLC")
    assert is_winchell_owner("Ron Winchell")
    assert is_winchell_owner("Winchell Thoroughbreds & Three Chimneys")
    assert is_winchell_owner("Verne H. Winchell")
    assert is_winchell_owner("Vhw Stables")  # Verne H. Winchell's stable name


def test_owner_guard_rejects_unrelated():
    assert not is_winchell_owner("Godolphin")
    assert not is_winchell_owner("Winchell's Donuts")
    assert not is_winchell_owner("")
    assert not is_winchell_owner(None)


def test_slugify_stable():
    assert slugify("Gun Runner") == "gun-runner"
    assert slugify("Giant's Causeway") == "giants-causeway"
    assert slugify("  Red Route One  ") == "red-route-one"


def test_build_profile_derives_form_and_scores():
    p = build_profile(
        "Test Horse",
        results=[],
        form=FormSummary(starts=10, wins=5, total_earnings=1_000_000),
    )
    assert p.horse_id == "test-horse"
    assert p.scores is not None
    assert p.scores.win_strike_rate == 0.5
    assert p.last_updated is not None


def test_build_rollup_sorts_by_earnings_and_counts():
    ped = Pedigree(sire=PedigreeNode(name="CANDY RIDE"))
    a = build_profile("A", form=FormSummary(starts=5, wins=3, graded_wins=2, total_earnings=900_000), pedigree=ped)
    b = build_profile("B", form=FormSummary(starts=5, wins=1, total_earnings=2_000_000), pedigree=ped)
    c = build_profile("C", form=FormSummary(starts=2, wins=0), pedigree=ped)
    rollup = build_rollup([a, b, c])
    assert rollup.horse_count == 3
    # Sorted by earnings desc; the horse with no earnings sorts last.
    assert [h.name for h in rollup.horses] == ["B", "A", "C"]
    assert rollup.total_earnings == 2_900_000
    assert rollup.graded_winners == 1
    assert rollup.horses[0].sire == "CANDY RIDE"
