"""Assemble horse profiles and the portfolio rollup from gathered data.

This module is the join point: it takes the canonical pieces a scraping run
produced for a horse (pedigree, sales, results, an optional pre-built form
summary) and writes:

* ``data/profiles/<horse_id>.json`` — one :class:`HorseProfile` per horse.
* ``data/horses.json``             — lightweight index cards, sorted by earnings.
* ``data/portfolio.json``          — the :class:`PortfolioRollup`.

Scoring is applied here (via :mod:`pipeline.score`); nothing is fetched.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional

from .schema import (
    FormSummary,
    HorseProfile,
    Pedigree,
    PortfolioCard,
    PortfolioRollup,
    RaceResult,
    SaleRecord,
    utc_now_iso,
)
from .score import score, summarise_form

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PROFILES_DIR = DATA_DIR / "profiles"

_GRADED = {"G1", "G2", "G3"}


def slugify(name: str) -> str:
    """Stable, URL-safe id for a horse name (e.g. "Gun Runner" -> "gun-runner")."""
    s = name.strip().lower()
    s = re.sub(r"['’]", "", s)  # drop apostrophes rather than hyphenate them
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def build_profile(
    name: str,
    *,
    year_of_birth: Optional[int] = None,
    sex: Optional[str] = None,
    colour: Optional[str] = None,
    country: Optional[str] = None,
    breeder: Optional[str] = None,
    current_trainer: Optional[str] = None,
    ownership_note: Optional[str] = None,
    status: Optional[str] = None,
    pedigree: Optional[Pedigree] = None,
    sales: Optional[list[SaleRecord]] = None,
    results: Optional[list[RaceResult]] = None,
    form: Optional[FormSummary] = None,
    sources: Optional[list[str]] = None,
) -> HorseProfile:
    """Build a fully-scored :class:`HorseProfile` from gathered parts."""
    results = results or []
    sales = sales or []
    # Derive the form summary from results when a source did not supply one.
    if form is None and results:
        form = summarise_form(results)
    scores = score(form, results)
    return HorseProfile(
        horse_id=slugify(name),
        name=name,
        year_of_birth=year_of_birth,
        sex=sex,
        colour=colour,
        country=country,
        breeder=breeder,
        current_trainer=current_trainer,
        ownership_note=ownership_note,
        status=status,
        pedigree=pedigree,
        sales=sales,
        form=form,
        results=results,
        scores=scores,
        sources=sources or [],
        last_updated=utc_now_iso(),
    )


def write_profile(profile: HorseProfile, profiles_dir: Path = PROFILES_DIR) -> Path:
    """Write a single profile to ``profiles/<horse_id>.json``."""
    profiles_dir.mkdir(parents=True, exist_ok=True)
    path = profiles_dir / f"{profile.horse_id}.json"
    path.write_text(
        profile.model_dump_json(indent=2, exclude_none=False),
        encoding="utf-8",
    )
    return path


def _card(profile: HorseProfile) -> PortfolioCard:
    form = profile.form or FormSummary()
    ped = profile.pedigree
    return PortfolioCard(
        horse_id=profile.horse_id,
        name=profile.name,
        sire=ped.sire.name if ped and ped.sire else None,
        dam=ped.dam.name if ped and ped.dam else None,
        damsire=ped.damsire.name if ped and ped.damsire else None,
        trainer=profile.current_trainer,
        status=profile.status,
        starts=form.starts,
        wins=form.wins,
        total_earnings=form.total_earnings,
        currency=form.currency,
        black_type=profile.scores.black_type if profile.scores else False,
        value_flag=profile.scores.value_flag if profile.scores else None,
    )


def build_rollup(profiles: list[HorseProfile]) -> PortfolioRollup:
    """Compute the portfolio-wide rollup from a set of profiles."""
    cards = [_card(p) for p in profiles]
    # Sort index cards by earnings, biggest first; unknowns sort last.
    cards.sort(key=lambda c: (c.total_earnings is None, -(c.total_earnings or 0)))

    earnings_vals = [c.total_earnings for c in cards if c.total_earnings is not None]
    total_earnings = sum(earnings_vals) if earnings_vals else None

    def is_active(p: HorseProfile) -> bool:
        return bool(p.status and re.search(r"activ|train|race", p.status, re.I))

    graded_winners = sum(
        1
        for p in profiles
        if (p.form and p.form.graded_wins > 0)
        or any(r.finish_position == 1 and r.grade in _GRADED for r in p.results)
    )
    black_type_winners = sum(
        1 for p in profiles if p.scores and p.scores.black_type
    )

    return PortfolioRollup(
        generated_at=utc_now_iso(),
        horse_count=len(profiles),
        active_count=sum(1 for p in profiles if is_active(p)),
        total_earnings=total_earnings,
        currency="USD" if total_earnings is not None else None,
        graded_winners=graded_winners,
        black_type_winners=black_type_winners,
        horses=cards,
    )


def write_index_and_rollup(
    profiles: list[HorseProfile], data_dir: Path = DATA_DIR
) -> tuple[Path, Path]:
    """Write ``horses.json`` (index cards) and ``portfolio.json`` (rollup)."""
    rollup = build_rollup(profiles)
    data_dir.mkdir(parents=True, exist_ok=True)

    horses_path = data_dir / "horses.json"
    horses_path.write_text(
        json.dumps([c.model_dump() for c in rollup.horses], indent=2),
        encoding="utf-8",
    )

    portfolio_path = data_dir / "portfolio.json"
    portfolio_path.write_text(rollup.model_dump_json(indent=2), encoding="utf-8")
    return horses_path, portfolio_path
