import { Link } from 'react-router-dom'
import ChartCard from '../../../components/ChartCard'
import DataTable, { type Column } from '../../../components/DataTable'
import { loadCsv } from '../../../lib/data'
import '../../page.css'

type Row = Record<string, string>

export default function JapanProspects() {
  const { headers, rows } = loadCsv(
    'broodmares/japan-prospects',
    'japan-prospects.csv',
  )
  const columns: Column<Row>[] = headers.map((h) => ({ key: h, header: h }))

  return (
    <div className="page">
      <header className="page__header">
        <p className="page__eyebrow">Broodmares</p>
        <h1>Japan Broodmare Prospects</h1>
        <p className="page__intro">
          Prospective broodmares with Japanese pedigree or market relevance. Add
          records to{' '}
          <code>/data/broodmares/japan-prospects/japan-prospects.csv</code> to
          populate the table below.
        </p>
      </header>

      <nav className="subnav" aria-label="Broodmares breadcrumb">
        <Link to="/broodmares">← Back to Broodmares</Link>
      </nav>

      <section className="page__section">
        <h2 className="page__section-title">Prospects</h2>
        <DataTable
          columns={columns}
          rows={rows}
          emptyMessage="No prospect records yet — add rows to /data/broodmares/japan-prospects/japan-prospects.csv."
        />
        <span className="placeholder-note">
          Sample CSV is header-only — no records have been fabricated.
        </span>
      </section>

      <section className="page__section">
        <h2 className="page__section-title">Charts</h2>
        <ChartCard
          title="Prospect comparison"
          subtitle="Wire a chart here once prospect data is loaded."
        />
      </section>
    </div>
  )
}
