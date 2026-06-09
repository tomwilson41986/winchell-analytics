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
