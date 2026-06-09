import { Link } from 'react-router-dom'
import ChartCard from '../../components/ChartCard'
import DataTable, { type Column } from '../../components/DataTable'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import StatTile from '../../components/StatTile'
import { loadCsv } from '../../lib/data'
import '../page.css'

type Row = Record<string, string>

export default function Broodmares() {
  const { headers, rows } = loadCsv('broodmares', 'broodmares.csv')
  const columns: Column<Row>[] = headers.map((h) => ({
    key: h,
    header: h,
    numeric: ['yob', 'foals', 'winners', 'stakes_winners'].includes(h),
  }))
  const has = rows.length > 0

  return (
    <div className="page">
      <PageHeader
        eyebrow="Section"
        title="Broodmares"
        icon="pedigree"
        intro="Mare records, produce history and prospects. Populate by adding rows to /data/broodmares/broodmares.csv."
      />

      <nav className="subnav" aria-label="Broodmares sub-sections">
        <Link to="/broodmares/japan-prospects" className="chip">
          <Icon name="globe" size={16} />
          Japan Broodmare Prospects
        </Link>
      </nav>

      <section className="section" aria-label="Summary">
        <div className="stat-grid">
          <StatTile label="Broodmares" value={String(rows.length)} pending={!has} />
          <StatTile label="Foals recorded" value="—" pending hint="Derived once data loads" />
          <StatTile label="Stakes producers" value="—" pending hint="Derived once data loads" />
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Broodmare band</h2>
          <span className="section__note">Source: /data/broodmares/broodmares.csv</span>
        </div>
        <div className="split split--data">
          <div>
            <DataTable
              columns={columns}
              rows={rows}
              emptyMessage="No broodmare records yet — add rows to /data/broodmares/broodmares.csv."
            />
            <span className="placeholder-note">
              Sample CSV is header-only — no records have been fabricated.
            </span>
          </div>
          <ChartCard
            title="Produce record"
            subtitle="Connect broodmare data to render."
          />
        </div>
      </section>
    </div>
  )
}
