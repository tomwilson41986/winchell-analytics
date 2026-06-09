import ChartCard from '../../components/ChartCard'
import DataTable, { type Column } from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import StatTile from '../../components/StatTile'
import { loadCsv } from '../../lib/data'
import '../page.css'

type Row = Record<string, string>

export default function Sales() {
  const { headers, rows } = loadCsv('sales', 'sales.csv')
  const columns: Column<Row>[] = headers.map((h) => ({
    key: h,
    header: h,
    numeric: h === 'price' || h === 'year' || h === 'hip',
  }))
  const has = rows.length > 0

  return (
    <div className="page">
      <PageHeader
        eyebrow="Section"
        title="Sales"
        icon="tag"
        intro="Historic sales data and analysis — auction results, prices and buyers. Populate by adding rows to /data/sales/sales.csv."
      />

      <section className="section" aria-label="Summary">
        <div className="stat-grid">
          <StatTile label="Sales records" value={String(rows.length)} pending={!has} />
          <StatTile label="Top price" value="—" pending hint="Derived once data loads" />
          <StatTile label="Median price" value="—" pending hint="Derived once data loads" />
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Sales results</h2>
          <span className="section__note">Source: /data/sales/sales.csv</span>
        </div>
        <div className="split split--data">
          <div>
            <DataTable
              columns={columns}
              rows={rows}
              emptyMessage="No sales records yet — add rows to /data/sales/sales.csv."
            />
            <span className="placeholder-note">
              Sample CSV is header-only — no records have been fabricated.
            </span>
          </div>
          <ChartCard
            title="Price trends by year"
            subtitle="Connect sales data to render."
          />
        </div>
      </section>
    </div>
  )
}
