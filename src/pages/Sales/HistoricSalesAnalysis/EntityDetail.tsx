import { useMemo } from 'react'
import DataTable, { type Column } from '../../../components/DataTable'
import StatTile from '../../../components/StatTile'
import { type SaleRecord, funnel } from '../../../lib/salesAnalysis'

const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const intFmt = (v: number) => v.toLocaleString()
const check = (r: SaleRecord, k: keyof SaleRecord) => (r[k] ? '✓' : '')

interface Props {
  records: SaleRecord[]
  field: 'sire' | 'consignor'
  filename: string
}

/** Detail view for one sire/consignor: outcome KPIs + its offered horses. */
export default function EntityDetail({ records, field, filename }: Props) {
  const f = useMemo(() => funnel(records), [records])
  const step = (k: string) => f.steps.find((s) => s.key === k)!

  // Show the complementary entity (sire detail lists consignor and vice versa).
  const other = field === 'sire' ? 'consignor' : 'sire'
  const otherHeader = field === 'sire' ? 'Consignor' : 'Sire'

  const columns: Column<SaleRecord>[] = [
    { key: 'year', header: 'Year', numeric: true },
    { key: 'sale', header: 'Sale' },
    { key: 'hip', header: 'Hip', numeric: true },
    { key: 'name', header: 'Name' },
    { key: other, header: otherHeader },
    {
      key: 'rating',
      header: 'R2 Bio',
      numeric: true,
      render: (r) => (r.rating == null ? '—' : r.rating.toFixed(1)),
    },
    { key: 'grade', header: 'Grade' },
    { key: 'winner', header: 'Won', numeric: true, render: (r) => check(r, 'winner') },
    { key: 'sw', header: 'SW', numeric: true, render: (r) => check(r, 'sw') },
    { key: 'gsw', header: 'GSW', numeric: true, render: (r) => check(r, 'gsw') },
    { key: 'g1w', header: 'G1', numeric: true, render: (r) => check(r, 'g1w') },
  ]

  return (
    <>
      <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
        <StatTile label="Offered" value={intFmt(f.offered)} />
        <StatTile label="Runners" value={pct(step('runner').pct)} hint={`${step('runner').count}`} />
        <StatTile label="Winners" value={pct(step('winner').pct)} hint={`${step('winner').count}`} />
        <StatTile label="Stakes Winners" value={pct(step('sw').pct)} hint={`${step('sw').count}`} />
      </div>

      <DataTable
        columns={columns}
        rows={records}
        searchable
        pageSize={12}
        exportFilename={filename}
      />
    </>
  )
}
