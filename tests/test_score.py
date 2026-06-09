"""Scoring is pure maths on form + results; assert it never invents values."""

from datetime import date

from pipeline.schema import FormSummary, RaceResult
from pipeline.score import (
    class_trajectory,
    earnings_per_start,
    place_strike_rate,
    score,
    summarise_form,
    value_flag,
    win_strike_rate,
)


def _r(d, grade=None, pos=None, earn=None, spd=None):
    return RaceResult(
        race_date=d, grade=grade, finish_position=pos, earnings=earn, speed_figure=spd
    )


def test_rates_none_without_starts():
    f = FormSummary()
    assert earnings_per_start(f) is None
    assert win_strike_rate(f) is None
    assert place_strike_rate(f) is None


def test_rates_computed():
    f = FormSummary(starts=20, wins=10, seconds=4, thirds=2, total_earnings=2_000_000)
    assert earnings_per_start(f) == 100_000
    assert win_strike_rate(f) == 0.5
    assert place_strike_rate(f) == 0.8  # (10+4+2)/20


def test_class_trajectory_needs_two_classified_runs():
    assert class_trajectory([_r(date(2020, 1, 1), "G1", 1)]) is None


def test_class_trajectory_rising():
    results = [
        _r(date(2020, 1, 1), "G3", 1),
        _r(date(2020, 2, 1), "G3", 2),
        _r(date(2021, 1, 1), "G1", 1),
        _r(date(2021, 2, 1), "G1", 1),
    ]
    assert class_trajectory(results) == "rising"


def test_summarise_form_counts_and_form_string():
    results = [
        _r(date(2020, 1, 1), "G1", 1, 500_000),
        _r(date(2020, 2, 1), "G2", 2, 100_000),
        _r(date(2020, 3, 1), None, 3, 20_000),
    ]
    f = summarise_form(results)
    assert (f.starts, f.wins, f.seconds, f.thirds) == (3, 1, 1, 1)
    assert f.graded_wins == 1 and f.black_type_wins == 1
    assert f.total_earnings == 620_000
    assert f.last_run == date(2020, 3, 1)
    assert f.form_string == "1-2-3"


def test_value_flag_is_none_when_nothing_notable():
    f = FormSummary(starts=2, wins=0)
    s = score(f, [])
    assert s.value_flag is None
    assert s.black_type is False


def test_score_black_type_from_form():
    f = FormSummary(starts=10, wins=5, black_type_wins=3, total_earnings=1_000_000)
    s = score(f, [])
    assert s.black_type is True


def test_value_flag_elite_graded_earner():
    f = FormSummary(starts=10, wins=6, graded_wins=4, total_earnings=5_000_000)
    s = score(f, [])
    assert s.value_flag == "elite graded earner"


def test_no_fabrication_when_empty():
    s = score(None, [])
    assert s.earnings_per_start is None
    assert s.best_speed_figure is None
    assert s.class_trajectory is None
    assert s.value_flag is None
