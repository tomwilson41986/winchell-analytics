"""Configuration for the Winchell roster: owner identity and source registry.

Two jobs:

1. Decide whether a given owner string on a results/sales row belongs to the
   Winchell operation (the loose-match guard). This must be tolerant of the
   many ways the name is written, but tight enough not to sweep in unrelated
   "Winchell" entities.
2. Declare the sources we may fetch, each with an ``enabled`` flag, base URL,
   polite rate limit (seconds between requests) and a one-line purpose.

Nothing here fetches anything; it is pure configuration + matching helpers.
"""

from __future__ import annotations

import re

# --------------------------------------------------------------------------- #
# Owner identity
# --------------------------------------------------------------------------- #

# Canonical / known spellings of the operation as printed in race programmes
# and sales catalogues. Used for display and exact-ish matching.
OWNER_ALIASES: list[str] = [
    "Winchell Thoroughbreds",
    "Winchell Thoroughbreds LLC",
    "Winchell Thoroughbreds, LLC",
    "Winchell Thoroughbred",
    "Ron Winchell",
    "Ronald Winchell",
    "Ronald K. Winchell",
    "Verne H. Winchell",  # founder; older runners carried the silks
    "Verne Winchell",
    "VHW Stables",  # Verne H. Winchell's stable name on older charts
]

# Stable names that are the Winchell operation but do not contain the surname
# (so the token guard alone would miss them). Confirmed from Equibase charts.
OWNER_NAME_EQUIVALENTS: list[str] = [
    "vhw stables",
    "vhw stable",
]

# Loose-match guard. A row's owner string is considered a Winchell horse when
# it contains every token in (any) one required group AND none of the
# exclusions. Tokens are matched case-insensitively on word boundaries.
#
# We require the surname "winchell"; the optional groups let us accept either
# the stable name or a personal name without over-matching.
OWNER_MATCH_TOKENS: list[str] = ["winchell"]

# Strings that, when present alongside "winchell", indicate a *different*
# entity we must not fold into the portfolio. Conservative by design — extend
# only with confirmed false positives.
OWNER_EXCLUSIONS: list[str] = [
    "winchell drugs",  # unrelated corporate name guard
    "winchell's",  # the doughnut chain, in case of stray text
]


def _has_token(haystack: str, token: str) -> bool:
    """Whole-word, case-insensitive containment test."""
    return re.search(rf"(?<!\w){re.escape(token)}(?!\w)", haystack) is not None


def is_winchell_owner(owner: str | None) -> bool:
    """Return True when an owner string belongs to the Winchell operation.

    The match is intentionally loose (handles "Winchell Thoroughbreds LLC",
    "Winchell Thoroughbreds & Three Chimneys", "Ron Winchell", etc.) but
    rejects anything on the exclusion list. Empty/None never matches.
    """
    if not owner:
        return False
    text = owner.strip().lower()
    if not text:
        return False
    if any(excl in text for excl in OWNER_EXCLUSIONS):
        return False
    if any(eq in text for eq in OWNER_NAME_EQUIVALENTS):
        return True
    return all(_has_token(text, tok) for tok in OWNER_MATCH_TOKENS)


# --------------------------------------------------------------------------- #
# Source registry
# --------------------------------------------------------------------------- #

# Per-source configuration. ``rate_limit_seconds`` matches or exceeds each
# site's published Crawl-delay. Enable only sources whose terms you have
# cleared for this private analysis.
SOURCES: dict[str, dict] = {
    "equibase": {
        "enabled": True,
        "base_url": "https://www.equibase.com",
        "rate_limit_seconds": 6.0,  # robots Crawl-delay is 5; we go slightly slower
        "purpose": "Primary US source: race results, earnings, owner field, roster.",
    },
    "pedigreequery": {
        "enabled": True,
        "base_url": "https://www.pedigreequery.com",
        "rate_limit_seconds": 2.0,  # robots Crawl-delay is 1
        "purpose": "Pedigree: sire/dam/damsire, 3-generation table, inbreeding.",
    },
    "keeneland": {
        "enabled": True,
        "base_url": "https://www.keeneland.com",
        "rate_limit_seconds": 3.0,
        "purpose": "Sales: Keeneland auction results by horse name / hip.",
    },
    "fasigtipton": {
        "enabled": True,
        "base_url": "https://www.fasigtipton.com",
        "rate_limit_seconds": 3.0,
        "purpose": "Sales: Fasig-Tipton auction results by horse name / hip.",
    },
    "wikipedia": {
        "enabled": True,
        "base_url": "https://en.wikipedia.org",
        "rate_limit_seconds": 1.0,
        "purpose": (
            "Open, citable enrichment: career record, earnings, owner "
            "(ownership confirmation), trainer, breeder, bio, Equibase refno."
        ),
    },
    "horseracingnation": {
        "enabled": True,
        "base_url": "https://www.horseracingnation.com",
        "rate_limit_seconds": 3.0,
        "purpose": (
            "Industry source: full race-by-race results with grades and HRN "
            "speed figures, plus status, owner, trainer and pedigree summary. "
            "robots.txt allows /horse/ pages for the generic agent."
        ),
    },
}


def enabled_sources() -> dict[str, dict]:
    """Sources currently switched on."""
    return {name: cfg for name, cfg in SOURCES.items() if cfg.get("enabled")}


# Identifies the project and a contact address on every request, per the brief.
USER_AGENT = (
    "WinchellAnalytics/1.0 (private portfolio analysis; "
    "+mailto:racingsquared@gmail.com)"
)
