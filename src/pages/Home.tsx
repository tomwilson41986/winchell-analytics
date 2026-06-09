import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'
import StatTile from '../components/StatTile'
import './page.css'

interface SectionCard {
  to: string
  title: string
  blurb: string
  icon: IconName
}

const SECTIONS: SectionCard[] = [
  {
    to: '/horses',
    title: 'Horses',
    blurb: 'Profiles, connections and performance across the string.',
    icon: 'horseshoe',
  },
  {
    to: '/sales',
    title: 'Sales',
    blurb: 'Historic auction results, prices and market analysis.',
    icon: 'tag',
  },
  {
    to: '/sires',
    title: 'Sires',
    blurb: 'Stallion records and progeny performance.',
    icon: 'crown',
  },
  {
    to: '/broodmares',
    title: 'Broodmares',
    blurb: 'Mare records, produce history and prospects.',
    icon: 'pedigree',
  },
]

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero__inner">
          <p className="hero__eyebrow">
            <Icon name="spark" size={14} />
            Winchell Thoroughbreds
          </p>
          <h1>Racing intelligence, end to end.</h1>
          <p className="hero__lede">
            A single home for the data behind the Winchell programme — horses,
            sales, sires and broodmares — built for clear, fast, defensible
            analysis.
          </p>
          <div className="hero__actions">
            <Link to="/horses" className="btn btn--primary">
              Explore horses
              <Icon name="arrow" size={18} />
            </Link>
            <Link to="/sales" className="btn btn--ghost">
              View sales data
            </Link>
          </div>
        </div>
      </section>

      <section className="section" aria-label="Programme at a glance">
        <div className="stat-grid">
          <StatTile label="Sections" value="4" hint="Horses · Sales · Sires · Broodmares" />
          <StatTile label="Horses tracked" value="—" hint="Add to /data/horses" pending />
          <StatTile label="Sales records" value="—" hint="Add to /data/sales" pending />
          <StatTile label="Broodmares" value="—" hint="Add to /data/broodmares" pending />
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Explore the data</h2>
        </div>
        <div className="cards">
          {SECTIONS.map((s) => (
            <Link key={s.to} to={s.to} className="card">
              <span className="card__icon">
                <Icon name={s.icon} size={24} />
              </span>
              <h3 className="card__title">
                {s.title}
                <Icon name="arrow" size={18} className="card__arrow" />
              </h3>
              <p className="card__blurb">{s.blurb}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
