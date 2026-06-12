"""Canonical data model for the live-sales aggregator.

`RawSale` is what a source adapter returns for one calendar entry; `Lot` is one
horse in a published catalogue; `Catalogue` is a `RawSale` enriched with the
classification and seen-ledger flags the site displays.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date

# Display order for the grouped listing. Unknown codes sort last ("Other").
COUNTRY_ORDER = ["UK", "IRE", "FR", "DE", "US", "AUS", "NZ"]

COUNTRY_FLAGS = {
    "UK": "\U0001f1ec\U0001f1e7",
    "IRE": "\U0001f1ee\U0001f1ea",
    "FR": "\U0001f1eb\U0001f1f7",
    "DE": "\U0001f1e9\U0001f1ea",
    "US": "\U0001f1fa\U0001f1f8",
    "AUS": "\U0001f1e6\U0001f1fa",
    "NZ": "\U0001f1f3\U0001f1ff",
}

HOUSE_WEBSITE = {
    "Tattersalls": "https://www.tattersalls.com",
    "Tattersalls Ireland": "https://www.tattersalls.ie",
    "Tattersalls Online": "https://www.tattersallsonline.com",
    "Goffs": "https://www.goffs.com",
    "Goffs UK": "https://www.goffsuk.com",
    "Arqana": "https://www.arqana.com",
    "BBAG": "https://www.bbag-sales.de",
    "Keeneland": "https://www.keeneland.com",
    "Fasig-Tipton": "https://www.fasigtipton.com",
    "OBS": "https://obssales.com",
    "Inglis": "https://inglis.com.au",
    "Magic Millions": "https://www.magicmillions.com.au",
    "NZB": "https://www.nzb.co.nz",
    "Gavelhouse": "https://gavelhouse.co.nz",
}


def slug(text: str) -> str:
    """NFKD-normalised ASCII, lower-case, non-alnum runs collapsed to '-'."""
    norm = unicodedata.normalize("NFKD", text or "")
    ascii_text = norm.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")


@dataclass
class RawSale:
    """One calendar entry from one auction house."""

    house: str
    country: str
    name: str
    start_date: date | None
    end_date: date | None  # None for single-day sales
    url: str
    online: bool = False
    description: str = ""
    status_hint: str = ""  # source-side status, e.g. "catalogue-available"
    type_hint: str = ""  # source-side category, if the site has one
    source_key: str = ""  # which adapter produced it
    catalogue_ref: str = ""  # source-internal id used by fetch_lots

    @property
    def catalogue_id(self) -> str:
        """Stable identity for dedup and new-detection.

        Keyed on the start *month* rather than the exact day so the same sale
        tracks across runs even when a source nudges the date, while e.g.
        October Book 1 vs Book 2 stay distinct.
        """
        month = self.start_date.strftime("%Y-%m") if self.start_date else "nd"
        return f"{slug(self.house)}|{slug(self.name)}|{month}"


@dataclass
class Lot:
    """One horse in a published catalogue."""

    lot_no: str
    horse_name: str = ""  # "" when unnamed (foals/yearlings often are)
    sex: str = ""  # Colt/Filly/Gelding/Horse/Mare
    colour: str = ""  # Bay, Chestnut, Grey...
    sire: str = ""
    dam: str = ""
    dam_sire: str = ""
    vendor: str = ""  # consignor


@dataclass
class Catalogue:
    """A RawSale enriched for display."""

    raw: RawSale
    sale_type: str
    is_new: bool
    is_active: bool
    status_label: str
    first_seen: date | None
    lots: list[Lot] = field(default_factory=list)
    lots_error: str = ""  # "" or ERR:<ExceptionName> from fetch_lots

    @property
    def catalogue_id(self) -> str:
        return self.raw.catalogue_id
