import ChartCard from '../../components/ChartCard'
import DataTable, { type Column } from '../../components/DataTable'
import { loadCsv } from '../../lib/data'
import '../page.css'

type Row = Record<string, string>

export default function Horses() {
  const { headers, rows } = loadCsv('horses', 'horses.csv')
  const columns: Column<Row>[] = headers.map((h) => ({ key: h, header: h }))

  return (
    <div className="page">
      <header className="page__header">
        <p className="page__eyebrow">Section</p>
        <h1>Horses</h1>
        <p className="page__intro">
          Horse profiles, connections and performance data for the Winchell
          string. Add records to <code>/data/horses/horses.csv</code> to populate
          the table below.
        </p>
      </header>

      <section className="page__section">
        <h2 className="page__section-title">Roster</h2>
        <DataTable
          columns={columns}
          rows={rows}
          emptyMessage="No horse records yet — add rows to /data/horses/horses.csv."
        />
        <span className="placeholder-note">
          Sample CSV is header-only — no records have been fabricated.
        </span>
      </section>

      <section className="page__section">
        <h2 className="page__section-title">Charts</h2>
        <ChartCard
          title="Performance over time"
          subtitle="Wire a chart here once horse data is loaded."
        />
      </section>
    </div>
  )
}
