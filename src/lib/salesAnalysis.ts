import type { ChartDatum } from './aggregate'

export interface SaleRecord {
  year: number | null
  sale: string
  hip: string
  name: string
  sire: string
  dam: string
  consignor: string
  rating: number | null
  grade: string
  breeze: number | null
  runner: number
  winner: number
  sw: number
  gsw: number
  g1w: number
}

export const DATA_PATH = '/data/sales/historic-sales-analysis/sales-records.json'
export const ANALYSIS_PATH =
  '/data/sales/historic-sales-analysis/analysis-tables.json'

/** A "factor → conversion" row (Summary, Heart Data sheets). Rates are 0–1. */
export interface FactorRow {
  factor: string
  value: string
  count: number
  runnersPct: number | null
  winnersPct: number | null
  swPct: number | null
  gswPct: number | null
  g1wPct: number | null
}

/** A threshold/band row (R2 Rated, Winchell Shortlist sheets). Rates are 0–1. */
export interface BandRow {
  band: string
  count: number
  runnersPct: number | null
  winnersPct: number | null
  swPct: number | null
  gswPct: number | null
  g1wPct: number | null
}

export interface AnalysisTables {
  baseline: {
    offered: number
    runnersPct: number
    winnersPct: number
    swPct: number
    gswPct: number
    g1wPct: number
  }
  factors: FactorRow[]
  eaPerRated: FactorRow[]
  heart: FactorRow[]
  r2Bio: BandRow[]
  r2Breeze: BandRow[]
  shortlistBio: BandRow[]
  shortlistBreeze: BandRow[]
}

/** Format a 0–1 rate as a percentage string (or em dash when missing). */
export function pctText(v: number | null | undefined): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`
}

/** Build chart data from rows, mapping a label field and a 0–1 rate field. */
export function pctSeries<T extends object>(
  rows: T[],
  labelKey: keyof T,
  pctKey: keyof T,
): ChartDatum[] {
  return rows.map((r) => ({
    label: String(r[labelKey]),
    value: +(((r[pctKey] as number) ?? 0) * 100).toFixed(2),
  }))
}

/** Outcome flag fields, in funnel order (each is a subset of the previous). */
export const OUTCOMES = [
  { key: 'runner', label: 'Runners' },
  { key: 'winner', label: 'Winners' },
  { key: 'sw', label: 'Stakes Winners' },
  { key: 'gsw', label: 'Graded SW' },
  { key: 'g1w', label: 'Grade 1 Winners' },
] as const

export type OutcomeKey = (typeof OUTCOMES)[number]['key']

function rate(records: SaleRecord[], key: OutcomeKey): number {
  if (records.length === 0) return 0
  let n = 0
  for (const r of records) n += r[key]
  return n / records.length
}

function count(records: SaleRecord[], key: OutcomeKey): number {
  let n = 0
  for (const r of records) n += r[key]
  return n
}

export interface Funnel {
  offered: number
  steps: { key: OutcomeKey; label: string; count: number; pct: number }[]
}

/** Offered → Runner → Winner → SW → GSW → G1W counts and rates. */
export function funnel(records: SaleRecord[]): Funnel {
  const offered = records.length
  return {
    offered,
    steps: OUTCOMES.map((o) => ({
      key: o.key,
      label: o.label,
      count: count(records, o.key),
      pct: offered ? count(records, o.key) / offered : 0,
    })),
  }
}

/** Funnel counts as chart data (Offered + each outcome). */
export function funnelChart(records: SaleRecord[]): ChartDatum[] {
  const f = funnel(records)
  return [
    { label: 'Offered', value: f.offered },
    ...f.steps.map((s) => ({ label: s.label, value: s.count })),
  ]
}

const RATING_BANDS: { label: string; min: number; max: number }[] = [
  { label: '<60', min: -Infinity, max: 60 },
  { label: '60–69', min: 60, max: 70 },
  { label: '70–79', min: 70, max: 80 },
  { label: '80–89', min: 80, max: 90 },
  { label: '90+', min: 90, max: Infinity },
]

/** Outcome rate (as a percentage 0–100) by R2 Bio rating band. */
export function rateByRatingBand(
  records: SaleRecord[],
  key: OutcomeKey,
): ChartDatum[] {
  const rated = records.filter((r) => typeof r.rating === 'number')
  return RATING_BANDS.map((b) => {
    const inBand = rated.filter((r) => r.rating! >= b.min && r.rating! < b.max)
    return { label: b.label, value: +(rate(inBand, key) * 100).toFixed(1) }
  })
}

/** Number of horses with a rating in each band (sample sizes). */
export function countByRatingBand(records: SaleRecord[]): ChartDatum[] {
  const rated = records.filter((r) => typeof r.rating === 'number')
  return RATING_BANDS.map((b) => ({
    label: b.label,
    value: rated.filter((r) => r.rating! >= b.min && r.rating! < b.max).length,
  }))
}

/** Outcome rate (percentage) grouped by a string field (e.g. sale), top N by count. */
export function rateByField(
  records: SaleRecord[],
  field: 'sale' | 'sire' | 'consignor',
  key: OutcomeKey,
  topByCount = 0,
): ChartDatum[] {
  const groups = new Map<string, SaleRecord[]>()
  for (const r of records) {
    const g = r[field] || 'Unknown'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(r)
  }
  let entries = [...groups.entries()].map(([label, recs]) => ({
    label,
    value: +(rate(recs, key) * 100).toFixed(1),
    n: recs.length,
  }))
  if (topByCount > 0) {
    entries = entries.sort((a, b) => b.n - a.n).slice(0, topByCount)
  }
  return entries.map(({ label, value }) => ({ label, value }))
}

export interface SireRow {
  sire: string
  count: number
  runners: number
  winners: number
  sw: number
  runnersPct: number
  winnersPct: number
  swPct: number
  gswPct: number
  g1wPct: number
}

/**
 * Per-sire conversion leaderboard. Only sires with at least `minCount` offered
 * are included (small samples are noise). Sorted by offered count desc.
 */
export function sireLeaderboard(
  records: SaleRecord[],
  minCount = 20,
): SireRow[] {
  const groups = new Map<string, SaleRecord[]>()
  for (const r of records) {
    if (!r.sire) continue
    if (!groups.has(r.sire)) groups.set(r.sire, [])
    groups.get(r.sire)!.push(r)
  }
  const out: SireRow[] = []
  for (const [sire, recs] of groups) {
    if (recs.length < minCount) continue
    const n = recs.length
    const sumOf = (k: OutcomeKey) => recs.reduce((a, r) => a + r[k], 0)
    const runners = sumOf('runner')
    const winners = sumOf('winner')
    const sw = sumOf('sw')
    const gsw = sumOf('gsw')
    const g1w = sumOf('g1w')
    out.push({
      sire,
      count: n,
      runners,
      winners,
      sw,
      runnersPct: runners / n,
      winnersPct: winners / n,
      swPct: sw / n,
      gswPct: gsw / n,
      g1wPct: g1w / n,
    })
  }
  return out.sort((a, b) => b.count - a.count)
}

/** Distinct non-empty values of a field, sorted. */
export function distinctValues(
  records: SaleRecord[],
  field: keyof SaleRecord,
): string[] {
  const set = new Set<string>()
  for (const r of records) {
    const v = r[field]
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      set.add(String(v))
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}
