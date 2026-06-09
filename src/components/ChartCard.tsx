import Icon from './Icon'
import './ChartCard.css'

interface ChartCardProps {
  title: string
  subtitle?: string
  /** Render chart content here once a charting library is wired in. */
  children?: React.ReactNode
}

/**
 * Framed container for a chart/visualisation. Renders a labelled placeholder
 * with an axis/grid motif until real chart content is passed as children.
 */
export default function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <section className="chartcard">
      <header className="chartcard__head">
        <div>
          <h3 className="chartcard__title">{title}</h3>
          {subtitle ? <p className="chartcard__subtitle">{subtitle}</p> : null}
        </div>
        <span className="chartcard__badge">
          <Icon name="chart" size={18} />
        </span>
      </header>
      <div className="chartcard__body">
        {children ?? (
          <div className="chartcard__placeholder">
            <svg
              className="chartcard__ghost"
              viewBox="0 0 320 140"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline
                points="0,110 50,90 95,98 140,60 185,72 230,38 275,52 320,20"
                fill="none"
              />
              <polygon points="0,110 50,90 95,98 140,60 185,72 230,38 275,52 320,20 320,140 0,140" />
            </svg>
            <span className="chartcard__placeholder-label">
              Visualisation ready — connect data to render.
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
