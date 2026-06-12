import { Link } from 'react-router-dom'
import ChartCard from '../../../components/ChartCard'
import DataTable, { type Column } from '../../../components/DataTable'
import Icon from '../../../components/Icon'
import PageHeader from '../../../components/PageHeader'
import StatTile from '../../../components/StatTile'
import { LineChart } from '../../../components/charts/LazyCharts'
import { averageBy, formatUsd, formatUsdCompact, sortByLabel } from '../../../lib/aggregate'
import { max, median } from '../../../lib/stats'
import { loadCsv } from '../../../lib/data'
import '../../page.css'

type Row = Record<string, string>

export default function HistoricSales() {
  const { headers, rows } = loadCsv('sales', 'sales.csv')
  const columns: Column<Row>[] = headers.map((h) => ({
    key: h,
    header: h,
    numeric: h === 'price' || h === 'year' || h === 'hip',
  }))
  const has = rows.length > 0
  const priceByYear = sortByLabel(averageBy(rows, 'year', 'price'))
  const topPrice = max(rows, 'price')
  const medianPrice = median(rows, 'price')

  return (
    <div className="page">
      <PageHeader
        eyebrow="Sales"
        title="Historic Sales"
        icon="database"
        crumbs={[
          { to: '/sales', label: 'Sales' },
          { to: '/sales/historic', label: 'Historic Sales' },
        ]}
        intro="Historic sales data and analysis — auction results, prices and buyers. Populate by adding rows to /data/sales/sales.csv."
      />

      <nav className="subnav" aria-label="Historic sales sub-sections">
        <Link to="/sales/historic-sales-analysis" className="chip">
          <Icon name="chart" size={16} />
          Historic Sales Analysis
        </Link>
      </nav>

      <section className="section" aria-label="Summary">
        <div className="stat-grid">
          <StatTile label="Sales records" value={String(rows.length)} pending={!has} />
          <StatTile
            label="Top price"
            value={topPrice != null ? formatUsdCompact(topPrice) : '—'}
            pending={topPrice == null}
          />
          <StatTile
            label="Median price"
            value={medianPrice != null ? formatUsdCompact(medianPrice) : '—'}
            pending={medianPrice == null}
          />
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
            subtitle={has ? 'Average sale price per year' : 'Connect sales data to render.'}
          >
            {has ? (
              <LineChart data={priceByYear} valueLabel="Avg price" valueFormatter={formatUsd} />
            ) : undefined}
          </ChartCard>
        </div>
      </section>
    </div>
  )
}
