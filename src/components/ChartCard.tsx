import './ChartCard.css'

interface ChartCardProps {
  title: string
  subtitle?: string
  /** Render chart content here once a charting library is wired in. */
  children?: React.ReactNode
}

/**
 * Framed container for a chart/visualisation. Renders a labelled placeholder
 * until real chart content is passed as children.
 */
export default function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <section className="chartcard">
      <header className="chartcard__head">
        <h3 className="chartcard__title">{title}</h3>
        {subtitle ? <p className="chartcard__subtitle">{subtitle}</p> : null}
      </header>
      <div className="chartcard__body">
        {children ?? (
          <div className="chartcard__placeholder">
            Chart placeholder — wire up a visualisation here.
          </div>
        )}
      </div>
    </section>
  )
}
