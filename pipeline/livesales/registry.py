"""Ordered list of source adapters. The orchestrator iterates this list and
isolates failures per source: one broken site must never sink the whole run.
Order matters for cross-source dedup (first source wins a catalogue_id)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional

from .sources import (
    arqana,
    bbag,
    fasigtipton,
    gavelhouse,
    goffs,
    inglis,
    keeneland,
    magicmillions,
    nzb,
    obs,
    tattersalls,
    tattersalls_online,
)


@dataclass(frozen=True)
class Source:
    key: str
    fetch: Callable  # (session, ref) -> list[RawSale]
    fetch_lots: Optional[Callable]  # (raw, session) -> list[Lot], or None


def _source(module) -> Source:
    return Source(module.KEY, module.fetch, getattr(module, "fetch_lots", None))


SOURCES: list[Source] = [
    _source(module)
    for module in (
        tattersalls,
        tattersalls_online,
        goffs,
        arqana,
        bbag,
        keeneland,
        fasigtipton,
        obs,
        inglis,
        magicmillions,
        nzb,
        gavelhouse,
    )
]
