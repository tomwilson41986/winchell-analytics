import { useState } from 'react'
import { Link } from 'react-router-dom'
import ChartCard from '../../../components/ChartCard'
import DataTable, { type Column } from '../../../components/DataTable'
import Icon from '../../../components/Icon'
import PageHeader from '../../../components/PageHeader'
import StatTile from '../../../components/StatTile'
import Tabs, { type TabDef } from '../../../components/Tabs'
import { BarChart, LineChart } from '../../../components/charts/LazyCharts'
import { topN } from '../../../lib/aggregate'
import {
  countByDisplay,
  countByTrack,
  distanceText,
  flaggedPerDay,
  formatDate,
  type MasterProspect,
  MASTER_PATH,
  INDEX_PATH,
  masterName,
  preferJa,
  type ProspectsIndex,
  ratingDistribution,
  secondary,
} from '../../../lib/japanProspects'
import { ErrorBox, Loading } from './Async'
import RatingBadge from './RatingBadge'
import { useJson } from './useJson'
import '../../page.css'
import './japan.css'

const TABS: TabDef[] = [
  { id: 'prospects', label: 'Prospects' },
  { id: 'dashboard', label: 'Dashboard' },
]

/** Master row augmented with display-name fields so the table sorts on them. */
type Row = MasterProspect & {
  _name: string
  _sire: string
  _dam: string
  _trainer: string
}

function toRow(p: MasterProspect): Row {
  return {
    ...p,
    _name: masterName(p),
    _sire: preferJa(p.sire, p.sire_romaji),
    _dam: preferJa(p.dam, p.dam_romaji),
    _trainer: preferJa(p.trainer, p.trainer_romaji),
  }
}

export default function JapanProspects() {
  const [tab, setTab] = useState('prospects')
  const master = useJson<MasterProspect[]>(MASTER_PATH)
  const index = useJson<ProspectsIndex>(INDEX_PATH)

  const list = master.data ?? []
  const idx = index.data
  const rows = list.map(toRow)
  const has = rows.length > 0

  const blackType = list.filter((p) => (p.best_rating ?? 0) >= 105).length
  const daysTracked = idx?.days.length ?? 0

  const columns: Column<Row>[] = [
    {
      key: '_name',
      header: 'Mare',
      render: (r) => {
        const sub = secondary(r.horse, r.horse_romaji)
        return (
          <Link
            to={`/broodmares/japan-prospects/prospect/${encodeURIComponent(r.key)}`}
            className="jp-name-link"
          >
            <strong>{r._name}</strong>
            {sub ? <span className="pedigree__value-sub"> {sub}</span> : null}
          </Link>
        )
      },
    },
    { key: '_sire', header: 'Sire' },
    { key: '_dam', header: 'Dam' },
    { key: '_trainer', header: 'Trainer' },
    {
      key: 'best_rating',
      header: 'Best rating',
      numeric: true,
      render: (r) => <RatingBadge rating={r.best_rating} />,
    },
    {
      key: 'best_distance_m',
      header: 'Distance',
      numeric: true,
      render: (r) => distanceText(r.best_distance_m),
    },
    { key: 'track', header: 'Track' },
    { key: 'last_seen', header: 'Last seen', numeric: true },
  ]

  // Dashboard series
  const perDay = idx ? flaggedPerDay(idx) : []
  const dist = ratingDistribution(list)
  const topSires = topN(countByDisplay(list, 'sire', 'sire_romaji'), 10)
  const byTrack = topN(countByTrack(list), 12)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Broodmares"
        title="Japan Broodmare Prospects"
        icon="globe"
        crumbs={[
          { to: '/broodmares', label: 'Broodmares' },
          { to: '/broodmares/japan-prospects', label: 'Japan Prospects' },
        ]}
        intro="Flagged Japanese fillies & mares from the daily data pipeline — female runners over 1400–2600m with a house class rating of 90+. Updated daily, in lockstep with the digest emails."
      />

      <nav className="subnav" aria-label="Japan Prospects sub-sections">
        <Link to="/broodmares/japan-prospects/digests" className="chip">
          <Icon name="calendar" size={16} />
          Daily Digest Archive
        </Link>
      </nav>

      {index.error || master.error ? (
        <ErrorBox message={master.error ?? index.error ?? ''} />
      ) : master.loading ? (
        <Loading label="Loading prospects…" />
      ) : (
        <>
          <section className="section" aria-label="Summary">
            <div className="stat-grid">
              <StatTile label="Prospects (all-time)" value={String(list.length)} pending={!has} />
              <StatTile label="Black-type+ (≥105)" value={String(blackType)} pending={!has} />
              <StatTile label="Days tracked" value={String(daysTracked)} pending={daysTracked === 0} />
              <StatTile
                label="Latest update"
                value={idx?.lastDate ? formatDate(idx.lastDate) : '—'}
                pending={!idx?.lastDate}
              />
            </div>
          </section>

          <Tabs tabs={TABS} active={tab} onChange={setTab} />

          {tab === 'prospects' ? (
            <section className="section">
              <div className="section__head">
                <h2 className="section__title">All flagged prospects</h2>
                <span className="section__note">
                  One row per mare — best rating kept. Sorted best-rating first.
                </span>
              </div>
              <DataTable
                columns={columns}
                rows={rows}
                searchable
                pageSize={25}
                emptyMessage="No prospects yet — the daily job will populate this once the data feed is connected."
              />
            </section>
          ) : (
            <section className="section">
              <div className="chart-grid chart-grid--2">
                <ChartCard
                  title="Prospects flagged per day"
                  subtitle={perDay.length ? 'Daily flagged count' : 'Awaiting daily data.'}
                >
                  {perDay.length ? (
                    <LineChart data={perDay} valueLabel="Flagged" valueFormatter={String} />
                  ) : undefined}
                </ChartCard>
                <ChartCard
                  title="Best-rating distribution"
                  subtitle={has ? 'Mares by best rating band' : 'Connect data to render.'}
                >
                  {has ? (
                    <BarChart data={dist} valueLabel="Mares" valueFormatter={String} />
                  ) : undefined}
                </ChartCard>
                <ChartCard
                  title="Top sires"
                  subtitle={has ? 'Most-represented sires (top 10)' : 'Connect data to render.'}
                >
                  {has ? (
                    <BarChart data={topSires} valueLabel="Prospects" valueFormatter={String} />
                  ) : undefined}
                </ChartCard>
                <ChartCard
                  title="Prospects by track"
                  subtitle={has ? 'Where mares were flagged' : 'Connect data to render.'}
                >
                  {has ? (
                    <BarChart data={byTrack} valueLabel="Prospects" valueFormatter={String} />
                  ) : undefined}
                </ChartCard>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
