import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import StatTile from '../../components/StatTile'
import ChartCard from '../../components/ChartCard'
import DataTable, { type Column } from '../../components/DataTable'
import { LineChart } from '../../components/charts/LazyCharts'
import type { ChartDatum } from '../../lib/aggregate'
import {
  loadProfile,
  money,
  orDash,
  pct,
  titleCase,
  type HorseProfile as Profile,
  type PedigreeNode,
  type RaceResult,
  type SaleRecord,
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
      <strong>Couldn’t load this horse.</strong>
      <span>{message}</span>
    </div>
  )
}

function GradeTag({ grade }: { grade: string | null }) {
  if (!grade) return null
  return <span className={`grade-tag grade-tag--${grade.toLowerCase()}`}>{grade}</span>
}

function PedigreeCell({ role, node }: { role: string; node: PedigreeNode | null }) {
  return (
    <div className="ped-cell">
      <span className="ped-cell__role">{role}</span>
      <span className="ped-cell__name">{node ? titleCase(node.name) : orDash(null)}</span>
      <span className="ped-cell__meta">
        {node && (node.country || node.year_of_birth)
          ? [node.country, node.year_of_birth].filter(Boolean).join(' · ')
          : ''}
      </span>
    </div>
  )
}

/** Cumulative earnings over time, oldest run first. */
function cumulativeEarnings(results: RaceResult[]): ChartDatum[] {
  const dated = results
    .filter((r) => r.race_date)
    .sort((a, b) => (a.race_date! < b.race_date! ? -1 : 1))
  let running = 0
  const out: ChartDatum[] = []
  for (const r of dated) {
    running += r.earnings ?? 0
    out.push({ label: r.race_date!, value: running })
  }
  return out
}

const bio = (p: Profile): string => {
  const parts = [
    p.sex,
    p.colour,
    p.year_of_birth ? String(p.year_of_birth) : null,
    p.country,
    p.pedigree?.sire?.name ? `by ${titleCase(p.pedigree.sire.name)}` : null,
    p.pedigree?.dam?.name ? `out of ${titleCase(p.pedigree.dam.name)}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'no data found'
}

export default function HorseProfile() {
  const { horseId } = useParams<{ horseId: string }>()
  const [p, setP] = useState<Profile | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!horseId) return
    let active = true
    setP(null)
    setErr(null)
    loadProfile(horseId)
      .then((d) => active && setP(d))
      .catch((e) => active && setErr(String(e.message ?? e)))
    return () => {
      active = false
    }
  }, [horseId])

  const earnings = useMemo(() => (p ? cumulativeEarnings(p.results) : []), [p])

  const saleColumns: Column<SaleRecord>[] = [
    { key: 'sale_date', header: 'Date', render: (r) => orDash(r.sale_date) },
    { key: 'sale_house', header: 'Sale house', render: (r) => orDash(r.sale_house) },
    { key: 'sale_name', header: 'Sale', render: (r) => orDash(r.sale_name) },
    { key: 'lot', header: 'Hip', render: (r) => orDash(r.lot) },
    {
      key: 'price',
      header: 'Price',
      numeric: true,
      render: (r) => (r.rfna ? <span className="rna-tag">RNA</span> : money(r.price, r.currency ?? 'USD')),
    },
    { key: 'buyer', header: 'Buyer', render: (r) => orDash(r.buyer) },
    { key: 'consignor', header: 'Consignor', render: (r) => orDash(r.consignor) },
  ]

  const resultColumns: Column<RaceResult>[] = [
    { key: 'race_date', header: 'Date', render: (r) => orDash(r.race_date) },
    { key: 'track', header: 'Track', render: (r) => orDash(r.track) },
    {
      key: 'race_name',
      header: 'Race',
      render: (r) => (
        <span className="race-cell">
          {orDash(r.race_name)} <GradeTag grade={r.grade} />
        </span>
      ),
    },
    { key: 'surface', header: 'Surface', render: (r) => orDash(r.surface) },
    {
      key: 'distance_furlongs',
      header: 'Dist (f)',
      numeric: true,
      render: (r) => orDash(r.distance_furlongs),
    },
    {
      key: 'finish_position',
      header: 'Fin/Field',
      numeric: true,
      render: (r) =>
        r.finish_position != null
          ? `${r.finish_position}${r.field_size ? ` / ${r.field_size}` : ''}`
          : orDash(null),
    },
    { key: 'speed_figure', header: 'Speed', numeric: true, render: (r) => orDash(r.speed_figure) },
    {
      key: 'earnings',
      header: 'Earnings',
      numeric: true,
      render: (r) => money(r.earnings, r.currency ?? 'USD'),
    },
  ]

  return (
    <div className="page">
      {err ? (
        <ErrorBox message={err} />
      ) : !p ? (
        <Loading label="Loading horse…" />
      ) : (
        <>
          <PageHeader
            eyebrow="Horse"
            title={p.name}
            icon="horseshoe"
            crumbs={[
              { to: '/', label: 'Portfolio' },
              { to: `/horse/${p.horse_id}`, label: p.name },
            ]}
            intro={bio(p)}
          />
          {p.scores?.black_type ? <span className="bt-banner">Black-type winner</span> : null}

          <section className="section" aria-label="Summary">
            <div className="stat-grid">
              <StatTile label="Starts" value={orDash(p.form?.starts)} />
              <StatTile label="Wins" value={orDash(p.form?.wins)} />
              <StatTile
                label="Earnings"
                value={money(p.form?.total_earnings, p.form?.currency ?? 'USD')}
              />
              <StatTile label="Win strike" value={pct(p.scores?.win_strike_rate)} />
              <StatTile label="Top speed fig" value={orDash(p.scores?.best_speed_figure)} />
            </div>
          </section>

          {p.scores?.value_flag ? (
            <p className="page__note-block">
              <strong>Insight:</strong> {p.scores.value_flag}
              {p.scores.class_trajectory ? ` · class trajectory ${p.scores.class_trajectory}` : ''}
            </p>
          ) : null}

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Pedigree</h2>
            </div>
            {p.pedigree ? (
              <>
                <div className="ped-grid">
                  <PedigreeCell role="Sire" node={p.pedigree.sire} />
                  <PedigreeCell role="Dam" node={p.pedigree.dam} />
                  <PedigreeCell role="Damsire" node={p.pedigree.damsire} />
                </div>
                <div className="inbreeding">
                  <span className="inbreeding__label">Inbreeding</span>
                  {p.pedigree.inbreeding.length ? (
                    <span className="inbreeding__chips">
                      {p.pedigree.inbreeding.map((s) => (
                        <span key={s} className="chip chip--static">
                          {s}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="muted">no data found</span>
                  )}
                </div>
              </>
            ) : (
              <p className="muted">no data found</p>
            )}
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Sales history</h2>
            </div>
            <DataTable
              columns={saleColumns}
              rows={p.sales}
              emptyMessage="no data found"
            />
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Cumulative earnings</h2>
            </div>
            <ChartCard
              title="Earnings over time"
              subtitle={earnings.length ? 'Running total by race date' : 'no data found'}
            >
              {earnings.length ? (
                <LineChart data={earnings} valueLabel="Earnings" valueFormatter={(v) => money(v)} />
              ) : undefined}
            </ChartCard>
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Race results</h2>
            </div>
            <DataTable
              columns={resultColumns}
              rows={p.results}
              emptyMessage="no data found"
            />
          </section>

          {p.sources.length ? (
            <p className="sources-note">
              Sources:{' '}
              {p.sources.map((s, i) => (
                <span key={s}>
                  {i > 0 ? ', ' : ''}
                  <a href={s} target="_blank" rel="noreferrer noopener">
                    {new URL(s).hostname}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
