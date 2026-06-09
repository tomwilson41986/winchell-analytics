import type { ChartDatum } from './aggregate'

/**
 * Types + helpers for the Japan Broodmare Prospects section.
 *
 * Data is produced by `scripts/fetch-japan-prospects.mjs` (run in CI) from the
 * `tomwilson41986/japanracefillies` feed and served as static JSON from
 * `public/data/japan-prospects/`. Pages load it at runtime via `fetchJson`
 * (same pattern as Historic Sales Analysis), so the JS bundle stays light and
 * the growing daily archive isn't inlined.
 */

const BASE = '/data/japan-prospects'

export const INDEX_PATH = `${BASE}/index.json`
export const MASTER_PATH = `${BASE}/master.json`
export const PROSPECTS_PATH = `${BASE}/prospects.json`
export const dayPath = (date: string) => `${BASE}/days/${date}.json`

/** One row of the rolling all-time master (`data/flagged/prospects.csv`). */
export interface MasterProspect {
  key: string
  horse: string | null
  horse_romaji: string | null
  name_kanji: string | null
  sire: string | null
  sire_romaji: string | null
  dam: string | null
  dam_romaji: string | null
  owner: string | null
  owner_romaji: string | null
  trainer: string | null
  trainer_romaji: string | null
  best_rating: number | null
  best_distance_m: number | null
  last_seen: string | null
  track: string | null
}

/** One flagged run from a daily flagged JSON (`data/flagged/<year>/<date>.json`). */
export interface FlaggedRun {
  horse: string | null
  horse_romaji: string | null
  name_kanji: string | null
  sire: string | null
  sire_romaji: string | null
  dam: string | null
  dam_romaji: string | null
  owner: string | null
  owner_romaji: string | null
  trainer: string | null
  trainer_romaji: string | null
  distance_m: number | null
  rating: number | null
  age: number | null
  sex: string | null
  date: string | null
  race_id: string | null
  track: string | null
  org: string | null
  surface: string | null
  horse_id: string | null
  class_label: string | null
  race_name: string | null
  finish_pos: number | null
  field_size: number | null
  profile_url: string | null
  result_url: string | null
  class_rating: number | null
  netkeiba_index: number | null
  official_rating: number | null
}

/** A day in the digest archive (from the generated manifest). */
export interface DigestDay {
  date: string
  year: string
  count: number
  /** Total rated runs analysed that day, when the processed file was available. */
  runsAnalysed?: number | null
  /** Distinct races covered that day, when available. */
  racesCovered?: number | null
}

/** Generated manifest of the whole feed. Deterministic (no wall-clock fields). */
export interface ProspectsIndex {
  /** Date (YYYY-MM-DD) of the most recent day present, or null when empty. */
  lastDate: string | null
  totalProspects: number
  days: DigestDay[]
}

/** Per-prospect detail: identity + every flagged appearance, newest first. */
export interface ProspectDetail {
  key: string
  appearances: FlaggedRun[]
}

/** `prospects.json` is an object keyed by prospect `key`. */
export type ProspectsByKey = Record<string, ProspectDetail>

/* ---------------------------------------------------------------------------
 * Display rule: show the Japanese name when present, else the romaji/English.
 * ------------------------------------------------------------------------- */

/** Prefer the Japanese field, falling back to the romaji/English field. */
export function preferJa(
  ja: string | null | undefined,
  romaji: string | null | undefined,
): string {
  const j = (ja ?? '').trim()
  if (j) return j
  return (romaji ?? '').trim()
}

/** Romaji/English to show beneath the Japanese (only when it adds something). */
export function secondary(
  ja: string | null | undefined,
  romaji: string | null | undefined,
): string {
  const j = (ja ?? '').trim()
  const r = (romaji ?? '').trim()
  return j && r && j !== r ? r : ''
}

/** Best display name for a master prospect (horse). */
export function masterName(p: MasterProspect): string {
  return (
    preferJa(p.horse, p.horse_romaji) || preferJa(p.name_kanji, null) || p.key
  )
}

/** Best display name for a flagged run (horse). */
export function runName(r: FlaggedRun): string {
  return preferJa(r.horse, r.horse_romaji) || preferJa(r.name_kanji, null) || '—'
}

/** Stable identity key for a flagged run, matching the fetch script:
 *  horse_id, else horse (JA), else horse_romaji. */
export function runIdentityKey(r: FlaggedRun): string {
  return (r.horse_id ?? '') || (r.horse ?? '') || (r.horse_romaji ?? '')
}

/* ---------------------------------------------------------------------------
 * Rating semantics — house class score 0–120 (only female, 1400–2600m, ≥90
 * are flagged). Colour bands match the email digest copy.
 * ------------------------------------------------------------------------- */

export type RatingBand = 'elite' | 'black-type' | 'stakes' | 'flagged'

export interface BandInfo {
  band: RatingBand
  label: string
  /** Maps to a CSS tone: green for elite/black-type, amber for stakes, grey otherwise. */
  tone: 'green' | 'amber' | 'grey'
}

export function ratingBand(rating: number | null | undefined): BandInfo {
  const r = rating ?? -Infinity
  if (r >= 115) return { band: 'elite', label: 'Elite', tone: 'green' }
  if (r >= 105) return { band: 'black-type', label: 'Black-type', tone: 'green' }
  if (r >= 95) return { band: 'stakes', label: 'Stakes', tone: 'amber' }
  return { band: 'flagged', label: 'Flagged', tone: 'grey' }
}

/* ---------------------------------------------------------------------------
 * Formatting helpers
 * ------------------------------------------------------------------------- */

/** "1st of 12" finish text from finish_pos + field_size. */
export function finishText(
  pos: number | null | undefined,
  field: number | null | undefined,
): string {
  if (pos == null) return ''
  const ord = ordinal(pos)
  return field != null ? `${ord} of ${field}` : ord
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/** "1600m" distance, blank when missing. */
export function distanceText(m: number | null | undefined): string {
  return m == null ? '' : `${m.toLocaleString()}m`
}

/** "turf" / "dirt" title-cased. */
export function titleCase(s: string | null | undefined): string {
  const v = (s ?? '').trim()
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : ''
}

/** "5yo F" age/sex chip. */
export function ageSexText(
  age: number | null | undefined,
  sex: string | null | undefined,
): string {
  const parts: string[] = []
  if (age != null) parts.push(`${age}yo`)
  const s = (sex ?? '').trim()
  if (s) parts.push(s.toUpperCase())
  return parts.join(' ')
}

/** Format a YYYY-MM-DD date for headers, e.g. "9 June 2026". */
export function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/* ---------------------------------------------------------------------------
 * Dashboard aggregates (computed client-side from master + index)
 * ------------------------------------------------------------------------- */

/** Prospects flagged per day (chronological), from the manifest. */
export function flaggedPerDay(index: ProspectsIndex): ChartDatum[] {
  return [...index.days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ label: d.date.slice(5), value: d.count }))
}

const RATING_BANDS: { label: string; min: number; max: number }[] = [
  { label: '90–94', min: 90, max: 95 },
  { label: '95–104', min: 95, max: 105 },
  { label: '105–114', min: 105, max: 115 },
  { label: '115+', min: 115, max: Infinity },
]

/** Best-rating distribution across the master list. */
export function ratingDistribution(master: MasterProspect[]): ChartDatum[] {
  return RATING_BANDS.map((b) => ({
    label: b.label,
    value: master.filter(
      (p) => p.best_rating != null && p.best_rating >= b.min && p.best_rating < b.max,
    ).length,
  }))
}

/** Count master prospects by a display field (using the JA-preferred name). */
export function countByDisplay(
  master: MasterProspect[],
  ja: keyof MasterProspect,
  romaji: keyof MasterProspect,
): ChartDatum[] {
  const counts = new Map<string, number>()
  for (const p of master) {
    const label =
      preferJa(p[ja] as string | null, p[romaji] as string | null) || 'Unknown'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }))
}

/** Count master prospects by track. */
export function countByTrack(master: MasterProspect[]): ChartDatum[] {
  const counts = new Map<string, number>()
  for (const p of master) {
    const label = (p.track ?? '').trim() || 'Unknown'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }))
}
