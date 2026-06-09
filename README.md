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
│   ├── components/             # Logo, NavBar, Layout, DataTable, ChartCard
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

Font: **Inter** with a system sans-serif fallback.

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
automatically.

### Adding data to a section

1. Open the section's CSV under `data/<section>/` (e.g. `data/horses/horses.csv`).
2. Keep the header row; remove the `# PLACEHOLDER …` line.
3. Add one record per row. Lines that are empty or start with `#` are ignored.
4. Run `npm run dev` — the section's table updates automatically.

To add a **new** data file, drop a `.csv`/`.json` into the section folder and
call `loadCsv` / `loadJson` from the relevant page. New files under `data/` are
picked up by the glob automatically.

## Deployment (Netlify)

[`netlify.toml`](netlify.toml) configures:

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **SPA redirect:** `/* → /index.html` (200) so client-side React Router routes
  resolve on direct hits and refreshes.

Connect the repository in Netlify (or `netlify deploy`) and it builds and
publishes automatically.
