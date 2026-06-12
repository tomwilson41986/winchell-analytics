import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import '../page.css'

const SUB_SECTIONS: { to: string; title: string; blurb: string; icon: IconName }[] = [
  {
    to: '/sales/live',
    title: 'Live Sales',
    blurb:
      'Upcoming and active thoroughbred auctions worldwide, refreshed daily from 12 sale houses. Subscribe to sales and watch sires for new catalogue entries.',
    icon: 'spark',
  },
  {
    to: '/sales/historic',
    title: 'Historic Sales',
    blurb:
      'Past auction results — prices, buyers and consignors — with year-on-year price trends and the historic sales analysis dashboard.',
    icon: 'database',
  },
]

export default function Sales() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Section"
        title="Sales"
        icon="tag"
        intro="The global thoroughbred auction picture: live and upcoming sales on one side, historic results and analysis on the other."
      />

      <section className="section" aria-label="Sales sub-sections">
        <div className="cards">
          {SUB_SECTIONS.map((s) => (
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
    </div>
  )
}
