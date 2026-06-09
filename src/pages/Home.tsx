import { Link } from 'react-router-dom'
import './page.css'

const SECTIONS = [
  { to: '/horses', title: 'Horses', blurb: 'Profiles, form and performance data.' },
  { to: '/sales', title: 'Sales', blurb: 'Historic sales results and analysis.' },
  { to: '/sires', title: 'Sires', blurb: 'Stallion records and progeny stats.' },
  {
    to: '/broodmares',
    title: 'Broodmares',
    blurb: 'Mare records, produce and prospects.',
  },
]

export default function Home() {
  return (
    <>
      <section className="home__hero">
        <h1>Winchell Analytics</h1>
        <p className="page__intro" style={{ margin: '0 auto' }}>
          Thoroughbred racing data and analysis for the Winchell
          Thoroughbreds programme — horses, sales, sires and broodmares.
        </p>
      </section>

      <div className="cards">
        {SECTIONS.map((s) => (
          <Link key={s.to} to={s.to} className="card">
            <h2>{s.title}</h2>
            <p>{s.blurb}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
