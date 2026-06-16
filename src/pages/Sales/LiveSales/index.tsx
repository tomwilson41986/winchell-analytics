import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable, { type Column } from '../../../components/DataTable'
import Icon from '../../../components/Icon'
import Modal from '../../../components/Modal'
import PageHeader from '../../../components/PageHeader'
import StatTile from '../../../components/StatTile'
import { useAuth } from '../../../lib/auth'
import {
  formatDateSpan,
  groupByCountry,
  loadLiveSales,
  SALE_TYPE_ICONS,
  type LiveCatalogue,
  type LiveLot,
  type LiveSalesFeed,
} from '../../../lib/liveSales'
import {
  computeNotifications,
  distinctMatchedSires,
  findSireEntries,
  normalizeHorseName,
  searchSireLots,
  type SireLotMatch,
} from '../../../lib/saleSubscriptions'
import { accountsEnabled } from '../../../lib/supabaseClient'
import { useSubscriptions } from '../../../lib/useSubscriptions'
import '../../page.css'
import './LiveSales.css'

export default function LiveSales() {
  const [feed, setFeed] = useState<LiveSalesFeed | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [sireQuery, setSireQuery] = useState('')
  const [lotsFor, setLotsFor] = useState<LiveCatalogue | null>(null)
  const { user } = useAuth()
  const { subs, toggleSaleSub, addSireSub, removeSireSub, acknowledge } = useSubscriptions()

  useEffect(() => {
    loadLiveSales().then(setFeed, () => setLoadError(true))
  }, [])

  const notifications = useMemo(
    () => (feed ? computeNotifications(feed, subs) : []),
    [feed, subs],
  )
  const groups = useMemo(() => (feed ? groupByCountry(feed.catalogues) : []), [feed])
  const watchedKeys = useMemo(
    () => new Set(subs.sires.map(normalizeHorseName)),
    [subs.sires],
  )

  const activeCount = feed?.catalogues.filter((c) => c.is_active).length ?? 0
  const lotCount = feed?.catalogues.reduce((n, c) => n + c.lots.length, 0) ?? 0

  const trimmedQuery = sireQuery.trim()
  const sireMatches = useMemo(
    () => (feed && trimmedQuery ? searchSireLots(feed, trimmedQuery) : []),
    [feed, trimmedQuery],
  )
  const matchedSires = useMemo(() => distinctMatchedSires(sireMatches), [sireMatches])
  const matchSaleCount = useMemo(
    () => new Set(sireMatches.map((m) => m.catalogue.id)).size,
    [sireMatches],
  )
  const sireRows = useMemo(() => sireMatches.map(toSireRow), [sireMatches])

  const toggleWatch = (name: string) =>
    watchedKeys.has(normalizeHorseName(name))
      ? removeSireSub(name)
      : addSireSub(name, feed)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Sales"
        title="Live Sales"
        icon="spark"
        crumbs={[
          { to: '/sales', label: 'Sales' },
          { to: '/sales/live', label: 'Live Sales' },
        ]}
        intro="Upcoming and active thoroughbred auctions worldwide, aggregated daily from 12 sale houses. Subscribe to a sale, or watch a sire / damsire to be notified of new catalogue entries."
      />

      <section className="section" aria-label="Summary">
        <div className="stat-grid">
          <StatTile
            label="Upcoming sales"
            value={feed ? String(feed.catalogues.length) : '—'}
            pending={!feed}
          />
          <StatTile label="Active now" value={feed ? String(activeCount) : '—'} pending={!feed} />
          <StatTile label="Catalogued lots" value={feed ? String(lotCount) : '—'} pending={!feed} />
          <StatTile
            label="Watched sires"
            value={String(subs.sires.length)}
            pending={subs.sires.length === 0}
          />
        </div>
      </section>

      {(subs.sales.length > 0 || subs.sires.length > 0) && (
        <section className="section" aria-label="Notifications">
          <div className="section__head">
            <h2 className="section__title">
              Notifications
              {notifications.length > 0 && (
                <span className="notif-count">{notifications.length}</span>
              )}
            </h2>
            {feed && notifications.length > 0 && (
              <button className="btn-export" onClick={() => acknowledge(feed)}>
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="livesales__quiet">
              No new activity on your subscriptions since you last checked.
            </p>
          ) : (
            <ul className="notif-list">
              {notifications.map((n) => (
                <li key={n.id} className={`notif notif--${n.kind}`}>
                  <span className="notif__icon">
                    <Icon name={n.kind === 'sire-entries' ? 'pedigree' : 'bell'} size={18} />
                  </span>
                  <span>
                    <strong>{n.title}</strong> — {n.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="livesales__storage-note">
            {user ? (
              <>
                Subscriptions are saved to your profile. Manage push notifications on your{' '}
                <Link to="/account">account page</Link>.
              </>
            ) : accountsEnabled ? (
              <>
                Subscriptions are stored in this browser. <Link to="/account">Sign in</Link>{' '}
                to keep them on your profile and get push notifications.
              </>
            ) : (
              <>
                Subscriptions are stored in this browser and checked against the feed on
                each visit.
              </>
            )}
          </p>
        </section>
      )}

      <section className="section" aria-label="Search sires and dam sires">
        <div className="section__head">
          <h2 className="section__title">Search sires &amp; dam sires</h2>
          <span className="section__note">
            Find every horse in a current sale by its sire or dam sire, then watch a
            name to be alerted when new ones are catalogued.
          </span>
        </div>

        <div className="sire-search">
          <Icon name="search" size={18} className="sire-search__icon" />
          <input
            className="sire-search__input"
            type="text"
            value={sireQuery}
            onChange={(e) => setSireQuery(e.target.value)}
            placeholder="Search any sire or dam sire — e.g. Gun Runner"
            aria-label="Search sire or dam sire"
          />
          {sireQuery && (
            <button
              className="sire-search__clear"
              aria-label="Clear search"
              onClick={() => setSireQuery('')}
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>

        {trimmedQuery && sireMatches.length === 0 && (
          <div className="sire-results sire-results--empty">
            <p className="livesales__quiet">
              No horses by a sire or dam sire matching “{trimmedQuery}” in the current
              catalogues.
            </p>
            <button
              className={`match-sire${watchedKeys.has(normalizeHorseName(sireQuery)) ? ' is-on' : ''}`}
              aria-pressed={watchedKeys.has(normalizeHorseName(sireQuery))}
              onClick={() => toggleWatch(sireQuery)}
            >
              <Icon name="bell" size={14} />
              {watchedKeys.has(normalizeHorseName(sireQuery))
                ? `Watching “${trimmedQuery}”`
                : `Watch “${trimmedQuery}” for future entries`}
            </button>
          </div>
        )}

        {trimmedQuery && sireMatches.length > 0 && (
          <div className="sire-results">
            <p className="sire-results__summary">
              <strong>{sireMatches.length}</strong>{' '}
              {sireMatches.length === 1 ? 'lot' : 'lots'} by{' '}
              <strong>{matchedSires.length}</strong>{' '}
              {matchedSires.length === 1 ? 'name' : 'names'} across{' '}
              <strong>{matchSaleCount}</strong> {matchSaleCount === 1 ? 'sale' : 'sales'}
            </p>
            <ul className="match-sire-list">
              {matchedSires.map((s) => {
                const watching = watchedKeys.has(s.key)
                return (
                  <li key={s.key}>
                    <button
                      className={`match-sire${watching ? ' is-on' : ''}`}
                      aria-pressed={watching}
                      onClick={() => toggleWatch(s.name)}
                    >
                      <Icon name="bell" size={14} />
                      <span>
                        {watching ? 'Watching' : 'Watch'} <strong>{s.name}</strong>
                      </span>
                      <span className="match-sire__tally">
                        {s.asSire > 0 && `${s.asSire} as sire`}
                        {s.asSire > 0 && s.asDamSire > 0 && ' · '}
                        {s.asDamSire > 0 && `${s.asDamSire} as dam sire`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <DataTable
              columns={sireSearchColumns}
              rows={sireRows}
              pageSize={25}
              exportFilename={`sire-search-${normalizeHorseName(sireQuery) || 'results'}.csv`}
            />
          </div>
        )}

        {subs.sires.length > 0 ? (
          <div className="watched-sires">
            <span className="watched-sires__label">
              <Icon name="bell" size={14} /> Watching for alerts
            </span>
            <ul className="sire-chips">
              {subs.sires.map((sire) => {
                const entryCount = feed
                  ? findSireEntries(feed, sire).reduce((n, m) => n + m.lotNos.length, 0)
                  : 0
                return (
                  <li key={normalizeHorseName(sire)} className="sire-chip">
                    <button
                      className="sire-chip__name"
                      onClick={() => setSireQuery(sire)}
                      title={`Show ${sire}'s entries`}
                    >
                      {sire}
                    </button>
                    <span className="sire-chip__count" title="Current entries">
                      {entryCount}
                    </span>
                    <button
                      className="sire-chip__remove"
                      aria-label={`Stop watching ${sire}`}
                      onClick={() => removeSireSub(sire)}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          !trimmedQuery && (
            <p className="livesales__quiet">
              Tip: search a stallion to see its runners across every sale, then watch it
              to be alerted when new entries are catalogued.
            </p>
          )
        )}
      </section>

      <section className="section" aria-label="Upcoming sales by country">
        <div className="section__head">
          <h2 className="section__title">Upcoming &amp; active sales</h2>
          {feed && (
            <span className="section__note">
              Refreshed {feed.generated_at.slice(0, 10)} · sources: 12 auction houses
            </span>
          )}
        </div>

        {loadError && (
          <p className="livesales__quiet">
            The live sales feed has not been generated yet — run{' '}
            <code>python -m pipeline.livesales.run --publish</code> or wait for the daily
            refresh.
          </p>
        )}
        {!feed && !loadError && <p className="livesales__quiet">Loading the sales feed…</p>}
        {feed && feed.catalogues.length === 0 && (
          <p className="livesales__quiet">
            No thoroughbred sales inside the 30-day horizon right now.
          </p>
        )}

        {groups.map((group) => (
          <div key={group.country} className="country-group">
            <h3 className="country-group__title">
              <span aria-hidden="true">{group.flag}</span> {group.country}
            </h3>
            <ul className="sale-list">
              {group.catalogues.map((cat) => {
                const subscribed = subs.sales.includes(cat.id)
                return (
                  <li
                    key={cat.id}
                    className={`sale-row${cat.is_active ? ' sale-row--active' : ''}`}
                  >
                    <span className="sale-row__type" title={cat.sale_type}>
                      {SALE_TYPE_ICONS[cat.sale_type] ?? '🔀'}
                    </span>
                    <div className="sale-row__main">
                      <div className="sale-row__name">
                        <a href={cat.url} target="_blank" rel="noreferrer">
                          {cat.name}
                        </a>
                        {cat.online && <span className="sale-badge sale-badge--online">Online</span>}
                      </div>
                      <div className="sale-row__meta">
                        {formatDateSpan(cat.start_date, cat.end_date)} ·{' '}
                        {cat.house_url ? (
                          <a href={cat.house_url} target="_blank" rel="noreferrer">
                            {cat.house}
                          </a>
                        ) : (
                          cat.house
                        )}{' '}
                        · {cat.sale_type}
                      </div>
                    </div>
                    <span
                      className={`sale-badge${
                        cat.is_active
                          ? ' sale-badge--live'
                          : cat.is_new
                            ? ' sale-badge--new'
                            : ''
                      }`}
                    >
                      {cat.status}
                    </span>
                    {cat.lots.length > 0 && (
                      <button className="btn-export" onClick={() => setLotsFor(cat)}>
                        {cat.lots.length} lots
                      </button>
                    )}
                    <button
                      className={`sale-row__subscribe${subscribed ? ' is-on' : ''}`}
                      aria-pressed={subscribed}
                      aria-label={
                        subscribed ? `Unsubscribe from ${cat.name}` : `Subscribe to ${cat.name}`
                      }
                      title={subscribed ? 'Subscribed — click to unsubscribe' : 'Subscribe to this sale'}
                      onClick={() => toggleSaleSub(cat)}
                    >
                      <Icon name="bell" size={17} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {feed && (
          <p className="livesales__storage-note">
            Source status: {feed.diagnostics.source_status}. Lot catalogues appear as the
            houses publish them; an empty count means not published yet.
          </p>
        )}
      </section>

      {lotsFor && (
        <LotsModal catalogue={lotsFor} watchedKeys={watchedKeys} onClose={() => setLotsFor(null)} />
      )}
    </div>
  )
}

interface SireSearchRow {
  sale: string
  lot_no: string
  horse: string
  sex: string
  sire: string
  dam: string
  dam_sire: string
  vendor: string
  _sire: boolean
  _damSire: boolean
}

function toSireRow(m: SireLotMatch): SireSearchRow {
  return {
    sale: m.catalogue.name,
    lot_no: m.lot.lot_no,
    horse: m.lot.horse_name,
    sex: m.lot.sex,
    sire: m.lot.sire,
    dam: m.lot.dam,
    dam_sire: m.lot.dam_sire,
    vendor: m.lot.vendor,
    _sire: m.matchedAsSire,
    _damSire: m.matchedAsDamSire,
  }
}

const muted = <span className="livesales__muted">—</span>

const sireSearchColumns: Column<SireSearchRow>[] = [
  { key: 'sale', header: 'Sale' },
  { key: 'lot_no', header: 'Lot', numeric: true },
  { key: 'horse', header: 'Horse', render: (r) => r.horse || muted },
  { key: 'sex', header: 'Sex' },
  {
    key: 'sire',
    header: 'Sire',
    render: (r) => (r._sire ? <mark className="sire-hit">{r.sire}</mark> : r.sire),
  },
  { key: 'dam', header: 'Dam' },
  {
    key: 'dam_sire',
    header: 'Dam Sire',
    render: (r) =>
      r._damSire ? <mark className="sire-hit">{r.dam_sire}</mark> : r.dam_sire || muted,
  },
  { key: 'vendor', header: 'Vendor', render: (r) => r.vendor || muted },
]

function LotsModal({
  catalogue,
  watchedKeys,
  onClose,
}: {
  catalogue: LiveCatalogue
  watchedKeys: Set<string>
  onClose: () => void
}) {
  const watched = (name: string) => watchedKeys.has(normalizeHorseName(name))
  const highlight = (name: string) =>
    name ? (
      <span className={watched(name) ? 'lot-sire--watched' : undefined}>{name}</span>
    ) : (
      ''
    )

  const columns: Column<LiveLot>[] = [
    { key: 'lot_no', header: 'Lot', numeric: true },
    { key: 'horse_name', header: 'Name' },
    { key: 'sex', header: 'Sex' },
    { key: 'colour', header: 'Colour' },
    { key: 'sire', header: 'Sire', render: (l) => highlight(l.sire) },
    { key: 'dam', header: 'Dam' },
    { key: 'dam_sire', header: 'Dam Sire', render: (l) => highlight(l.dam_sire) },
    { key: 'vendor', header: 'Vendor' },
  ]

  return (
    <Modal
      title={catalogue.name}
      subtitle={`${catalogue.house} · ${formatDateSpan(catalogue.start_date, catalogue.end_date)} · ${catalogue.lots.length} lots`}
      onClose={onClose}
    >
      <DataTable
        columns={columns}
        rows={catalogue.lots}
        searchable
        pageSize={25}
        exportFilename={`${catalogue.id.replace(/\|/g, '-')}-lots.csv`}
      />
    </Modal>
  )
}
