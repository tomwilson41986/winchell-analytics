import { Link } from 'react-router-dom'
import Icon, { type IconName } from './Icon'
import './PageHeader.css'

interface Crumb {
  to: string
  label: string
}

interface PageHeaderProps {
  eyebrow: string
  title: string
  intro?: string
  icon?: IconName
  crumbs?: Crumb[]
}

/** Consistent editorial header for section pages. */
export default function PageHeader({
  eyebrow,
  title,
  intro,
  icon,
  crumbs,
}: PageHeaderProps) {
  return (
    <header className="pagehead">
      {crumbs && crumbs.length > 0 ? (
        <nav className="pagehead__crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={c.to} className="pagehead__crumb">
              <Link to={c.to}>{c.label}</Link>
              {i < crumbs.length - 1 ? (
                <span className="pagehead__sep">/</span>
              ) : null}
            </span>
          ))}
        </nav>
      ) : null}

      <div className="pagehead__row">
        {icon ? (
          <span className="pagehead__icon">
            <Icon name={icon} size={26} />
          </span>
        ) : null}
        <div>
          <p className="pagehead__eyebrow">{eyebrow}</p>
          <h1 className="pagehead__title">{title}</h1>
        </div>
      </div>

      {intro ? <p className="pagehead__intro">{intro}</p> : null}
    </header>
  )
}
