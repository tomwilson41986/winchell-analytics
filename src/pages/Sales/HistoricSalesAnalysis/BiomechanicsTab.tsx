import { useMemo } from 'react'
import ChartCard from '../../../components/ChartCard'
import DataTable from '../../../components/DataTable'
import { BarChart } from '../../../components/charts/LazyCharts'
import { type AnalysisTables, pctSeries } from '../../../lib/salesAnalysis'
import { BAND_COLUMNS } from './analysisColumns'

const pct = (v: number) => `${v.toFixed(1)}%`
const pctAxis = (v: number) => `${v}%`

/** R2 Bio / Breeze rating thresholds and the Winchell shortlist. */
export default function BiomechanicsTab({ tables }: { tables: AnalysisTables }) {
  const bioWinner = useMemo(
    () => pctSeries(tables.r2Bio, 'band', 'winnersPct'),
    [tables.r2Bio],
  )
  const bioSw = useMemo(() => pctSeries(tables.r2Bio, 'band', 'swPct'), [tables.r2Bio])

  return (
    <>
      <p className="page__note-block">
        R2 biomechanic and breeze ratings as cumulative thresholds, across all rated
        horses, plus the Winchell shortlist subset.
      </p>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Outcome rate by R2 Bio threshold</h2>
          <span className="section__note">Cumulative thresholds</span>
        </div>
        <div className="chart-grid chart-grid--2">
          <ChartCard title="Winner rate" subtitle="% that won a race">
            <BarChart
              data={bioWinner}
              valueLabel="Winner rate"
              valueFormatter={pct}
              yTickFormatter={pctAxis}
              allowDecimals
            />
          </ChartCard>
          <ChartCard title="Stakes-winner rate" subtitle="% that won a stakes">
            <BarChart
              data={bioSw}
              valueLabel="Stakes rate"
              valueFormatter={pct}
              yTickFormatter={pctAxis}
              allowDecimals
            />
          </ChartCard>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">R2 Bio rating</h2>
          <span className="section__note">All rated horses</span>
        </div>
        <DataTable columns={BAND_COLUMNS} rows={tables.r2Bio} sortable={false} />
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">R2 Breeze rating</h2>
          <span className="section__note">Breeze-rated horses</span>
        </div>
        <DataTable columns={BAND_COLUMNS} rows={tables.r2Breeze} sortable={false} />
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Winchell shortlist + R2</h2>
          <span className="section__note">Bio &amp; breeze, shortlist subset</span>
        </div>
        <div className="chart-grid chart-grid--2">
          <div>
            <h3 className="section__subtitle">Biomechanic rating</h3>
            <DataTable columns={BAND_COLUMNS} rows={tables.shortlistBio} sortable={false} />
          </div>
          <div>
            <h3 className="section__subtitle">Breeze rating</h3>
            <DataTable
              columns={BAND_COLUMNS}
              rows={tables.shortlistBreeze}
              sortable={false}
            />
          </div>
        </div>
      </section>
    </>
  )
}
