import ChartCard from '../../components/ChartCard'
import DataTable, { type Column } from '../../components/DataTable'
import { loadCsv } from '../../lib/data'
import '../page.css'

type Row = Record<string, string>

export default function Sales() {
  const { headers, rows } = loadCsv('sales', 'sales.csv')
  const columns: Column<Row>[] = headers.map((h) => ({ key: h, header: h }))

  return (
    <div className="page">
      <header className="page__header">
        <p className="page__eyebrow">Section</p>
        <h1>Sales</h1>
        <p className="page__intro">
          Historic sales data and analysis — auction results, prices and buyers.
          Add records to <code>/data/sales/sales.csv</code> to populate the table
          below.
        </p>
      </header>

      <section className="page__section">
        <h2 className="page__section-title">Sales results</h2>
        <DataTable
          columns={columns}
          rows={rows}
          emptyMessage="No sales records yet — add rows to /data/sales/sales.csv."
        />
        <span className="placeholder-note">
          Sample CSV is header-only — no records have been fabricated.
        </span>
      </section>

      <section className="page__section">
        <h2 className="page__section-title">Charts</h2>
        <ChartCard
          title="Price trends by year"
          subtitle="Wire a chart here once sales data is loaded."
        />
      </section>
    </div>
  )
}
