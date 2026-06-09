import type { TooltipContentProps } from 'recharts'
import './charts.css'

interface Props extends Partial<TooltipContentProps<number, string>> {
  valueFormatter?: (v: number) => string
  valueLabel?: string
}

/** Themed tooltip shared by the chart components. */
export default function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v) => String(v),
  valueLabel,
}: Props) {
  if (!active || !payload || payload.length === 0) return null
  const value = payload[0]?.value as number

  return (
    <div className="charttip">
      <div className="charttip__label">{label}</div>
      <div className="charttip__value tnum">
        {valueLabel ? <span className="charttip__key">{valueLabel}</span> : null}
        {valueFormatter(value)}
      </div>
    </div>
  )
}
