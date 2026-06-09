import {
  Bar,
  CartesianGrid,
  BarChart as ReBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ChartDatum } from '../../lib/aggregate'
import { formatCompact } from '../../lib/aggregate'
import ChartTooltip from './ChartTooltip'
import { CHART, tickStyle } from './chartTheme'
import './charts.css'

interface BarChartProps {
  data: ChartDatum[]
  valueLabel?: string
  valueFormatter?: (v: number) => string
}

/** Themed vertical bar chart for categorical comparisons. */
export default function BarChart({
  data,
  valueLabel,
  valueFormatter = formatCompact,
}: BarChartProps) {
  return (
    <div className="chart" style={{ height: CHART.height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.maroonLight} />
              <stop offset="100%" stopColor={CHART.maroon} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis
            dataKey="label"
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
          />
          <YAxis
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={false}
            tickFormatter={formatCompact}
          />
          <Tooltip
            cursor={{ fill: 'rgba(122,32,48,0.06)' }}
            content={
              <ChartTooltip valueFormatter={valueFormatter} valueLabel={valueLabel} />
            }
          />
          <Bar
            dataKey="value"
            isAnimationActive={false}
            fill="url(#barFill)"
            radius={[6, 6, 0, 0]}
            maxBarSize={56}
          />
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}
