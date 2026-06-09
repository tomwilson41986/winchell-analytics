#!/usr/bin/env python3
"""Extract the pre-computed analysis sheets from the sales workbook into a small
combined JSON consumed by the Historic Sales Analysis report tabs.

One-time / on-update local tool (needs `openpyxl`). Run after
`convert-sales-data.py`.

Input:  data/sales/historic-sales-analysis/source/winchell-sales-data-review.xlsx
Output: public/data/sales/historic-sales-analysis/analysis-tables.json

All rate fields are fractions (0–1), matching the workbook; the UI renders them
as percentages.
"""
import json
import os
import sys

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is required: pip install openpyxl")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(
    ROOT, "data/sales/historic-sales-analysis/source/winchell-sales-data-review.xlsx"
)
OUT = os.path.join(
    ROOT, "public/data/sales/historic-sales-analysis/analysis-tables.json"
)


def n(v):
    return round(float(v), 4) if isinstance(v, (int, float)) else None


def rows_of(wb, sheet):
    return list(wb[sheet].iter_rows(values_only=True))


def factor_table(wb, sheet):
    """Sheets with Factor/Value/Count/.../%G1W columns (Summary, Heart Data)."""
    out = []
    for r in rows_of(wb, sheet)[1:]:
        if not r or r[0] is None or str(r[0]).strip() == "":
            continue
        out.append(
            {
                "factor": str(r[0]).strip(),
                "value": str(r[1]).strip() if r[1] is not None else "",
                "count": n(r[2]),
                "runnersPct": n(r[4]),
                "winnersPct": n(r[6]),
                "swPct": n(r[8]),
                "gswPct": n(r[10]),
                "g1wPct": n(r[12]),
            }
        )
    return out


def band_table(rows, count_idx=1):
    """Threshold rows: label, count, runners, %rnrs, wnrs, %wnrs, sw, %sw ..."""
    return {
        "band": str(rows[0]).strip(),
        "count": n(rows[count_idx]),
        "runnersPct": n(rows[count_idx + 2]),
        "winnersPct": n(rows[count_idx + 4]),
        "swPct": n(rows[count_idx + 6]),
        "gswPct": n(rows[count_idx + 8]),
        "g1wPct": n(rows[count_idx + 10]),
    }


def r2_rated(wb):
    bio, breeze = [], []
    target = None
    for r in rows_of(wb, "R2 Rated"):
        if not r or r[0] is None:
            continue
        head = str(r[0]).strip()
        if head == "R2 Bio":
            target = bio
            continue
        if head == "R2 Breeze":
            target = breeze
            continue
        if head.startswith("R2 -"):
            continue
        if target is not None and (head.startswith(">") or head.startswith("<")):
            target.append(band_table(r, count_idx=1))
    return bio, breeze


def shortlist(wb):
    bio, breeze = [], []
    target = bio
    for r in rows_of(wb, "Winchell Shortlist + R2"):
        if not r or r[0] is None:
            continue
        head = str(r[0]).strip()
        if head == "Biomechanic rating":
            target = bio
            continue
        if head == "Breeze Rating":
            target = breeze
            continue
        if head.startswith("*"):
            continue
        if head.startswith(">") or head.startswith("<") or head.startswith("All"):
            target.append(band_table(r, count_idx=1))
    return bio, breeze


def baseline(wb):
    r = rows_of(wb, "Baseline")[2]  # data row under the first header
    return {
        "offered": n(r[0]),
        "runnersPct": n(r[2]),
        "winnersPct": n(r[4]),
        "swPct": n(r[6]),
        "gswPct": n(r[8]),
        "g1wPct": n(r[10]),
    }


def main():
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    r2bio, r2breeze = r2_rated(wb)
    slbio, slbreeze = shortlist(wb)
    data = {
        "baseline": baseline(wb),
        "factors": factor_table(wb, "Summary"),
        "eaPerRated": factor_table(wb, "EA Per Rated"),
        "heart": factor_table(wb, "Heart Data"),
        "r2Bio": r2bio,
        "r2Breeze": r2breeze,
        "shortlistBio": slbio,
        "shortlistBreeze": slbreeze,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    counts = {k: (len(v) if isinstance(v, list) else 1) for k, v in data.items()}
    print(f"Wrote {OUT}\n  sections: {counts}")


if __name__ == "__main__":
    main()
