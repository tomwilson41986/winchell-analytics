import ChartCard from '../../components/ChartCard'
import DataTable, { type Column } from '../../components/DataTable'
import { loadCsv } from '../../lib/data'
import '../page.css'

type Row = Record<string, string>

export default function Sires() {
  const { headers, rows } = loadCsv('sires', 'sires.csv')
  const columns: Column<Row>[] = headers.map((h) => ({ key: h, header: h }))

  return (
    <div className="page">
      <header className="page__header">
        <p className="page__eyebrow">Section</p>
        <h1>Sires</h1>
        <p className="page__intro">
          Stallion records and progeny performance. Add records to{' '}
          <code>/data/sires/sires.csv</code> to populate the table below.
        </p>
      </header>

      <section className="page__section">
        <h2 className="page__section-title">Stallions</h2>
        <DataTable
          columns={columns}
          rows={rows}
          emptyMessage="No sire records yet — add rows to /data/sires/sires.csv."
        />
        <span className="placeholder-note">
          Sample CSV is header-only — no records have been fabricated.
        </span>
      </section>

      <section className="page__section">
        <h2 className="page__section-title">Charts</h2>
        <ChartCard
          title="Progeny earnings"
          subtitle="Wire a chart here once sire data is loaded."
        />
      </section>
    </div>
  )
}
