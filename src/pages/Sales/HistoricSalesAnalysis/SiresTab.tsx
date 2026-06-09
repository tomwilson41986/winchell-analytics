import { useMemo, useState } from 'react'
import ChartCard from '../../../components/ChartCard'
import DataTable, { type Column } from '../../../components/DataTable'
import Icon from '../../../components/Icon'
import { BarChart } from '../../../components/charts/LazyCharts'
import { downloadCsv } from '../../../lib/csvExport'
import {
  type SaleRecord,
  type SireRow,
  pctSeries,
  pctText,
  sireLeaderboard,
} from '../../../lib/salesAnalysis'

const pct = (v: number) => `${v.toFixed(1)}%`
const pctAxis = (v: number) => `${v}%`
const intFmt = (v: number) => v.toLocaleString()

const COLUMNS: Column<SireRow>[] = [
  { key: 'sire', header: 'Sire' },
  { key: 'count', header: 'Offered', numeric: true, render: (r) => intFmt(r.count) },
  { key: 'runnersPct', header: 'Runners', numeric: true, render: (r) => pctText(r.runnersPct) },
  { key: 'winnersPct', header: 'Winners', numeric: true, render: (r) => pctText(r.winnersPct) },
  { key: 'sw', header: 'SW', numeric: true, render: (r) => intFmt(r.sw) },
  { key: 'swPct', header: 'SW %', numeric: true, render: (r) => pctText(r.swPct) },
  { key: 'gswPct', header: 'Graded SW', numeric: true, render: (r) => pctText(r.gswPct) },
  { key: 'g1wPct', header: 'G1', numeric: true, render: (r) => pctText(r.g1wPct) },
]

const MINS = [20, 30, 50, 100]

export default function SiresTab({ records }: { records: SaleRecord[] }) {
  const [minCount, setMinCount] = useState(30)

  const board = useMemo(
    () => sireLeaderboard(records, minCount),
    [records, minCount],
  )

  const topByWinner = useMemo(
    () =>
      pctSeries(
        [...board].sort((a, b) => b.winnersPct - a.winnersPct).slice(0, 12),
        'sire',
        'winnersPct',
      ),
    [board],
  )

  function exportCsv() {
    const headers = [
      'Sire', 'Offered', 'Runners', 'Winners', 'StakesWinners',
      'RunnerPct', 'WinnerPct', 'SWPct', 'GradedSWPct', 'G1Pct',
    ]
    const rows = board.map((r) => [
      r.sire, r.count, r.runners, r.winners, r.sw,
      r.runnersPct, r.winnersPct, r.swPct, r.gswPct, r.g1wPct,
    ])
    downloadCsv('winchell-sire-leaderboard.csv', headers, rows)
  }

  return (
    <>
      <p className="page__note-block">
        Per-sire sale-to-track conversion across all offered horses. Only sires with
        at least the chosen sample of offered yearlings/2yos are shown.
      </p>

      <div className="filters">
        <label className="filter">
          <span className="filter__label">Min. offered</span>
          <select
            className="filter__select"
            value={minCount}
            onChange={(e) => setMinCount(Number(e.target.value))}
          >
            {MINS.map((m) => (
              <option key={m} value={m}>
                ≥ {m}
              </option>
            ))}
          </select>
        </label>
        <span className="filter__check" style={{ paddingBottom: 0 }}>
          {board.length} sires
        </span>
        <button
          type="button"
          className="btn-export"
          onClick={exportCsv}
          disabled={board.length === 0}
          style={{ marginLeft: 'auto' }}
        >
          <Icon name="download" size={16} />
          Export CSV
        </button>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Top sires by winner rate</h2>
          <span className="section__note">Top 12 in sample</span>
        </div>
        <ChartCard title="Winner rate" subtitle="% of offered that won a race">
          <BarChart
            data={topByWinner}
            valueLabel="Winner rate"
            valueFormatter={pct}
            yTickFormatter={pctAxis}
            allowDecimals
          />
        </ChartCard>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Sire leaderboard</h2>
          <span className="section__note">Sortable · searchable</span>
        </div>
        <DataTable
          columns={COLUMNS}
          rows={board}
          searchable
          pageSize={20}
          emptyMessage="No sires meet the minimum sample."
        />
      </section>
    </>
  )
}
