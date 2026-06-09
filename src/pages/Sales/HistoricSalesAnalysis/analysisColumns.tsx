import type { Column } from '../../../components/DataTable'
import { type BandRow, type FactorRow, pctText } from '../../../lib/salesAnalysis'

const intFmt = (v: number | null) => (v == null ? '—' : v.toLocaleString())

const rateCols = <T extends FactorRow | BandRow>(): Column<T>[] => [
  { key: 'runnersPct', header: 'Runners', numeric: true, render: (r) => pctText(r.runnersPct) },
  { key: 'winnersPct', header: 'Winners', numeric: true, render: (r) => pctText(r.winnersPct) },
  { key: 'swPct', header: 'SW', numeric: true, render: (r) => pctText(r.swPct) },
  { key: 'gswPct', header: 'Graded SW', numeric: true, render: (r) => pctText(r.gswPct) },
  { key: 'g1wPct', header: 'G1', numeric: true, render: (r) => pctText(r.g1wPct) },
]

export const FACTOR_COLUMNS: Column<FactorRow>[] = [
  { key: 'factor', header: 'Factor' },
  { key: 'value', header: 'Value' },
  { key: 'count', header: 'N', numeric: true, render: (r) => intFmt(r.count) },
  ...rateCols<FactorRow>(),
]

export const BAND_COLUMNS: Column<BandRow>[] = [
  { key: 'band', header: 'Band' },
  { key: 'count', header: 'N', numeric: true, render: (r) => intFmt(r.count) },
  ...rateCols<BandRow>(),
]
