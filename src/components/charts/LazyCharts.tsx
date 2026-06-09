import { lazy, Suspense } from 'react'
import type { ChartDatum } from '../../lib/aggregate'
import { CHART } from './chartTheme'
import './charts.css'

/* Recharts is heavy, so it is code-split into its own async chunk and only
   loaded when a chart actually mounts (i.e. when a section has data). */
const BarImpl = lazy(() => import('./BarChart'))
const LineImpl = lazy(() => import('./LineChart'))

export interface ChartProps {
  data: ChartDatum[]
  valueLabel?: string
  valueFormatter?: (v: number) => string
}

const fallback = (
  <div className="chart chart--loading" style={{ height: CHART.height }} />
)

export function BarChart(props: ChartProps) {
  return (
    <Suspense fallback={fallback}>
      <BarImpl {...props} />
    </Suspense>
  )
}

export function LineChart(props: ChartProps) {
  return (
    <Suspense fallback={fallback}>
      <LineImpl {...props} />
    </Suspense>
  )
}
