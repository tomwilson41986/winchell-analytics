# Historic Sales Analysis — data

Source dataset for the **Sales → Historic Sales Analysis** report
(`/sales/historic-sales-analysis`).

## Files

- `source/winchell-sales-data-review.xlsx` — original workbook (source of truth).
- The served dataset lives at
  `public/data/sales/historic-sales-analysis/sales-records.json`
  (~11k rows). It is placed under `public/` — and **fetched at runtime** by the
  report page — rather than under the build-time-bundled `data/` glob, because
  it is too large to inline into the JS bundle.

## Regenerating

After updating the workbook, regenerate both JSON files:

```bash
pip install openpyxl
python3 scripts/convert-sales-data.py        # raw records -> sales-records.json
python3 scripts/convert-analysis-tables.py   # summary sheets -> analysis-tables.json
```

`convert-sales-data.py` reads the `Sales Data` sheet and writes the cleaned
per-horse records. Each record:

| field | notes |
| ----- | ----- |
| `year`, `sale`, `hip`, `name`, `sire`, `dam`, `consignor` | sire is title-cased so it groups cleanly |
| `rating` | R2 Bio Rating (number, may be null) |
| `grade` | R2 Bio Grade (`"A"` or empty) |
| `breeze` | R2 Breeze Rating (number, may be null) |
| `runner`, `winner`, `sw`, `gsw`, `g1w` | outcome flags (0/1): Runner → Winner → Stakes Winner → Graded SW → Grade 1 Winner |

`convert-analysis-tables.py` extracts the workbook's pre-computed analysis
sheets (Baseline, Summary, R2 Rated, Heart Data, Winchell Shortlist + R2) into
`public/data/sales/historic-sales-analysis/analysis-tables.json`, which powers
the report's **Selection Factors**, **Biomechanics** and **Heart** tabs. All
rate fields there are fractions (0–1); the UI renders them as percentages.
