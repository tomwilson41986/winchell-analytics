import './StatTile.css'

interface StatTileProps {
  label: string
  value: string
  hint?: string
  /** When true, renders muted dashes for value — use for not-yet-loaded data. */
  pending?: boolean
}

/**
 * Compact KPI callout. Built to surface a single headline metric per section;
 * shows a muted placeholder until real data is wired in.
 */
export default function StatTile({ label, value, hint, pending }: StatTileProps) {
  return (
    <div className={`stat${pending ? ' stat--pending' : ''}`}>
      <span className="stat__label">{label}</span>
      <span className="stat__value tnum">{pending ? '—' : value}</span>
      {hint ? <span className="stat__hint">{hint}</span> : null}
    </div>
  )
}
