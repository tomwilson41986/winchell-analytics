# Winchell Analytics

A static thoroughbred racing analytics site for the Winchell Thoroughbreds
programme. Built with **Vite + React + TypeScript**, **React Router** for
navigation, and **plain CSS** (CSS variables for theming — no Tailwind).
Deploys to **Netlify**.

## Sections / routes

| Route                          | Section                                      |
| ------------------------------ | -------------------------------------------- |
| `/`                            | Home                                         |
| `/horses`                      | Horses                                       |
| `/sales`                       | Sales (historic sales data and analysis)     |
| `/sires`                       | Sires                                        |
| `/broodmares`                  | Broodmares                                   |
| `/broodmares/japan-prospects`  | Japan Broodmare Prospects — master + dashboard |
| `/broodmares/japan-prospects/digests`        | Daily digest archive (one page per day) |
| `/broodmares/japan-prospects/digests/:date`  | A single day's digest (mirrors the email) |
| `/broodmares/japan-prospects/prospect/:key`  | Per-prospect detail + flagged race history |

## Local development

```bash
npm install
npm run dev      # start the Vite dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build locally
```

## Project structure

```
/
├── public/
│   ├── winchell-silks.png      # brand logo (provided — see note below)
│   └── README.md               # asset notes
├── src/
│   ├── components/             # Logo, NavBar, Layout, PageHeader, DataTable,
│   │                           #   ChartCard, StatTile, Icon
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Horses/
│   │   ├── Sales/
│   │   ├── Sires/
│   │   └── Broodmares/
│   │       └── JapanProspects/
│   ├── styles/                 # theme.css (CSS variables / palette)
│   ├── lib/                    # data-loading helpers (CSV/JSON parse + load)
│   ├── App.tsx                 # routes
│   └── main.tsx                # entry
├── data/                       # source data, mirrors the site sections
│   ├── horses/
│   ├── sales/
│   ├── sires/
│   └── broodmares/
│       └── japan-prospects/
├── netlify.toml
├── package.json
└── README.md
```

## Brand / theme

The palette is based on the Winchell Thoroughbreds racing silks (maroon &
white). Tokens live in [`src/styles/theme.css`](src/styles/theme.css):

| Variable        | Value     | Use                  |
| --------------- | --------- | -------------------- |
| `--maroon`      | `#7A2030` | primary (silks body) |
| `--maroon-dark` | `#5A1623` | hover / accents      |
| `--white`       | `#FFFFFF` | surfaces             |
| `--ink`         | `#1A1A1A` | text                 |
| `--grey`        | `#6B7280` | muted text           |
| `--bg`          | `#F8F6F6` | page background      |

Font: **Inter** (body) and **Inter Tight** (display headings), self-hosted via
`@fontsource-variable/*` so they load offline with no external request, with a
system sans-serif fallback. Numeric data uses tabular figures.

### Logo

`public/winchell-silks.png` is the brand logo, rendered by the `<Logo />`
component (header, ~40px tall) and used as the favicon via `index.html`. **This
image is provided by the project owner — do not replace it with a generated or
substitute graphic.** See [`public/README.md`](public/README.md).

## Data handling

Raw source data lives under [`data/`](data/), one folder per section, mirroring
the site. Each section ships **one small sample CSV with realistic column
headers but no records** (header-only, with a clearly-marked placeholder
line) — nothing is fabricated, so the loaders are wired up and ready.

```
data/
├── horses/horses.csv
├── sales/sales.csv
├── sires/sires.csv
└── broodmares/
    ├── broodmares.csv
    └── japan-prospects/japan-prospects.csv
```

### How the loaders work

`src/lib/data.ts` uses Vite's `import.meta.glob` to bundle the raw text of every
`*.csv` / `*.json` under `data/` at build time, so pages read it directly with
no runtime fetch and no need to copy files into `public/`.

- `loadCsv(section, file)` → `{ headers, rows }` (parsed via
  `src/lib/csv.ts`)
- `loadJson(section, file)` → parsed JSON
- `listSectionFiles(section)` → file names available in a section

Pages derive table columns from the CSV headers, so adding columns flows through
automatically. Tables are **sortable** — click a column header to sort
(numeric columns sort numerically; blanks sort last) — and each section's KPI
tiles are **computed from the loaded rows** (e.g. top/median sale price, total
progeny earnings, foals recorded) via the helpers in `src/lib/stats.ts`. With
the shipped header-only samples the tiles show a muted `—` until data is added.

### Adding data to a section

1. Open the section's CSV under `data/<section>/` (e.g. `data/horses/horses.csv`).
2. Keep the header row; remove the `# PLACEHOLDER …` line.
3. Add one record per row. Lines that are empty or start with `#` are ignored.
4. Run `npm run dev` — the section's table updates automatically.

To add a **new** data file, drop a `.csv`/`.json` into the section folder and
call `loadCsv` / `loadJson` from the relevant page. New files under `data/` are
picked up by the glob automatically.

## Charts

Charts use [Recharts](https://recharts.org/) wrapped in small, theme-matched
components under `src/components/charts/`:

- `BarChart` and `LineChart` — branded bar / area charts (maroon gradients,
  tabular figures, custom tooltip). Both take `data: { label, value }[]`.
- `LazyCharts` — `React.lazy` wrappers used by the pages, so Recharts is
  **code-split** into its own chunk and only downloaded when a chart actually
  renders. The home page and any data-less section stay light.

Each page turns its rows into chart data with the helpers in
`src/lib/aggregate.ts` (`countBy`, `sumBy`, `averageBy`, `topN`, `sortByLabel`,
`formatCompact`). For example, Sales charts the average price per year:

```ts
const priceByYear = sortByLabel(averageBy(rows, 'year', 'price'))
// …
<ChartCard title="Price trends by year">
  {has ? <LineChart data={priceByYear} valueLabel="Avg price" /> : undefined}
</ChartCard>
```

Charts render **only when the section has data**; with the shipped header-only
samples they fall back to the `ChartCard` placeholder. Nothing is fabricated.

## Japan Broodmare Prospects (daily feed)

This section mirrors the daily broodmare-prospect emails and **updates daily,
automatically**. It is built natively in this stack — same components, design
tokens, routing and `public/` + runtime-fetch data pattern as Historic Sales
Analysis.

**Four features:**

1. **Prospects master** (`/broodmares/japan-prospects`) — searchable, sortable,
   paginated table of every flagged filly/mare (one row per mare, best rating
   kept), with a **Dashboard** tab (flagged-per-day, best-rating distribution,
   top sires, prospects by track).
2. **Daily digest archive** (`/…/digests`) — one browsable page per day.
3. **Per-day digest** (`/…/digests/:date`) — reproduces the email layout: date +
   flagged count, summary tiles, one card per prospect (rating badge, class
   chip, finish, distance/surface, age/sex, full pedigree with English beneath
   Japanese, Profile & Form / Race Result links). Empty days render
   "No prospects met the criteria".
4. **Per-prospect detail** (`/…/prospect/:key`) — pedigree, connections and the
   mare's full flagged race history (linking out to her profile and each race).

### Data source & flow

Data comes from the read-only feed repo `tomwilson41986/japanracefillies`
(branch `main`) — **no racing-site scraping**. Because that repo is **private**,
the fetch authenticates with a token.

```
japanracefillies (feed)                      this repo
  data/flagged/prospects.csv        ─┐
  data/flagged/<year>/<date>.json   ─┤  scripts/fetch-japan-prospects.mjs
  data/processed/<year>/<date>.json ─┘        │ (run in CI, token-authed)
                                              ▼
                            public/data/japan-prospects/
                              index.json      (manifest: days + totals)
                              master.json     (master prospect list)
                              prospects.json  (key → flagged appearances)
                              days/<date>.json (each day's flagged runs)
                                              │ runtime fetch (src/lib/japanProspects.ts)
                                              ▼
                                    React pages render the four features
```

The fetch output is **deterministic** (stable key order, no wall-clock fields),
so unchanged data produces no diff. Rating colour bands match the email:
≥115 elite / ≥105 black-type (green), ≥95 stakes (amber), below grey.

### Daily auto-update

[`.github/workflows/japan-prospects.yml`](.github/workflows/japan-prospects.yml)
runs at **21:30 UTC (06:30 JST)** — just after the feed refreshes at 06:00 JST —
and on manual dispatch. It runs the fetch script, and commits any changes under
`public/data/japan-prospects/`. The commit triggers Netlify's connected-repo
build, which redeploys the section from the new data.

**Required secret:** add a repository secret **`JAPAN_DATA_TOKEN`** — a
fine-grained PAT with **read** access to `tomwilson41986/japanracefillies`
(Contents: Read). Run the fetch locally with
`JAPAN_DATA_TOKEN=… npm run fetch:japan`.

> The committed `public/data/japan-prospects/*` files ship **empty but valid**
> (the section renders graceful "awaiting data" / "no prospects" states); the
> first workflow run with the secret populates them.

## Deployment (Netlify)

[`netlify.toml`](netlify.toml) configures:

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **SPA redirect:** `/* → /index.html` (200) so client-side React Router routes
  resolve on direct hits and refreshes.

Connect the repository in Netlify (or `netlify deploy`) and it builds and
publishes automatically.
