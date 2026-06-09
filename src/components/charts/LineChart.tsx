import {
  Area,
  AreaChart,
  CartesianGrid,
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

interface LineChartProps {
  data: ChartDatum[]
  valueLabel?: string
  valueFormatter?: (v: number) => string
  yTickFormatter?: (v: number) => string
  allowDecimals?: boolean
}

/** Themed area/line chart for trends over an ordered axis (e.g. by year). */
export default function LineChart({
  data,
  valueLabel,
  valueFormatter = formatCompact,
  yTickFormatter = formatCompact,
  allowDecimals = false,
}: LineChartProps) {
  return (
    <div className="chart" style={{ height: CHART.height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.maroon} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART.maroon} stopOpacity={0.02} />
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
            allowDecimals={allowDecimals}
            tickFormatter={yTickFormatter}
          />
          <Tooltip
            cursor={{ stroke: CHART.maroonLight, strokeDasharray: '4 4' }}
            content={
              <ChartTooltip valueFormatter={valueFormatter} valueLabel={valueLabel} />
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            isAnimationActive={false}
            stroke={CHART.maroon}
            strokeWidth={2.5}
            fill="url(#areaFill)"
            dot={{ r: 3, fill: CHART.maroon, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: CHART.maroon, stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
