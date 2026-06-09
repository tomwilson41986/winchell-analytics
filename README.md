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
| `/broodmares/japan-prospects`  | Japan Broodmare Prospects (nested route)     |

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

## Deployment (Netlify)

[`netlify.toml`](netlify.toml) configures:

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **SPA redirect:** `/* → /index.html` (200) so client-side React Router routes
  resolve on direct hits and refreshes.

Connect the repository in Netlify (or `netlify deploy`) and it builds and
publishes automatically.

---

# Winchell Portfolio Analytics (data pipeline)

A Python 3.11 pipeline discovers the Winchell Thoroughbreds roster, scrapes
pedigree / sales / results, scores each horse, and writes canonical JSON that
the site reads at runtime. Two routes surface it: **`/portfolio`** (overview
with KPI cards, search and a sortable roster table) and **`/horse/:horseId`**
(per-horse profile: pedigree, sales, cumulative-earnings chart and full
results). They reuse the site's existing components and palette.

## Layout

```
scrapers/   base.py (HTTP: rate limit, robots, retries, cache, block-detection)
            config.py (owner aliases + Winchell match guard + source registry)
            owner_discovery.py (owner page / results scan / seed bootstrap)
            horse_scrapers.py (Pedigree/Results/Sales/HRN scrapers)
            wiki.py (WikiScraper: open Wikipedia earnings/owner/bio)
pipeline/   schema.py (pydantic canonical models)
            score.py (pure scoring from form + results)
            build_profiles.py (slugify, write_profile, rollup + index)
            run.py (CLI)
data/       roster.json, horses.json, portfolio.json, profiles/<id>.json,
            seed_horses.txt, cache/ (raw responses, git-ignored)
```

## Running

```bash
pip install -r requirements.txt
python -m pipeline.run --refresh-roster --build-profiles --publish
```

- `--refresh-roster` rediscovers the roster → `data/roster.json`.
- `--build-profiles` scrapes + scores → `data/profiles/<id>.json`, plus
  `horses.json` (cards sorted by earnings) and `portfolio.json` (rollup).
- `--publish` copies the JSON into `public/data/portfolio/` (a commented
  boto3 S3-sync alternative is in `run.py`).
- `--offline` uses only the response cache; never touches the network.
- `--import-html FILE --refno N` / `--url U` seeds the cache with a page you
  saved from your own browser (see below).

`.github/workflows/refresh-data.yml` runs this weekly (roster, Mondays) and
daily (profiles), then commits the JSON back so Netlify rebuilds.

## Data sources and access reality

| Source | Use | Status |
| --- | --- | --- |
| **Horse Racing Nation** | full race-by-race results (grades + HRN speed figures), status, owner, trainer, pedigree summary | **Working, verified live** — the primary industry results source. robots.txt allows `/horse/` pages for the generic agent (it blocks named AI-training crawlers, which we are not). |
| **pedigreequery.com** | detailed pedigree (sire/dam/damsire, 3-gen, inbreeding) | **Working, verified live** against Gun Runner, Tapit, Epicenter, etc. |
| **Wikipedia** (`/wiki/`) | career earnings total, owner confirmation, breeder, bio, Equibase refno | **Working, verified live.** Openly licensed (CC BY-SA); robots-clean article pages only. |
| **Equibase** | per-race earnings, official charts | **Bot-gated (Imperva).** Live pages return a challenge — fed instead via `--import-html`, where it takes precedence over HRN for the race table. |
| **Keeneland / Fasig-Tipton** | auction results | Behind JavaScript "digital" portals with no static name-search; fed via `--import-html`. |

Each source fills what it reliably provides: HRN drives the results table,
graded-win counts, best speed figure, class trajectory and status; pedigreequery
the detailed 3-generation pedigree and inbreeding; Wikipedia the career earnings
total (HRN does not publish per-race purses). Where they overlap (e.g. owner,
sire) they cross-check each other.

### Feeding gated sources without circumventing anything

Equibase result charts and auction pages can't be fetched programmatically, but
you can open them in your own browser, **save the page**, and hand the file to
the pipeline. It is cached under the source URL and parsed on the next build
through the normal path — no bot protection is defeated:

```bash
# Equibase results for a horse (refno is auto-discovered from Wikipedia):
python -m pipeline.run --import-html gun-runner.html --refno 9496167
# Any other saved page, keyed by the URL you saved it from:
python -m pipeline.run --import-html keeneland-sept.html --url "https://www.keeneland.com/..."
python -m pipeline.run --build-profiles --publish
```

Imported charts unlock the full results table, speed figures, graded-win counts
and the class-trajectory score automatically.

### Discovering the active roster from the Equibase owner page

The canonical list of a stable's current runners is the Equibase **owner
profile**, which is bot-gated like the rest of Equibase. The owner route uses
the same save-and-import idea, then discovers the whole roster from it:

```bash
# 1. In your browser, open the Winchell owner profile and save the page:
#    https://www.equibase.com/profiles/Results.cfm?type=People&searchType=O&eID=1372865&rbt=TB
#    (partnership pages also exist, e.g. with Three Chimneys eID=2046423.)
# 2. Import the saved file, keyed by that URL:
OWNER="https://www.equibase.com/profiles/Results.cfm?type=People&searchType=O&eID=1372865&rbt=TB"
python -m pipeline.run --import-html winchell-owner.html --url "$OWNER"
# 3. Rediscover the roster from it, then build:
python -m pipeline.run --refresh-roster --owner-url "$OWNER" --build-profiles --publish
```

Discovery reads each horse-profile link off the owner page (it ignores the
trainer/jockey links), merges the new horses with the seed list, and every
discovered horse then gets the full HRN + pedigree + Wikipedia treatment —
including its `status`, so currently-active runners surface in the portfolio's
"Active" count. Horse names that resolve to a namesake are guarded by the sire
cross-check (HRN's sire feeds the pedigree/Wikipedia lookups).

Because Equibase and the auction houses gate their data, those scrapers are
**block-aware and header-driven**: they identify the project honestly, obey
crawl-delays, detect challenge pages and degrade to `None`/empty (the UI then
shows "no data found"). They can also parse a results/sales page **saved from a
browser** and dropped into `data/cache/` — a terms-clean way to feed them
without circumventing any protection. **No data is ever fabricated to fill a
gap.** The roster therefore comes from the hand-verified `data/seed_horses.txt`
(each entry carries a sire hint so the pedigree resolver picks the correct page
when a horse name collides with an older namesake), and profiles are populated
with real pedigree data plus whatever else resolves.

## Hard rules honoured

- No synthetic data: absent fields are `None`/empty and render "no data found".
- robots.txt respected; per-source rate limits applied; raw responses cached
  for provenance and to avoid re-hitting sources.
- British English in prose; USD currency formatting for US sales/earnings.
