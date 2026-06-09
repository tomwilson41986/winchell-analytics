import ChartCard from '../../../components/ChartCard'
import DataTable, { type Column } from '../../../components/DataTable'
import PageHeader from '../../../components/PageHeader'
import StatTile from '../../../components/StatTile'
import { BarChart } from '../../../components/charts/LazyCharts'
import { countBy } from '../../../lib/aggregate'
import { countNonEmpty, distinctCount } from '../../../lib/stats'
import { loadCsv } from '../../../lib/data'
import '../../page.css'

type Row = Record<string, string>

export default function JapanProspects() {
  const { headers, rows } = loadCsv(
    'broodmares/japan-prospects',
    'japan-prospects.csv',
  )
  const columns: Column<Row>[] = headers.map((h) => ({
    key: h,
    header: h,
    numeric: h === 'yob',
  }))
  const has = rows.length > 0
  const byCountry = countBy(rows, 'country')
  const blackType = countNonEmpty(rows, 'black_type')
  const targetSales = distinctCount(rows, 'target_sale')

  return (
    <div className="page">
      <PageHeader
        eyebrow="Broodmares"
        title="Japan Broodmare Prospects"
        icon="globe"
        crumbs={[
          { to: '/broodmares', label: 'Broodmares' },
          { to: '/broodmares/japan-prospects', label: 'Japan Prospects' },
        ]}
        intro="Prospective broodmares with Japanese pedigree or market relevance. Populate by adding rows to /data/broodmares/japan-prospects/japan-prospects.csv."
      />

      <section className="section" aria-label="Summary">
        <div className="stat-grid">
          <StatTile label="Prospects" value={String(rows.length)} pending={!has} />
          <StatTile label="Black-type" value={String(blackType)} pending={!has} />
          <StatTile label="Target sales" value={String(targetSales)} pending={!has} />
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Prospects</h2>
          <span className="section__note">
            Source: /data/broodmares/japan-prospects/japan-prospects.csv
          </span>
        </div>
        <div className="split split--data">
          <div>
            <DataTable
              columns={columns}
              rows={rows}
              emptyMessage="No prospect records yet — add rows to /data/broodmares/japan-prospects/japan-prospects.csv."
            />
            <span className="placeholder-note">
              Sample CSV is header-only — no records have been fabricated.
            </span>
          </div>
          <ChartCard
            title="Prospect comparison"
            subtitle={has ? 'Prospects by country of origin' : 'Connect prospect data to render.'}
          >
            {has ? (
              <BarChart data={byCountry} valueLabel="Prospects" valueFormatter={String} />
            ) : undefined}
          </ChartCard>
        </div>
      </section>
    </div>
  )
}
