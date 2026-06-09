import { useMemo } from 'react'
import ChartCard from '../../../components/ChartCard'
import DataTable from '../../../components/DataTable'
import { BarChart } from '../../../components/charts/LazyCharts'
import { type AnalysisTables, pctSeries } from '../../../lib/salesAnalysis'
import { FACTOR_COLUMNS } from './analysisColumns'

const pct = (v: number) => `${v.toFixed(1)}%`
const pctAxis = (v: number) => `${v}%`

/** Selection-factor conversion (Summary sheet — biomechanic-rated subset). */
export default function FactorsTab({ tables }: { tables: AnalysisTables }) {
  const rows = tables.factors
  // Skip the OVERALL baseline row in the chart; compare selection factors.
  const winnerSeries = useMemo(
    () =>
      pctSeries(
        rows
          .filter((r) => r.factor !== 'OVERALL')
          .map((r) => ({ label: `${r.factor}: ${r.value}`, winnersPct: r.winnersPct })),
        'label',
        'winnersPct',
      ),
    [rows],
  )

  return (
    <>
      <p className="page__note-block">
        Based on the <strong>748 biomechanic-rated</strong> Winchell-relevant horses.
        Compares selection signals (Steve / EA) against track outcomes.
      </p>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Winner rate by selection factor</h2>
          <span className="section__note">Excludes the overall baseline</span>
        </div>
        <ChartCard title="Winner rate" subtitle="% of group that won a race">
          <BarChart
            data={winnerSeries}
            valueLabel="Winner rate"
            valueFormatter={pct}
            yTickFormatter={pctAxis}
            allowDecimals
          />
        </ChartCard>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Selection factors</h2>
          <span className="section__note">Source sheet: Summary</span>
        </div>
        <DataTable
          columns={FACTOR_COLUMNS}
          rows={rows}
          exportFilename="winchell-selection-factors.csv"
        />
      </section>
    </>
  )
}
