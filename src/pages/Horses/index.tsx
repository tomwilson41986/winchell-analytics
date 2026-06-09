import ChartCard from '../../components/ChartCard'
import DataTable, { type Column } from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import StatTile from '../../components/StatTile'
import { loadCsv } from '../../lib/data'
import '../page.css'

type Row = Record<string, string>

export default function Horses() {
  const { headers, rows } = loadCsv('horses', 'horses.csv')
  const columns: Column<Row>[] = headers.map((h) => ({ key: h, header: h }))
  const has = rows.length > 0

  return (
    <div className="page">
      <PageHeader
        eyebrow="Section"
        title="Horses"
        icon="horseshoe"
        intro="Horse profiles, connections and performance data for the Winchell string. Populate the roster by adding rows to /data/horses/horses.csv."
      />

      <section className="section" aria-label="Summary">
        <div className="stat-grid">
          <StatTile label="Horses" value={String(rows.length)} pending={!has} />
          <StatTile label="Fields tracked" value={String(headers.length)} />
          <StatTile label="In training" value="—" pending hint="Derived once data loads" />
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Roster</h2>
          <span className="section__note">Source: /data/horses/horses.csv</span>
        </div>
        <div className="split split--data">
          <div>
            <DataTable
              columns={columns}
              rows={rows}
              emptyMessage="No horse records yet — add rows to /data/horses/horses.csv."
            />
            <span className="placeholder-note">
              Sample CSV is header-only — no records have been fabricated.
            </span>
          </div>
          <ChartCard
            title="Performance over time"
            subtitle="Connect race results to render."
          />
        </div>
      </section>
    </div>
  )
}
