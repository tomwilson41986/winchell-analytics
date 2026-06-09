import './DataTable.css'

export interface Column<Row> {
  /** Key into the row object, or a unique id when using `render`. */
  key: keyof Row | string
  /** Column header text. */
  header: string
  /** Optional custom cell renderer. */
  render?: (row: Row) => React.ReactNode
}

interface DataTableProps<Row> {
  columns: Column<Row>[]
  rows: Row[]
  /** Message shown when there are no rows (e.g. placeholder data files). */
  emptyMessage?: string
  caption?: string
}

/**
 * Generic, data-driven table. Pass column definitions and an array of rows;
 * renders an empty state when no rows are supplied (the default for the
 * placeholder data shipped with this scaffold).
 */
export default function DataTable<Row extends Record<string, unknown>>({
  columns,
  rows,
  emptyMessage = 'No data yet — add records under the matching /data folder.',
  caption,
}: DataTableProps<Row>) {
  if (rows.length === 0) {
    return <div className="datatable__empty">{emptyMessage}</div>
  }

  return (
    <div className="datatable__wrap">
      <table className="datatable">
        {caption ? <caption className="datatable__caption">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={String(col.key)}>
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
