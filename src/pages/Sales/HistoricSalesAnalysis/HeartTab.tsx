import { useMemo } from 'react'
import ChartCard from '../../../components/ChartCard'
import DataTable from '../../../components/DataTable'
import { BarChart } from '../../../components/charts/LazyCharts'
import { type AnalysisTables, pctSeries } from '../../../lib/salesAnalysis'
import { FACTOR_COLUMNS } from './analysisColumns'

const pct = (v: number) => `${v.toFixed(1)}%`
const pctAxis = (v: number) => `${v}%`

/** Heart-scan factors vs outcomes (Heart Data sheet — rated subset). */
export default function HeartTab({ tables }: { tables: AnalysisTables }) {
  const rows = tables.heart

  const strengthSeries = useMemo(
    () =>
      pctSeries(
        rows.filter((r) => r.factor === 'Heart Strength'),
        'value',
        'winnersPct',
      ),
    [rows],
  )

  return (
    <>
      <p className="page__note-block">
        Heart-scan attributes against track outcomes, for the{' '}
        <strong>748 biomechanic-rated</strong> subset. Small samples per category —
        read as directional.
      </p>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Winner rate by heart strength</h2>
        </div>
        <ChartCard title="Winner rate" subtitle="% that won a race, by heart strength">
          <BarChart
            data={strengthSeries}
            valueLabel="Winner rate"
            valueFormatter={pct}
            yTickFormatter={pctAxis}
            allowDecimals
          />
        </ChartCard>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Heart factors</h2>
          <span className="section__note">Source sheet: Heart Data</span>
        </div>
        <DataTable
          columns={FACTOR_COLUMNS}
          rows={rows}
          pageSize={15}
          exportFilename="winchell-heart-factors.csv"
        />
      </section>
    </>
  )
}
