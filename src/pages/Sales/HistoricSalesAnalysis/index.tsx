import { useEffect, useMemo, useState } from 'react'
import ChartCard from '../../../components/ChartCard'
import DataTable, { type Column } from '../../../components/DataTable'
import PageHeader from '../../../components/PageHeader'
import StatTile from '../../../components/StatTile'
import { BarChart } from '../../../components/charts/LazyCharts'
import { fetchJson } from '../../../lib/fetchData'
import {
  DATA_PATH,
  type SaleRecord,
  distinctValues,
  funnel,
  funnelChart,
  rateByField,
  rateByRatingBand,
} from '../../../lib/salesAnalysis'
import '../../page.css'

const pct = (v: number) => `${v.toFixed(1)}%`
const pctAxis = (v: number) => `${v}%`
const intFmt = (v: number) => v.toLocaleString()

const check = (r: SaleRecord, k: keyof SaleRecord) => (r[k] ? '✓' : '')

const COLUMNS: Column<SaleRecord>[] = [
  { key: 'year', header: 'Year', numeric: true },
  { key: 'sale', header: 'Sale' },
  { key: 'hip', header: 'Hip', numeric: true },
  { key: 'name', header: 'Name' },
  { key: 'sire', header: 'Sire' },
  { key: 'dam', header: 'Dam' },
  {
    key: 'rating',
    header: 'R2 Bio',
    numeric: true,
    render: (r) => (r.rating == null ? '—' : r.rating.toFixed(1)),
  },
  { key: 'grade', header: 'Grade' },
  { key: 'runner', header: 'Ran', numeric: true, render: (r) => check(r, 'runner') },
  { key: 'winner', header: 'Won', numeric: true, render: (r) => check(r, 'winner') },
  { key: 'sw', header: 'SW', numeric: true, render: (r) => check(r, 'sw') },
  { key: 'gsw', header: 'GSW', numeric: true, render: (r) => check(r, 'gsw') },
  { key: 'g1w', header: 'G1', numeric: true, render: (r) => check(r, 'g1w') },
]

export default function HistoricSalesAnalysis() {
  const [records, setRecords] = useState<SaleRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [year, setYear] = useState('all')
  const [sale, setSale] = useState('all')
  const [gradeAOnly, setGradeAOnly] = useState(false)

  useEffect(() => {
    let active = true
    fetchJson<SaleRecord[]>(DATA_PATH)
      .then((data) => active && setRecords(data))
      .catch((e) => active && setError(String(e.message ?? e)))
    return () => {
      active = false
    }
  }, [])

  const years = useMemo(
    () => (records ? distinctValues(records, 'year') : []),
    [records],
  )
  const sales = useMemo(
    () => (records ? distinctValues(records, 'sale') : []),
    [records],
  )

  const filtered = useMemo(() => {
    if (!records) return []
    return records.filter(
      (r) =>
        (year === 'all' || String(r.year) === year) &&
        (sale === 'all' || r.sale === sale) &&
        (!gradeAOnly || r.grade === 'A'),
    )
  }, [records, year, sale, gradeAOnly])

  const f = useMemo(() => funnel(filtered), [filtered])
  const funnelData = useMemo(() => funnelChart(filtered), [filtered])
  const winnerByBand = useMemo(() => rateByRatingBand(filtered, 'winner'), [filtered])
  const swByBand = useMemo(() => rateByRatingBand(filtered, 'sw'), [filtered])
  const winnerBySale = useMemo(
    () => rateByField(filtered, 'sale', 'winner', 8),
    [filtered],
  )

  const has = filtered.length > 0
  const step = (k: string) => f.steps.find((s) => s.key === k)

  function reset() {
    setYear('all')
    setSale('all')
    setGradeAOnly(false)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Sales"
        title="Historic Sales Analysis"
        icon="chart"
        crumbs={[
          { to: '/sales', label: 'Sales' },
          { to: '/sales/historic-sales-analysis', label: 'Historic Sales Analysis' },
        ]}
        intro="Sale-to-track outcomes for offered yearlings and 2yos — biomechanic (R2 Bio) ratings against runner, winner and stakes results. Filter by year, sale and grade to explore conversion."
      />

      {error ? (
        <div className="async async--error">
          <strong>Couldn’t load the dataset.</strong>
          <span>{error}</span>
        </div>
      ) : !records ? (
        <div className="async">
          <span className="spinner" />
          <span>Loading sales records…</span>
        </div>
      ) : (
        <>
          <div className="filters">
            <label className="filter">
              <span className="filter__label">Year</span>
              <select
                className="filter__select"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                <option value="all">All years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter">
              <span className="filter__label">Sale</span>
              <select
                className="filter__select"
                value={sale}
                onChange={(e) => setSale(e.target.value)}
              >
                <option value="all">All sales</option>
                {sales.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter__check">
              <input
                type="checkbox"
                checked={gradeAOnly}
                onChange={(e) => setGradeAOnly(e.target.checked)}
              />
              Grade A only
            </label>

            <button type="button" className="filters__reset" onClick={reset}>
              Reset
            </button>
          </div>

          <section className="section" aria-label="Conversion summary">
            <div className="stat-grid">
              <StatTile label="Offered" value={intFmt(f.offered)} pending={!has} />
              <StatTile
                label="Runners"
                value={has ? pct(step('runner')!.pct * 100) : '—'}
                hint={has ? `${intFmt(step('runner')!.count)} horses` : undefined}
                pending={!has}
              />
              <StatTile
                label="Winners"
                value={has ? pct(step('winner')!.pct * 100) : '—'}
                hint={has ? `${intFmt(step('winner')!.count)} horses` : undefined}
                pending={!has}
              />
              <StatTile
                label="Stakes Winners"
                value={has ? pct(step('sw')!.pct * 100) : '—'}
                hint={has ? `${intFmt(step('sw')!.count)} horses` : undefined}
                pending={!has}
              />
              <StatTile
                label="Graded SW"
                value={has ? pct(step('gsw')!.pct * 100) : '—'}
                hint={has ? `${intFmt(step('gsw')!.count)} horses` : undefined}
                pending={!has}
              />
              <StatTile
                label="Grade 1 Winners"
                value={has ? pct(step('g1w')!.pct * 100) : '—'}
                hint={has ? `${intFmt(step('g1w')!.count)} horses` : undefined}
                pending={!has}
              />
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Conversion funnel</h2>
              <span className="section__note">
                {intFmt(filtered.length)} records in view
              </span>
            </div>
            <ChartCard
              title="Offered → track outcomes"
              subtitle="Headcount at each stage"
            >
              {has ? (
                <BarChart data={funnelData} valueLabel="Horses" valueFormatter={intFmt} />
              ) : undefined}
            </ChartCard>
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Outcome rate by R2 Bio rating band</h2>
              <span className="section__note">Rated horses only</span>
            </div>
            <div className="chart-grid chart-grid--2">
              <ChartCard title="Winner rate" subtitle="% of band that won a race">
                {has ? (
                  <BarChart
                    data={winnerByBand}
                    valueLabel="Winner rate"
                    valueFormatter={pct}
                    yTickFormatter={pctAxis}
                    allowDecimals
                  />
                ) : undefined}
              </ChartCard>
              <ChartCard title="Stakes-winner rate" subtitle="% of band that won a stakes">
                {has ? (
                  <BarChart
                    data={swByBand}
                    valueLabel="Stakes rate"
                    valueFormatter={pct}
                    yTickFormatter={pctAxis}
                    allowDecimals
                  />
                ) : undefined}
              </ChartCard>
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Winner rate by sale</h2>
              <span className="section__note">Top sales by volume</span>
            </div>
            <ChartCard title="Winner rate by sale" subtitle="% of offered that won a race">
              {has ? (
                <BarChart
                  data={winnerBySale}
                  valueLabel="Winner rate"
                  valueFormatter={pct}
                  yTickFormatter={pctAxis}
                  allowDecimals
                />
              ) : undefined}
            </ChartCard>
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Records</h2>
              <span className="section__note">
                Source: data/sales/historic-sales-analysis
              </span>
            </div>
            <DataTable
              columns={COLUMNS}
              rows={filtered}
              searchable
              pageSize={25}
              emptyMessage="No records match the current filters."
            />
          </section>
        </>
      )}
    </div>
  )
}
