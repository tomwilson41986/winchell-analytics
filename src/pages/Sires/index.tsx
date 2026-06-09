import ChartCard from '../../components/ChartCard'
import DataTable, { type Column } from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import StatTile from '../../components/StatTile'
import { BarChart } from '../../components/charts/LazyCharts'
import { formatUsd, formatUsdCompact, sumBy, topN } from '../../lib/aggregate'
import { sum } from '../../lib/stats'
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
  const earningsBySire = topN(sumBy(rows, 'name', 'progeny_earnings'), 8)
  const stakesWinners = sum(rows, 'stakes_winners')
  const totalEarnings = sum(rows, 'progeny_earnings')

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
          <StatTile label="Stakes winners" value={String(stakesWinners)} pending={!has} />
          <StatTile
            label="Progeny earnings"
            value={has ? formatUsdCompact(totalEarnings) : '—'}
            pending={!has}
          />
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
            subtitle={has ? 'Top sires by total progeny earnings' : 'Connect sire data to render.'}
          >
            {has ? (
              <BarChart data={earningsBySire} valueLabel="Earnings" valueFormatter={formatUsd} />
            ) : undefined}
          </ChartCard>
        </div>
      </section>
    </div>
  )
}
