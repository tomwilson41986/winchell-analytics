import { useMemo, useState } from 'react'
import ChartCard from '../../../components/ChartCard'
import DataTable, { type Column } from '../../../components/DataTable'
import Modal from '../../../components/Modal'
import { BarChart } from '../../../components/charts/LazyCharts'
import {
  type LeaderRow,
  type SaleRecord,
  fieldLeaderboard,
  pctSeries,
  pctText,
} from '../../../lib/salesAnalysis'
import EntityDetail from './EntityDetail'

const pct = (v: number) => `${v.toFixed(1)}%`
const pctAxis = (v: number) => `${v}%`
const intFmt = (v: number) => v.toLocaleString()

const MINS = [20, 30, 50, 100]

interface Props {
  records: SaleRecord[]
  field: 'sire' | 'consignor'
  /** Singular noun for the grouped entity, e.g. "Sire". */
  noun: string
  /** Plural lower-case noun, e.g. "sires". */
  nounPlural: string
  filename: string
}

export default function LeaderboardTab({
  records,
  field,
  noun,
  nounPlural,
  filename,
}: Props) {
  const [minCount, setMinCount] = useState(30)
  const [selected, setSelected] = useState<LeaderRow | null>(null)

  const selectedRecords = useMemo(
    () => (selected ? records.filter((r) => r[field] === selected.name) : []),
    [records, field, selected],
  )

  const board = useMemo(
    () => fieldLeaderboard(records, field, minCount),
    [records, field, minCount],
  )

  const topByWinner = useMemo(
    () =>
      pctSeries(
        [...board].sort((a, b) => b.winnersPct - a.winnersPct).slice(0, 12),
        'name',
        'winnersPct',
      ),
    [board],
  )

  const columns: Column<LeaderRow>[] = [
    { key: 'name', header: noun },
    { key: 'count', header: 'Offered', numeric: true, render: (r) => intFmt(r.count) },
    { key: 'runnersPct', header: 'Runners', numeric: true, render: (r) => pctText(r.runnersPct) },
    { key: 'winnersPct', header: 'Winners', numeric: true, render: (r) => pctText(r.winnersPct) },
    { key: 'sw', header: 'SW', numeric: true, render: (r) => intFmt(r.sw) },
    { key: 'swPct', header: 'SW %', numeric: true, render: (r) => pctText(r.swPct) },
    { key: 'gswPct', header: 'Graded SW', numeric: true, render: (r) => pctText(r.gswPct) },
    { key: 'g1wPct', header: 'G1', numeric: true, render: (r) => pctText(r.g1wPct) },
  ]

  return (
    <>
      <p className="page__note-block">
        Per-{noun.toLowerCase()} sale-to-track conversion across all offered horses.
        Only {nounPlural} with at least the chosen sample of offered yearlings/2yos
        are shown.
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
          {board.length} {nounPlural}
        </span>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Top {nounPlural} by winner rate</h2>
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
          <h2 className="section__title">{noun} leaderboard</h2>
          <span className="section__note">Sortable · searchable · click a row for detail</span>
        </div>
        <DataTable
          columns={columns}
          rows={board}
          searchable
          pageSize={20}
          exportFilename={filename}
          onRowClick={(r) => setSelected(r)}
          emptyMessage={`No ${nounPlural} meet the minimum sample.`}
        />
      </section>

      {selected ? (
        <Modal
          title={selected.name}
          subtitle={`${noun} · ${intFmt(selected.count)} offered · ${pctText(
            selected.winnersPct,
          )} winners`}
          onClose={() => setSelected(null)}
        >
          <EntityDetail
            records={selectedRecords}
            field={field}
            filename={`winchell-${field}-${selected.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')}.csv`}
          />
        </Modal>
      ) : null}
    </>
  )
}
