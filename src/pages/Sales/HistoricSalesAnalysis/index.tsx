import { useEffect, useState } from 'react'
import PageHeader from '../../../components/PageHeader'
import Tabs, { type TabDef } from '../../../components/Tabs'
import { fetchJson } from '../../../lib/fetchData'
import {
  ANALYSIS_PATH,
  type AnalysisTables,
  DATA_PATH,
  type SaleRecord,
} from '../../../lib/salesAnalysis'
import ConversionTab from './ConversionTab'
import FactorsTab from './FactorsTab'
import BiomechanicsTab from './BiomechanicsTab'
import HeartTab from './HeartTab'
import '../../page.css'

const TABS: TabDef[] = [
  { id: 'conversion', label: 'Conversion' },
  { id: 'factors', label: 'Selection Factors' },
  { id: 'biomechanics', label: 'Biomechanics' },
  { id: 'heart', label: 'Heart' },
]

function Loading({ label }: { label: string }) {
  return (
    <div className="async">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="async async--error">
      <strong>Couldn’t load the data.</strong>
      <span>{message}</span>
    </div>
  )
}

export default function HistoricSalesAnalysis() {
  const [tab, setTab] = useState('conversion')

  const [records, setRecords] = useState<SaleRecord[] | null>(null)
  const [recErr, setRecErr] = useState<string | null>(null)
  const [tables, setTables] = useState<AnalysisTables | null>(null)
  const [tablesErr, setTablesErr] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchJson<SaleRecord[]>(DATA_PATH)
      .then((d) => active && setRecords(d))
      .catch((e) => active && setRecErr(String(e.message ?? e)))
    fetchJson<AnalysisTables>(ANALYSIS_PATH)
      .then((d) => active && setTables(d))
      .catch((e) => active && setTablesErr(String(e.message ?? e)))
    return () => {
      active = false
    }
  }, [])

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
        intro="Sale-to-track outcomes for offered yearlings and 2yos — biomechanic (R2 Bio) ratings, selection signals and heart scans against runner, winner and stakes results."
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'conversion' &&
        (recErr ? (
          <ErrorBox message={recErr} />
        ) : !records ? (
          <Loading label="Loading sales records…" />
        ) : (
          <ConversionTab records={records} />
        ))}

      {tab !== 'conversion' &&
        (tablesErr ? (
          <ErrorBox message={tablesErr} />
        ) : !tables ? (
          <Loading label="Loading analysis…" />
        ) : tab === 'factors' ? (
          <FactorsTab tables={tables} />
        ) : tab === 'biomechanics' ? (
          <BiomechanicsTab tables={tables} />
        ) : (
          <HeartTab tables={tables} />
        ))}
    </div>
  )
}
