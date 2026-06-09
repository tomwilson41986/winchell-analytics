import ChartCard from '../../components/ChartCard'
import DataTable, { type Column } from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import StatTile from '../../components/StatTile'
import { loadCsv } from '../../lib/data'
import '../page.css'

type Row = Record<string, string>

export default function Sires() {
  const { headers, rows } = loadCsv('sires', 'sires.csv')
  const columns: Column<Row>[] = headers.map((h) => ({
    key: h,
    header: h,
    numeric: ['yob', 'stud_fee', 'runners', 'winners', 'stakes_winners', 'progeny_earnings'].includes(h),
  }))
  const has = rows.length > 0

  return (
    <div className="page">
      <PageHeader
        eyebrow="Section"
        title="Sires"
        icon="crown"
        intro="Stallion records and progeny performance. Populate by adding rows to /data/sires/sires.csv."
      />

      <section className="section" aria-label="Summary">
        <div className="stat-grid">
          <StatTile label="Sires" value={String(rows.length)} pending={!has} />
          <StatTile label="Stakes winners" value="—" pending hint="Derived once data loads" />
          <StatTile label="Progeny earnings" value="—" pending hint="Derived once data loads" />
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Stallions</h2>
          <span className="section__note">Source: /data/sires/sires.csv</span>
        </div>
        <div className="split split--data">
          <div>
            <DataTable
              columns={columns}
              rows={rows}
              emptyMessage="No sire records yet — add rows to /data/sires/sires.csv."
            />
            <span className="placeholder-note">
              Sample CSV is header-only — no records have been fabricated.
            </span>
          </div>
          <ChartCard
            title="Progeny earnings"
            subtitle="Connect sire data to render."
          />
        </div>
      </section>
    </div>
  )
}
