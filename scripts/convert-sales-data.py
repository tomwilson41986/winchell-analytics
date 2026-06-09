#!/usr/bin/env python3
"""Convert the Winchell sales-data workbook into the JSON served by the
Historic Sales Analysis page.

One-time / on-update local tool — NOT run during the Netlify build. Requires
`openpyxl` (`pip install openpyxl`).

Input:  data/sales/historic-sales-analysis/source/winchell-sales-data-review.xlsx
Output: public/data/sales/historic-sales-analysis/sales-records.json

The output is placed under public/ (served as a static asset and fetched at
runtime) rather than under the build-time-bundled data/ directory, because the
dataset (~11k rows) is too large to inline into the JS bundle.
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
    ROOT, "public/data/sales/historic-sales-analysis/sales-records.json"
)
SHEET = "Sales Data"


def num(v):
    return round(float(v), 2) if isinstance(v, (int, float)) else None


def flag(v):
    return 1 if v in (1, 1.0, "1", True) else 0


def main():
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    ws = wb[SHEET]
    rows = list(ws.iter_rows(values_only=True))
    hdr = [str(h).strip() for h in rows[0]]
    i = {h: n for n, h in enumerate(hdr)}

    def g(r, name):
        return r[i[name]]

    out = []
    for r in rows[1:]:
        if not any(c is not None for c in r):
            continue
        sire = g(r, "Sire")
        hip = g(r, "Hip")
        out.append(
            {
                "year": int(g(r, "Year")) if g(r, "Year") else None,
                "sale": (g(r, "Sale") or "").strip(),
                "hip": str(int(hip)) if isinstance(hip, (int, float)) else (hip or ""),
                "name": (g(r, "name") or "").strip(),
                # Sires arrive in mixed case ("INTO MISCHIEF" vs "Into Mischief");
                # title-case so they group cleanly.
                "sire": str(sire).strip().title() if sire else "",
                "dam": (g(r, "Dam") or "").strip(),
                "consignor": (g(r, "Consignor") or "").strip(),
                "rating": num(g(r, "R2 Bio Rating")),
                "grade": (g(r, "R2 Bio Grade") or "").strip(),
                "breeze": num(g(r, "R2 Breeze Rating")),
                "runner": flag(g(r, "Runner")),
                "winner": flag(g(r, "Winner")),
                "sw": flag(g(r, "StakesWinner")),
                "gsw": flag(g(r, "GradedStakesWinner")),
                "g1w": flag(g(r, "Grade1Winner")),
            }
        )

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"Wrote {len(out)} records to {OUT}")


if __name__ == "__main__":
    main()
