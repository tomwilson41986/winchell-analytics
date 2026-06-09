/** Shared visual constants for charts, sourced from the brand palette. */
export const CHART = {
  maroon: '#7A2030',
  maroonLight: '#A8384B',
  gold: '#C9A227',
  grid: '#EBE6E6',
  axis: '#6B7280',
  height: 240,
  fontFamily:
    "'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontSize: 12,
} as const

/** Axis tick styling reused across charts. */
export const tickStyle = {
  fill: CHART.axis,
  fontSize: CHART.fontSize,
  fontFamily: CHART.fontFamily,
} as const
