import { useMemo, useState } from 'react'
import ChartCard from '../../../components/ChartCard'
import DataTable from '../../../components/DataTable'
import { BarChart } from '../../../components/charts/LazyCharts'
import { type AnalysisTables, pctSeries } from '../../../lib/salesAnalysis'
import { FACTOR_COLUMNS } from './analysisColumns'

const pct = (v: number) => `${v.toFixed(1)}%`
const pctAxis = (v: number) => `${v}%`

/** Deep-dive into the per-factor EA Per Rated sheet (52 factors). */
export default function EaPerRatedTab({ tables }: { tables: AnalysisTables }) {
  const rows = tables.eaPerRated

  const factors = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.factor !== 'OVERALL') set.add(r.factor)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const [factor, setFactor] = useState('EA Rating')

  const factorRows = useMemo(
    () => rows.filter((r) => r.factor === factor),
    [rows, factor],
  )
  const winnerSeries = useMemo(
    () => pctSeries(factorRows, 'value', 'winnersPct'),
    [factorRows],
  )
  const swSeries = useMemo(() => pctSeries(factorRows, 'value', 'swPct'), [factorRows])

  return (
    <>
      <p className="page__note-block">
        Outcome rates for every EA / FotoSelect / cardio / conformation factor, over the{' '}
        <strong>748 biomechanic-rated</strong> subset. Pick a factor to compare its
        values; small samples are directional.
      </p>

      <div className="filters">
        <label className="filter">
          <span className="filter__label">Factor</span>
          <select
            className="filter__select"
            style={{ minWidth: '16rem' }}
            value={factor}
            onChange={(e) => setFactor(e.target.value)}
          >
            {factors.map((fct) => (
              <option key={fct} value={fct}>
                {fct}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">{factor}</h2>
          <span className="section__note">Outcome rate by value</span>
        </div>
        <div className="chart-grid chart-grid--2">
          <ChartCard title="Winner rate" subtitle="% that won a race">
            <BarChart
              data={winnerSeries}
              valueLabel="Winner rate"
              valueFormatter={pct}
              yTickFormatter={pctAxis}
              allowDecimals
            />
          </ChartCard>
          <ChartCard title="Stakes-winner rate" subtitle="% that won a stakes">
            <BarChart
              data={swSeries}
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
          <h2 className="section__title">All factors</h2>
          <span className="section__note">Source sheet: EA Per Rated</span>
        </div>
        <DataTable columns={FACTOR_COLUMNS} rows={rows} searchable pageSize={20} />
      </section>
    </>
  )
}
