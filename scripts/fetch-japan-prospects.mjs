#!/usr/bin/env node
/**
 * Fetch the Japan broodmare-prospect feed from `tomwilson41986/japanracefillies`
 * and write the static JSON consumed by the Japan Broodmare Prospects section.
 *
 * Reads (data feed, branch `main`):
 *   data/flagged/prospects.csv          — rolling all-time master
 *   data/flagged/<year>/<date>.json     — that day's flagged prospects
 *   data/processed/<year>/<date>.json   — every rated run that day (for counts)
 *
 * Writes (this repo, served from public/ and fetched at runtime):
 *   public/data/japan-prospects/index.json      — manifest of days + totals
 *   public/data/japan-prospects/master.json     — master prospect list
 *   public/data/japan-prospects/prospects.json  — key -> { appearances[] }
 *   public/data/japan-prospects/days/<date>.json — daily flagged arrays
 *
 * Auth: the feed repo is private, so a token is read from JAPAN_DATA_TOKEN
 * (preferred) or GITHUB_TOKEN. Output is deterministic (no wall-clock fields,
 * stable key order) so unchanged data produces no diff.
 *
 * Run: `node scripts/fetch-japan-prospects.mjs`
 */
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OWNER = 'tomwilson41986'
const REPO = 'japanracefillies'
const REF = 'main'
const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents`

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/data/japan-prospects')
const DAYS_OUT = join(OUT, 'days')

const TOKEN = process.env.JAPAN_DATA_TOKEN || process.env.GITHUB_TOKEN || ''
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})\.json$/

/* --------------------------------------------------------------------------
 * GitHub helpers (Contents API; works for private repos with a token).
 * ------------------------------------------------------------------------ */
function headers(accept) {
  const h = { Accept: accept, 'User-Agent': 'winchell-analytics-fetch' }
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`
  return h
}

async function ghFetch(path, accept) {
  const url = `${API}/${path}?ref=${REF}`
  let lastErr
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { headers: headers(accept) })
      if (res.status === 404) return { status: 404, res }
      if (res.status === 403 || res.status >= 500) {
        // Rate limited / transient — back off and retry.
        lastErr = new Error(`${res.status} ${res.statusText} for ${path}`)
      } else if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText} for ${path}`)
      } else {
        return { status: res.status, res }
      }
    } catch (e) {
      lastErr = e
    }
    await sleep(1000 * 2 ** attempt)
  }
  throw lastErr ?? new Error(`Failed: ${path}`)
}

/** List a directory; returns [] when the path is missing. */
async function listDir(path) {
  const { status, res } = await ghFetch(path, 'application/vnd.github+json')
  if (status === 404) return []
  return res.json()
}

/** Fetch a file's raw text; returns null when missing. */
async function getRaw(path) {
  const { status, res } = await ghFetch(path, 'application/vnd.github.raw')
  if (status === 404) return null
  return res.text()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* --------------------------------------------------------------------------
 * Parsing / normalisation
 * ------------------------------------------------------------------------ */
function num(v) {
  if (v == null || v === '') return null
  const n = Number(typeof v === 'string' ? v.replace(/[^0-9.+-]/g, '') : v)
  return Number.isFinite(n) ? n : null
}

function str(v) {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Minimal CSV parser (quoted fields, escaped quotes, CR/LF). */
function parseCsv(text) {
  const rows = []
  let field = ''
  let row = []
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else q = false
      } else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); field = ''; row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  if (!rows.length) return []
  const hdr = rows[0].map((h) => h.trim())
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i] ?? ''])))
}

const MASTER_KEYS = [
  'key', 'horse', 'horse_romaji', 'name_kanji', 'sire', 'sire_romaji', 'dam',
  'dam_romaji', 'owner', 'owner_romaji', 'trainer', 'trainer_romaji',
  'best_rating', 'best_distance_m', 'last_seen', 'track',
]
const MASTER_NUM = new Set(['best_rating', 'best_distance_m'])

function normMaster(r) {
  const o = {}
  for (const k of MASTER_KEYS) o[k] = MASTER_NUM.has(k) ? num(r[k]) : str(r[k])
  if (!o.key) o.key = o.horse || o.horse_romaji || ''
  return o
}

const RUN_KEYS = [
  'horse', 'horse_romaji', 'name_kanji', 'sire', 'sire_romaji', 'dam',
  'dam_romaji', 'owner', 'owner_romaji', 'trainer', 'trainer_romaji',
  'distance_m', 'rating', 'age', 'sex', 'date', 'race_id', 'track', 'org',
  'surface', 'horse_id', 'class_label', 'race_name', 'finish_pos',
  'field_size', 'profile_url', 'result_url', 'class_rating', 'netkeiba_index',
  'official_rating',
]
const RUN_NUM = new Set([
  'distance_m', 'rating', 'age', 'finish_pos', 'field_size', 'class_rating',
  'netkeiba_index', 'official_rating',
])

function normRun(r) {
  const o = {}
  for (const k of RUN_KEYS) o[k] = RUN_NUM.has(k) ? num(r[k]) : str(r[k])
  return o
}

/** Stable identity key for a flagged run (mirrors the UI's derivation):
 *  horse_id, else horse (JA), else horse_romaji. */
const runKey = (r) => r.horse_id || r.horse || r.horse_romaji || ''

/** JSON with sorted top-level object keys, for deterministic diffs. */
function stableObject(obj) {
  const sorted = {}
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k]
  return sorted
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value) + '\n')
}

/* --------------------------------------------------------------------------
 * Main
 * ------------------------------------------------------------------------ */
async function main() {
  if (!TOKEN) {
    console.warn(
      '[fetch] No JAPAN_DATA_TOKEN / GITHUB_TOKEN set — the feed repo is private, ' +
        'so this will likely fail. Set the secret in CI.',
    )
  }

  // 1. Enumerate year directories + locate the master CSV.
  const flagged = await listDir('data/flagged')
  const years = flagged
    .filter((e) => e.type === 'dir' && /^\d{4}$/.test(e.name))
    .map((e) => e.name)
    .sort()
  const hasMaster = flagged.some((e) => e.type === 'file' && e.name === 'prospects.csv')

  // 2. Master list.
  let master = []
  if (hasMaster) {
    const csv = await getRaw('data/flagged/prospects.csv')
    if (csv) master = parseCsv(csv).map(normMaster).filter((m) => m.key)
  }
  // Sort best-rating-first (stable: rating desc, then key).
  master.sort((a, b) => (b.best_rating ?? -1) - (a.best_rating ?? -1) || a.key.localeCompare(b.key))

  // 3. Daily flagged + processed counts. Clear stale day files first so
  //    removed dates don't linger, then write fresh ones as we go.
  await mkdir(DAYS_OUT, { recursive: true })
  for (const f of await readdir(DAYS_OUT)) {
    if (f.endsWith('.json')) await rm(join(DAYS_OUT, f))
  }

  const days = []
  const byKey = new Map() // key -> appearances[]

  for (const year of years) {
    const entries = await listDir(`data/flagged/${year}`)
    const dates = entries
      .filter((e) => e.type === 'file' && DATE_RE.test(e.name))
      .map((e) => e.name.replace(/\.json$/, ''))
      .sort()

    for (const date of dates) {
      const raw = await getRaw(`data/flagged/${year}/${date}.json`)
      let arr = []
      try {
        arr = raw ? JSON.parse(raw) : []
      } catch {
        console.warn(`[fetch] Bad JSON for ${date}, treating as empty.`)
      }
      const runs = (Array.isArray(arr) ? arr : []).map(normRun)

      await writeJson(join(DAYS_OUT, `${date}.json`), runs)

      // Per-prospect appearances.
      for (const run of runs) {
        const k = runKey(run)
        if (!k) continue
        if (!byKey.has(k)) byKey.set(k, [])
        byKey.get(k).push(run)
      }

      // Optional: runs-analysed / races-covered from the processed feed.
      let runsAnalysed = null
      let racesCovered = null
      const processed = await getRaw(`data/processed/${year}/${date}.json`)
      if (processed) {
        try {
          const p = JSON.parse(processed)
          if (Array.isArray(p)) {
            runsAnalysed = p.length
            racesCovered = new Set(p.map((x) => x.race_id).filter(Boolean)).size
          }
        } catch {
          /* ignore */
        }
      }

      days.push({ date, year, count: runs.length, runsAnalysed, racesCovered })
    }
  }

  // 4. prospects.json — key -> { key, appearances[] } (newest first), key-sorted.
  const prospects = {}
  for (const [k, apps] of byKey) {
    apps.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    prospects[k] = { key: k, appearances: apps }
  }

  // 5. Manifest (deterministic — derives "lastDate" from the data, no clock).
  days.sort((a, b) => a.date.localeCompare(b.date))
  const index = {
    lastDate: days.length ? days[days.length - 1].date : null,
    totalProspects: master.length,
    days,
  }

  // 6. Write the manifest + master + per-prospect index (day files already
  //    written during the loop above).
  await writeJson(join(OUT, 'index.json'), index)
  await writeJson(join(OUT, 'master.json'), master)
  await writeJson(join(OUT, 'prospects.json'), stableObject(prospects))

  console.log(
    `[fetch] master=${master.length} days=${days.length} prospects=${Object.keys(prospects).length} lastDate=${index.lastDate}`,
  )
}

// Pure helpers are exported for testing; main() runs only when executed directly.
export { parseCsv, normMaster, normRun, runKey, stableObject, num, str }

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('[fetch] Failed:', e)
    process.exit(1)
  })
}
