import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import StatTile from '../../components/StatTile'
import ChartCard from '../../components/ChartCard'
import DataTable, { type Column } from '../../components/DataTable'
import { BarChart } from '../../components/charts/LazyCharts'
import type { ChartDatum } from '../../lib/aggregate'
import {
  cardsToCsv,
  downloadText,
  loadPortfolio,
  money,
  moneyCompact,
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

const ALL = '__all__'

/** Sum a numeric field grouped by a (title-cased) key, biggest first. */
function groupSum(
  cards: PortfolioCard[],
  key: (c: PortfolioCard) => string | null,
  value: (c: PortfolioCard) => number | null,
): ChartDatum[] {
  const acc = new Map<string, number>()
  for (const c of cards) {
    const k = key(c)
    const v = value(c)
    if (!k || v == null) continue
    acc.set(k, (acc.get(k) ?? 0) + v)
  }
  return [...acc.entries()]
    .map(([label, val]) => ({ label, value: val }))
    .sort((a, b) => b.value - a.value)
}

function countBy(cards: PortfolioCard[], key: (c: PortfolioCard) => string | null): ChartDatum[] {
  const acc = new Map<string, number>()
  for (const c of cards) {
    const k = key(c) || 'Unknown'
    acc.set(k, (acc.get(k) ?? 0) + 1)
  }
  return [...acc.entries()].map(([label, value]) => ({ label, value }))
}

export default function Portfolio() {
  const [data, setData] = useState<PortfolioRollup | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [status, setStatus] = useState<string>(ALL)
  const [sire, setSire] = useState<string>(ALL)
  const [blackTypeOnly, setBlackTypeOnly] = useState(false)

  useEffect(() => {
    let active = true
    loadPortfolio()
      .then((d) => active && setData(d))
      .catch((e) => active && setErr(String(e.message ?? e)))
    return () => {
      active = false
    }
  }, [])

  const cards = data?.horses ?? []

  const statuses = useMemo(
    () => [...new Set(cards.map((c) => c.status).filter(Boolean) as string[])].sort(),
    [cards],
  )
  const sires = useMemo(
    () => [...new Set(cards.map((c) => c.sire).filter(Boolean) as string[])].sort(),
    [cards],
  )

  const rows = useMemo(
    () =>
      cards.filter(
        (c) =>
          (status === ALL || c.status === status) &&
          (sire === ALL || c.sire === sire) &&
          (!blackTypeOnly || c.black_type),
      ),
    [cards, status, sire, blackTypeOnly],
  )

  const earningsByHorse = useMemo(
    () => groupSum(rows, (c) => c.name, (c) => c.total_earnings).slice(0, 10),
    [rows],
  )
  const winsBySire = useMemo(
    () =>
      groupSum(rows, (c) => (c.sire ? titleCase(c.sire) : null), (c) => c.wins).filter(
        (d) => d.value > 0,
      ),
    [rows],
  )
  const statusBreakdown = useMemo(() => countBy(rows, (c) => c.status), [rows])

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
    { key: 'status', header: 'Status', render: (r) => orDash(r.status) },
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
                value={moneyCompact(data.total_earnings, data.currency ?? 'USD')}
                hint={data.total_earnings != null ? money(data.total_earnings, data.currency ?? 'USD') : undefined}
              />
              <StatTile label="Graded winners" value={String(data.graded_winners)} />
              <StatTile label="Black-type winners" value={String(data.black_type_winners)} />
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Portfolio analytics</h2>
              <span className="section__note">
                {rows.length === cards.length
                  ? `${cards.length} horses`
                  : `${rows.length} of ${cards.length} horses (filtered)`}
              </span>
            </div>
            <div className="chart-grid chart-grid--2">
              <ChartCard
                title="Career earnings by horse"
                subtitle={earningsByHorse.length ? 'Top earners' : 'no data found'}
              >
                {earningsByHorse.length ? (
                  <BarChart data={earningsByHorse} valueLabel="Earnings" valueFormatter={(v) => money(v)} />
                ) : undefined}
              </ChartCard>
              <ChartCard
                title="Wins by sire"
                subtitle={winsBySire.length ? 'Race wins grouped by sire' : 'no data found'}
              >
                {winsBySire.length ? (
                  <BarChart data={winsBySire} valueLabel="Wins" valueFormatter={String} allowDecimals={false} />
                ) : undefined}
              </ChartCard>
            </div>
            <div className="chart-grid">
              <ChartCard title="Status breakdown" subtitle="Horses by current status">
                {statusBreakdown.length ? (
                  <BarChart data={statusBreakdown} valueLabel="Horses" valueFormatter={String} allowDecimals={false} />
                ) : undefined}
              </ChartCard>
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Roster</h2>
              <div className="section__actions">
                <span className="section__note">
                  Generated {new Date(data.generated_at).toLocaleDateString('en-GB')}
                </span>
                <button
                  type="button"
                  className="filters__reset"
                  onClick={() => downloadText('winchell-portfolio.csv', cardsToCsv(rows))}
                  disabled={rows.length === 0}
                >
                  Download CSV
                </button>
              </div>
            </div>

            <div className="filters">
              <label className="filter">
                <span className="filter__label">Status</span>
                <select className="filter__select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value={ALL}>All</option>
                  {statuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="filter">
                <span className="filter__label">Sire</span>
                <select className="filter__select" value={sire} onChange={(e) => setSire(e.target.value)}>
                  <option value={ALL}>All</option>
                  {sires.map((s) => (
                    <option key={s} value={s}>{titleCase(s)}</option>
                  ))}
                </select>
              </label>
              <label className="filter__check">
                <input
                  type="checkbox"
                  checked={blackTypeOnly}
                  onChange={(e) => setBlackTypeOnly(e.target.checked)}
                />
                Black-type only
              </label>
              {(status !== ALL || sire !== ALL || blackTypeOnly) ? (
                <button
                  type="button"
                  className="filters__reset"
                  onClick={() => {
                    setStatus(ALL)
                    setSire(ALL)
                    setBlackTypeOnly(false)
                  }}
                >
                  Reset
                </button>
              ) : null}
            </div>

            <DataTable
              columns={columns}
              rows={rows}
              searchable
              emptyMessage="No horses match the current filters."
            />
          </section>
        </>
      )}
    </div>
  )
}
