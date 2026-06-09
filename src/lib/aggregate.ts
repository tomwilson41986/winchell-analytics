export interface ChartDatum {
  label: string
  value: number
}

/** Parse a numeric cell, stripping currency symbols, commas and spaces. */
export function parseNumber(raw: unknown): number | null {
  if (raw == null) return null
  const n = Number(String(raw).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Count rows grouped by the value of `key`. */
export function countBy(
  rows: Record<string, string>[],
  key: string,
): ChartDatum[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const label = (row[key] ?? '').trim() || 'Unknown'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }))
}

/** Sum `valueKey` grouped by `groupKey` (ignores non-numeric values). */
export function sumBy(
  rows: Record<string, string>[],
  groupKey: string,
  valueKey: string,
): ChartDatum[] {
  const sums = new Map<string, number>()
  for (const row of rows) {
    const value = parseNumber(row[valueKey])
    if (value == null) continue
    const label = (row[groupKey] ?? '').trim() || 'Unknown'
    sums.set(label, (sums.get(label) ?? 0) + value)
  }
  return [...sums.entries()].map(([label, value]) => ({ label, value }))
}

/** Average `valueKey` grouped by `groupKey` (e.g. mean price per year). */
export function averageBy(
  rows: Record<string, string>[],
  groupKey: string,
  valueKey: string,
): ChartDatum[] {
  const agg = new Map<string, { total: number; n: number }>()
  for (const row of rows) {
    const value = parseNumber(row[valueKey])
    if (value == null) continue
    const label = (row[groupKey] ?? '').trim() || 'Unknown'
    const cur = agg.get(label) ?? { total: 0, n: 0 }
    cur.total += value
    cur.n += 1
    agg.set(label, cur)
  }
  return [...agg.entries()].map(([label, { total, n }]) => ({
    label,
    value: Math.round(total / n),
  }))
}

/** Sort ascending by label (handy for year-based series). */
export function sortByLabel(data: ChartDatum[]): ChartDatum[] {
  return [...data].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
}

/** Sort descending by value and keep the top `n` (handy for leaderboards). */
export function topN(data: ChartDatum[], n: number): ChartDatum[] {
  return [...data].sort((a, b) => b.value - a.value).slice(0, n)
}

/** Compact number formatting for axes/tooltips (1.2K, 3.4M). */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

/** Full USD currency, no decimals (e.g. $725,000). */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

/** Compact USD for KPI tiles / axes (e.g. $1.2M). */
export function formatUsdCompact(value: number): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}
