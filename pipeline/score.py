"""Pure scoring functions deriving :class:`Scores` from form + results.

No scraping, no network, no fabrication: every number here is computed from
data already gathered. When the inputs are absent the corresponding score is
``None`` so the UI shows "no data found".
"""

from __future__ import annotations

from typing import Optional

from .schema import FormSummary, RaceResult, Scores

# Graded/black-type tokens used to judge class.
_GRADED = {"G1", "G2", "G3"}
_BLACK_TYPE = _GRADED | {"Listed"}

# Numeric class weight for trajectory analysis (higher = better class).
_CLASS_WEIGHT = {"G1": 4, "G2": 3, "G3": 2, "Listed": 1}


def earnings_per_start(form: FormSummary) -> Optional[float]:
    if not form.starts or form.total_earnings is None:
        return None
    return round(form.total_earnings / form.starts, 2)


def win_strike_rate(form: FormSummary) -> Optional[float]:
    if not form.starts:
        return None
    return round(form.wins / form.starts, 4)


def place_strike_rate(form: FormSummary) -> Optional[float]:
    """Win + second + third as a share of starts (a "win or placed" rate)."""
    if not form.starts:
        return None
    placed = form.wins + form.seconds + form.thirds
    return round(placed / form.starts, 4)


def best_speed_figure(results: list[RaceResult]) -> Optional[int]:
    figs = [r.speed_figure for r in results if r.speed_figure is not None]
    return max(figs) if figs else None


def class_trajectory(results: list[RaceResult]) -> Optional[str]:
    """Compare the class of placed efforts over time.

    Looks at races where the horse finished in the first three and the race
    carried a graded/listed tag, splits them chronologically into an earlier
    and a later half, and reports whether average class is rising, flat or
    falling. ``None`` when there are too few classified efforts to judge.
    """
    classified = [
        (r.race_date, _CLASS_WEIGHT[r.grade])
        for r in results
        if r.grade in _CLASS_WEIGHT
        and r.finish_position is not None
        and r.finish_position <= 3
        and r.race_date is not None
    ]
    if len(classified) < 2:
        return None
    classified.sort(key=lambda x: x[0])
    mid = len(classified) // 2
    early = [w for _, w in classified[:mid]]
    late = [w for _, w in classified[mid:]]
    if not early or not late:
        return None
    early_avg = sum(early) / len(early)
    late_avg = sum(late) / len(late)
    delta = late_avg - early_avg
    if delta > 0.25:
        return "rising"
    if delta < -0.25:
        return "falling"
    return "flat"


def has_black_type(form: FormSummary, results: list[RaceResult]) -> bool:
    if form.black_type_wins > 0 or form.graded_wins > 0:
        return True
    return any(r.grade in _BLACK_TYPE for r in results if r.finish_position == 1)


def value_flag(
    form: FormSummary, results: list[RaceResult], scores_partial: Scores
) -> Optional[str]:
    """A short, honest commentary tag — never a fabricated metric.

    Picks the single most salient observation from the computed numbers.
    Returns ``None`` when there is nothing notable (or nothing to judge).
    """
    eps = scores_partial.earnings_per_start
    wsr = scores_partial.win_strike_rate
    traj = scores_partial.class_trajectory
    graded = form.graded_wins or sum(
        1 for r in results if r.finish_position == 1 and r.grade in _GRADED
    )

    if graded >= 2 and (eps is not None and eps >= 100_000):
        return "elite graded earner"
    if traj == "rising" and scores_partial.black_type:
        return "improving black-type performer"
    if wsr is not None and wsr >= 0.5 and form.starts >= 4:
        return "high strike rate"
    if eps is not None and eps >= 50_000:
        return "strong earnings per start"
    if traj == "falling":
        return "class tapering"
    if scores_partial.black_type:
        return "black-type winner"
    return None


def score(form: Optional[FormSummary], results: list[RaceResult]) -> Scores:
    """Compute the full :class:`Scores` block from form + results."""
    form = form or FormSummary()
    s = Scores(
        earnings_per_start=earnings_per_start(form),
        win_strike_rate=win_strike_rate(form),
        place_strike_rate=place_strike_rate(form),
        best_speed_figure=best_speed_figure(results),
        class_trajectory=class_trajectory(results),
        black_type=has_black_type(form, results),
    )
    s.value_flag = value_flag(form, results, s)
    return s


def summarise_form(results: list[RaceResult]) -> FormSummary:
    """Aggregate a :class:`FormSummary` from a list of results.

    Used when a source gives per-race rows but no pre-computed career summary.
    """
    form = FormSummary()
    form.starts = len(results)
    earnings_total = 0
    have_earnings = False
    dated = []
    for r in results:
        if r.finish_position == 1:
            form.wins += 1
            if r.grade in _GRADED:
                form.graded_wins += 1
            if r.grade in _BLACK_TYPE:
                form.black_type_wins += 1
        elif r.finish_position == 2:
            form.seconds += 1
        elif r.finish_position == 3:
            form.thirds += 1
        if r.earnings is not None:
            earnings_total += r.earnings
            have_earnings = True
        if r.race_date is not None:
            dated.append(r)
    if have_earnings:
        form.total_earnings = earnings_total
        form.currency = "USD"
    if dated:
        dated.sort(key=lambda r: r.race_date)
        form.last_run = dated[-1].race_date
        # Form string: most recent last, capped to last 6 runs.
        recent = dated[-6:]
        form.form_string = "-".join(
            str(r.finish_position) if r.finish_position is not None else "?"
            for r in recent
        )
    return form
