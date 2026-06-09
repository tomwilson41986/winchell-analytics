import { useEffect, useMemo, useState } from 'react'
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
  /** Show a search box that filters across the displayed columns. */
  searchable?: boolean
  /** Paginate to this many rows per page (omit for no pagination). */
  pageSize?: number
}

type SortState = { key: string; dir: 'asc' | 'desc' }

/**
 * Generic, data-driven table: click-to-sort headers, optional full-text search
 * and pagination, and a designed empty state. Pipeline is search → sort →
 * paginate, so large datasets stay responsive.
 */
export default function DataTable<Row extends object>({
  columns,
  rows,
  emptyMessage = 'No data yet — add records under the matching /data folder.',
  caption,
  sortable = true,
  searchable = false,
  pageSize,
}: DataTableProps<Row>) {
  const [sort, setSort] = useState<SortState | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      columns.some((col) =>
        String(row[col.key as keyof Row] ?? '')
          .toLowerCase()
          .includes(q),
      ),
    )
  }, [rows, query, columns])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const col = columns.find((c) => String(c.key) === sort.key)
    const numeric = col?.numeric ?? false
    const dir = sort.dir === 'asc' ? 1 : -1

    return [...filtered].sort((a, b) => {
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
  }, [filtered, sort, columns])

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  const safePage = Math.min(page, pageCount - 1)
  const visible = pageSize
    ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)
    : sorted

  // Reset to the first page whenever the result set changes.
  useEffect(() => setPage(0), [query, sort])

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

  const start = pageSize ? safePage * pageSize : 0
  const end = pageSize ? start + visible.length : sorted.length

  return (
    <div>
      {searchable ? (
        <div className="datatable__toolbar">
          <div className="datatable__search">
            <Icon name="search" size={16} className="datatable__search-icon" />
            <input
              type="search"
              className="datatable__search-input"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search table"
            />
          </div>
          <span className="datatable__count tnum">
            {sorted.length.toLocaleString()}
            {sorted.length !== rows.length ? ` of ${rows.length.toLocaleString()}` : ''}{' '}
            rows
          </span>
        </div>
      ) : null}

      <div className="datatable__wrap">
        <table className="datatable tnum">
          {caption ? (
            <caption className="datatable__caption">{caption}</caption>
          ) : null}
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
                      active
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
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
            {visible.length === 0 ? (
              <tr>
                <td className="datatable__nomatch" colSpan={columns.length}>
                  No rows match “{query}”.
                </td>
              </tr>
            ) : (
              visible.map((row, i) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageSize && sorted.length > pageSize ? (
        <div className="datatable__pager">
          <span className="datatable__pager-info tnum">
            {(start + 1).toLocaleString()}–{end.toLocaleString()} of{' '}
            {sorted.length.toLocaleString()}
          </span>
          <div className="datatable__pager-controls">
            <button
              type="button"
              className="datatable__pager-btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              ← Prev
            </button>
            <span className="datatable__pager-page tnum">
              {safePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              className="datatable__pager-btn"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
