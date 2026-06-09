import { parseNumber } from './aggregate'

type Row = Record<string, string>

/** Numeric values from a column, dropping blanks/non-numeric cells. */
export function numericValues(rows: Row[], key: string): number[] {
  const out: number[] = []
  for (const row of rows) {
    const n = parseNumber(row[key])
    if (n != null) out.push(n)
  }
  return out
}

/** Sum of a numeric column. */
export function sum(rows: Row[], key: string): number {
  return numericValues(rows, key).reduce((a, b) => a + b, 0)
}

/** Maximum of a numeric column, or null when none. */
export function max(rows: Row[], key: string): number | null {
  const v = numericValues(rows, key)
  return v.length ? Math.max(...v) : null
}

/** Median of a numeric column, or null when none. */
export function median(rows: Row[], key: string): number | null {
  const v = numericValues(rows, key).sort((a, b) => a - b)
  if (v.length === 0) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

/** Count of rows matching a predicate. */
export function countWhere(rows: Row[], pred: (row: Row) => boolean): number {
  return rows.reduce((n, row) => (pred(row) ? n + 1 : n), 0)
}

/** Count of distinct, non-empty values in a column. */
export function distinctCount(rows: Row[], key: string): number {
  const set = new Set<string>()
  for (const row of rows) {
    const v = (row[key] ?? '').trim()
    if (v) set.add(v.toLowerCase())
  }
  return set.size
}

/** Count of rows whose column value is non-empty. */
export function countNonEmpty(rows: Row[], key: string): number {
  return countWhere(rows, (r) => (r[key] ?? '').trim() !== '')
}
