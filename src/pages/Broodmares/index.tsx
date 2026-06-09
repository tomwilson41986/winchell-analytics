import { Link } from 'react-router-dom'
import ChartCard from '../../components/ChartCard'
import DataTable, { type Column } from '../../components/DataTable'
import { loadCsv } from '../../lib/data'
import '../page.css'

type Row = Record<string, string>

export default function Broodmares() {
  const { headers, rows } = loadCsv('broodmares', 'broodmares.csv')
  const columns: Column<Row>[] = headers.map((h) => ({ key: h, header: h }))

  return (
    <div className="page">
      <header className="page__header">
        <p className="page__eyebrow">Section</p>
        <h1>Broodmares</h1>
        <p className="page__intro">
          Mare records, produce history and prospects. Add records to{' '}
          <code>/data/broodmares/broodmares.csv</code> to populate the table
          below.
        </p>
      </header>

      <nav className="subnav" aria-label="Broodmares sub-sections">
        <Link to="/broodmares/japan-prospects">Japan Broodmare Prospects →</Link>
      </nav>

      <section className="page__section">
        <h2 className="page__section-title">Broodmare band</h2>
        <DataTable
          columns={columns}
          rows={rows}
          emptyMessage="No broodmare records yet — add rows to /data/broodmares/broodmares.csv."
        />
        <span className="placeholder-note">
          Sample CSV is header-only — no records have been fabricated.
        </span>
      </section>

      <section className="page__section">
        <h2 className="page__section-title">Charts</h2>
        <ChartCard
          title="Produce record"
          subtitle="Wire a chart here once broodmare data is loaded."
        />
      </section>
    </div>
  )
}
