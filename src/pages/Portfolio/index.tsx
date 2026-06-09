import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import StatTile from '../../components/StatTile'
import DataTable, { type Column } from '../../components/DataTable'
import {
  loadPortfolio,
  money,
  orDash,
  titleCase,
  type PortfolioCard,
  type PortfolioRollup,
} from '../../lib/portfolio'
import '../page.css'
import './portfolio.css'

function Loading({ label }: { label: string }) {
  return (
    <div className="async">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="async async--error">
      <strong>Couldn’t load the portfolio.</strong>
      <span>{message}</span>
    </div>
  )
}

export default function Portfolio() {
  const [data, setData] = useState<PortfolioRollup | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    loadPortfolio()
      .then((d) => active && setData(d))
      .catch((e) => active && setErr(String(e.message ?? e)))
    return () => {
      active = false
    }
  }, [])

  const columns: Column<PortfolioCard>[] = [
    {
      key: 'name',
      header: 'Horse',
      render: (r) => (
        <span className="horse-cell">
          <Link to={`/horse/${r.horse_id}`} className="horse-cell__link">
            {r.name}
          </Link>
          {r.black_type ? <span className="bt-tag" title="Black-type winner">BT</span> : null}
        </span>
      ),
    },
    { key: 'sire', header: 'Sire', render: (r) => titleCase(r.sire) },
    { key: 'dam', header: 'Dam', render: (r) => titleCase(r.dam) },
    { key: 'trainer', header: 'Trainer', render: (r) => orDash(r.trainer) },
    { key: 'starts', header: 'Starts', numeric: true },
    { key: 'wins', header: 'Wins', numeric: true },
    {
      key: 'total_earnings',
      header: 'Earnings',
      numeric: true,
      render: (r) => money(r.total_earnings, r.currency ?? 'USD'),
    },
    {
      key: 'value_flag',
      header: 'Value flag',
      render: (r) =>
        r.value_flag ? <span className="value-flag">{r.value_flag}</span> : orDash(null),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Portfolio"
        title="Winchell Portfolio"
        icon="horseshoe"
        intro="Every horse tracked under the Winchell Thoroughbreds operation — pedigree, form, earnings and full results, scored into one view. Click a horse for its profile."
      />

      {err ? (
        <ErrorBox message={err} />
      ) : !data ? (
        <Loading label="Loading portfolio…" />
      ) : (
        <>
          <section className="section" aria-label="Summary">
            <div className="stat-grid">
              <StatTile label="Horses tracked" value={String(data.horse_count)} />
              <StatTile label="Active" value={String(data.active_count)} />
              <StatTile
                label="Total earnings"
                value={money(data.total_earnings, data.currency ?? 'USD')}
              />
              <StatTile label="Graded winners" value={String(data.graded_winners)} />
              <StatTile label="Black-type winners" value={String(data.black_type_winners)} />
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Roster</h2>
              <span className="section__note">
                Generated {new Date(data.generated_at).toLocaleDateString('en-GB')}
              </span>
            </div>
            <DataTable
              columns={columns}
              rows={data.horses}
              searchable
              emptyMessage="No horses in the portfolio yet — run the pipeline to populate it."
            />
          </section>
        </>
      )}
    </div>
  )
}
