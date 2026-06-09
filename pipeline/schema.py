"""Canonical data models for Winchell Analytics.

Every scraper, regardless of source, must return these shapes so the frontend
reads one stable contract. Models are deliberately permissive about missing
data: any field a source does not provide stays ``None``/empty and the UI
renders "no data found". Nothing here invents values.

British English in docstrings; currency codes follow ISO 4217 (USD for US
sales and earnings).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

# --------------------------------------------------------------------------- #
# Pedigree
# --------------------------------------------------------------------------- #


class PedigreeNode(BaseModel):
    """A single ancestor in a pedigree."""

    name: Optional[str] = None
    year_of_birth: Optional[int] = None
    country: Optional[str] = None


class Pedigree(BaseModel):
    """Sire/dam line plus a flattened three-generation table and inbreeding."""

    sire: Optional[PedigreeNode] = None
    dam: Optional[PedigreeNode] = None
    damsire: Optional[PedigreeNode] = None
    # Flattened ancestors keyed by position (e.g. "sire", "dam", "sire_sire",
    # "dam_dam", ...). Three generations where the source resolves them.
    extended: dict[str, PedigreeNode] = Field(default_factory=dict)
    # Names of ancestors appearing on both sides, with their duplication note
    # (e.g. "Mr. Prospector 4x4"). Empty when none/unknown.
    inbreeding: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Sales
# --------------------------------------------------------------------------- #


class SaleRecord(BaseModel):
    """One auction appearance for a horse."""

    sale_house: Optional[str] = None  # e.g. "Keeneland", "Fasig-Tipton"
    sale_name: Optional[str] = None  # e.g. "September Yearling Sale"
    sale_date: Optional[date] = None
    lot: Optional[str] = None  # hip/lot number, kept as string (can be "123A")
    price: Optional[int] = None  # hammer price; None when RNA / not sold
    currency: Optional[str] = None  # ISO 4217, e.g. "USD"
    buyer: Optional[str] = None
    consignor: Optional[str] = None
    rfna: bool = False  # Reserve Not Attained (a.k.a. RNA) — true when bought back


# --------------------------------------------------------------------------- #
# Form & results
# --------------------------------------------------------------------------- #


class RaceResult(BaseModel):
    """A single completed start."""

    race_date: Optional[date] = None
    track: Optional[str] = None
    race_name: Optional[str] = None
    surface: Optional[str] = None  # "Dirt" / "Turf" / "Synthetic"
    distance_furlongs: Optional[float] = None
    going: Optional[str] = None  # track condition, e.g. "Fast", "Good", "Yielding"
    grade: Optional[str] = None  # "G1"/"G2"/"G3"/"Listed"/None
    finish_position: Optional[int] = None
    field_size: Optional[int] = None
    margin: Optional[str] = None  # winning/beaten margin as written by source
    jockey: Optional[str] = None
    trainer: Optional[str] = None
    earnings: Optional[int] = None  # purse earned by the horse for this start
    currency: Optional[str] = None
    speed_figure: Optional[int] = None
    comment: Optional[str] = None  # trip/running-line note where given


class FormSummary(BaseModel):
    """Aggregated career record derived from results."""

    starts: int = 0
    wins: int = 0
    seconds: int = 0
    thirds: int = 0
    total_earnings: Optional[int] = None
    currency: Optional[str] = None
    black_type_wins: int = 0  # wins in black-type (graded or listed) races
    graded_wins: int = 0
    last_run: Optional[date] = None
    form_string: Optional[str] = None  # most-recent-last finish string, e.g. "1-1-3-2"


# --------------------------------------------------------------------------- #
# Derived scores
# --------------------------------------------------------------------------- #


class Scores(BaseModel):
    """Analytics derived purely from form + results. No scraping, no fabrication."""

    earnings_per_start: Optional[float] = None
    win_strike_rate: Optional[float] = None  # 0..1
    place_strike_rate: Optional[float] = None  # win+2nd+3rd, 0..1
    best_speed_figure: Optional[int] = None
    class_trajectory: Optional[Literal["rising", "flat", "falling"]] = None
    black_type: bool = False
    value_flag: Optional[str] = None  # short commentary tag, e.g. "elite earner"


# --------------------------------------------------------------------------- #
# Profile & portfolio
# --------------------------------------------------------------------------- #


class HorseProfile(BaseModel):
    """The full, frontend-ready record for one horse."""

    horse_id: str  # slug, stable across runs
    name: str
    year_of_birth: Optional[int] = None
    sex: Optional[str] = None  # "Colt"/"Filly"/"Horse"/"Mare"/"Gelding"
    colour: Optional[str] = None
    country: Optional[str] = None
    breeder: Optional[str] = None
    current_trainer: Optional[str] = None
    ownership_note: Optional[str] = None  # how the Winchell ownership was matched
    status: Optional[str] = None  # "Active"/"Retired"/"At stud"/"Broodmare"/...

    pedigree: Optional[Pedigree] = None
    sales: list[SaleRecord] = Field(default_factory=list)
    form: Optional[FormSummary] = None
    results: list[RaceResult] = Field(default_factory=list)
    scores: Optional[Scores] = None

    sources: list[str] = Field(default_factory=list)  # URLs actually used
    last_updated: Optional[str] = None  # ISO 8601 timestamp


class PortfolioCard(BaseModel):
    """Lightweight horse summary for the portfolio overview table."""

    horse_id: str
    name: str
    sire: Optional[str] = None
    dam: Optional[str] = None
    trainer: Optional[str] = None
    status: Optional[str] = None
    starts: int = 0
    wins: int = 0
    total_earnings: Optional[int] = None
    currency: Optional[str] = None
    black_type: bool = False
    value_flag: Optional[str] = None


class PortfolioRollup(BaseModel):
    """Portfolio-wide rollup written to portfolio.json."""

    generated_at: str  # ISO 8601
    horse_count: int = 0
    active_count: int = 0
    total_earnings: Optional[int] = None
    currency: Optional[str] = None
    graded_winners: int = 0
    black_type_winners: int = 0
    horses: list[PortfolioCard] = Field(default_factory=list)


def utc_now_iso() -> str:
    """Current UTC time as an ISO 8601 string (timezone-aware)."""
    return datetime.now().astimezone().isoformat()
