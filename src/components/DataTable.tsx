import { useMemo, useState } from 'react'
import { parseNumber } from '../lib/aggregate'
import Icon from './Icon'
import './DataTable.css'

export interface Column<Row> {
  /** Key into the row object, or a unique id when using `render`. */
  key: keyof Row | string
  /** Column header text. */
  header: string
  /** Optional custom cell renderer. */
  render?: (row: Row) => React.ReactNode
  /** Right-align (use for numeric columns); also sorts numerically. */
  numeric?: boolean
}

interface DataTableProps<Row> {
  columns: Column<Row>[]
  rows: Row[]
  /** Message shown when there are no rows (e.g. placeholder data files). */
  emptyMessage?: string
  caption?: string
  /** Allow clicking headers to sort. Defaults to true. */
  sortable?: boolean
}

type SortState = { key: string; dir: 'asc' | 'desc' }

/**
 * Generic, data-driven table with click-to-sort headers and a designed empty
 * state for the placeholder data shipped with this scaffold.
 */
export default function DataTable<Row extends Record<string, unknown>>({
  columns,
  rows,
  emptyMessage = 'No data yet — add records under the matching /data folder.',
  caption,
  sortable = true,
}: DataTableProps<Row>) {
  const [sort, setSort] = useState<SortState | null>(null)

  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => String(c.key) === sort.key)
    const numeric = col?.numeric ?? false
    const dir = sort.dir === 'asc' ? 1 : -1

    return [...rows].sort((a, b) => {
      const av = a[sort.key as keyof Row]
      const bv = b[sort.key as keyof Row]
      if (numeric) {
        const an = parseNumber(av)
        const bn = parseNumber(bv)
        // Push blank/non-numeric values to the bottom regardless of direction.
        if (an == null && bn == null) return 0
        if (an == null) return 1
        if (bn == null) return -1
        return (an - bn) * dir
      }
      return (
        String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        }) * dir
      )
    })
  }, [rows, sort, columns])

  if (rows.length === 0) {
    return (
      <div className="datatable__empty">
        <span className="datatable__empty-icon">
          <Icon name="database" size={26} />
        </span>
        <p className="datatable__empty-title">Awaiting data</p>
        <p className="datatable__empty-msg">{emptyMessage}</p>
      </div>
    )
  }

  function onSort(key: string) {
    if (!sortable) return
    setSort((prev) =>
      prev && prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    )
  }

  return (
    <div className="datatable__wrap">
      <table className="datatable tnum">
        {caption ? <caption className="datatable__caption">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((col) => {
              const key = String(col.key)
              const active = sort?.key === key
              return (
                <th
                  key={key}
                  scope="col"
                  className={col.numeric ? 'is-numeric' : undefined}
                  aria-sort={
                    active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                >
                  {sortable ? (
                    <button
                      type="button"
                      className={`datatable__sort${active ? ' is-active' : ''}`}
                      onClick={() => onSort(key)}
                    >
                      {col.header}
                      <span className="datatable__sort-icon" aria-hidden="true">
                        {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  className={col.numeric ? 'is-numeric' : undefined}
                >
                  {col.render
                    ? col.render(row)
                    : String(row[col.key as keyof Row] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
