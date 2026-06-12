import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'
import StatTile from '../components/StatTile'
import { loadPortfolio, money, moneyCompact, type PortfolioRollup } from '../lib/portfolio'
import './page.css'

interface SectionCard {
  to: string
  title: string
  blurb: string
  icon: IconName
}

const SECTIONS: SectionCard[] = [
  {
    to: '/portfolio',
    title: 'Portfolio',
    blurb: 'The Winchell string scored end to end — pedigree, form, earnings and results.',
    icon: 'spark',
  },
  {
    to: '/horses',
    title: 'Horses',
    blurb: 'Profiles, connections and performance across the string.',
    icon: 'horseshoe',
  },
  {
    to: '/sales',
    title: 'Sales',
    blurb: 'Live global auction calendar with subscriptions, plus historic results and analysis.',
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
  const [portfolio, setPortfolio] = useState<PortfolioRollup | null>(null)

  useEffect(() => {
    let active = true
    loadPortfolio()
      .then((d) => active && setPortfolio(d))
      .catch(() => undefined) // home KPIs fall back to a muted placeholder
    return () => {
      active = false
    }
  }, [])

  const has = portfolio != null

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
            A single home for the data behind the Winchell programme — a scored
            portfolio of every horse, with pedigree, sales, form, earnings and
            full race results, built for clear, fast, defensible analysis.
          </p>
          <div className="hero__actions">
            <Link to="/portfolio" className="btn btn--primary">
              Open the portfolio
              <Icon name="arrow" size={18} />
            </Link>
            <Link to="/horses" className="btn btn--ghost">
              Browse horses
            </Link>
          </div>
        </div>
      </section>

      <section className="section" aria-label="Portfolio at a glance">
        <div className="stat-grid">
          <StatTile
            label="Horses tracked"
            value={String(portfolio?.horse_count ?? '')}
            pending={!has}
          />
          <StatTile
            label="Total earnings"
            value={has ? moneyCompact(portfolio!.total_earnings, portfolio!.currency ?? 'USD') : ''}
            hint={
              has && portfolio!.total_earnings != null
                ? money(portfolio!.total_earnings, portfolio!.currency ?? 'USD')
                : undefined
            }
            pending={!has}
          />
          <StatTile
            label="Graded winners"
            value={String(portfolio?.graded_winners ?? '')}
            pending={!has}
          />
          <StatTile
            label="Black-type winners"
            value={String(portfolio?.black_type_winners ?? '')}
            pending={!has}
          />
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
