import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CountryFlag from '../../../components/CountryFlag'
import DataTable, { type Column } from '../../../components/DataTable'
import Icon from '../../../components/Icon'
import Modal from '../../../components/Modal'
import PageHeader from '../../../components/PageHeader'
import SaleTypeIcon from '../../../components/SaleTypeIcon'
import StatTile from '../../../components/StatTile'
import { useAuth } from '../../../lib/auth'
import {
  COUNTRY_NAMES,
  formatDateSpan,
  groupByCountry,
  loadLiveSales,
  type LiveCatalogue,
  type LiveLot,
  type LiveSalesFeed,
} from '../../../lib/liveSales'
import {
  computeNotifications,
  findSireEntries,
  normalizeHorseName,
} from '../../../lib/saleSubscriptions'
import { accountsEnabled } from '../../../lib/supabaseClient'
import { useSubscriptions } from '../../../lib/useSubscriptions'
import '../../page.css'
import './LiveSales.css'

export default function LiveSales() {
  const [feed, setFeed] = useState<LiveSalesFeed | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [sireInput, setSireInput] = useState('')
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

  const submitSire = () => {
    if (!sireInput.trim()) return
    addSireSub(sireInput, feed)
    setSireInput('')
  }

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

      <section className="section" aria-label="Watched sires">
        <div className="section__head">
          <h2 className="section__title">Watch a sire or damsire</h2>
          <span className="section__note">
            Matches entries where the name appears as sire or as damsire / broodmare sire.
          </span>
        </div>
        <form
          className="sire-form"
          onSubmit={(e) => {
            e.preventDefault()
            submitSire()
          }}
        >
          <input
            className="sire-form__input"
            type="text"
            value={sireInput}
            onChange={(e) => setSireInput(e.target.value)}
            placeholder="e.g. Gun Runner"
            aria-label="Sire or damsire name"
          />
          <button className="btn-export" type="submit" disabled={!sireInput.trim()}>
            <Icon name="bell" size={15} /> Watch
          </button>
        </form>
        {subs.sires.length > 0 && (
          <ul className="sire-chips">
            {subs.sires.map((sire) => {
              const entryCount = feed
                ? findSireEntries(feed, sire).reduce((n, m) => n + m.lotNos.length, 0)
                : 0
              return (
                <li key={normalizeHorseName(sire)} className="sire-chip">
                  <span className="sire-chip__name">{sire}</span>
                  <span className="sire-chip__count">
                    {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
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
              <CountryFlag country={group.country} />
              {COUNTRY_NAMES[group.country] ?? group.country}
              <span className="country-group__count">
                {group.catalogues.length} {group.catalogues.length === 1 ? 'sale' : 'sales'}
              </span>
            </h3>
            <ul className="sale-list">
              {group.catalogues.map((cat) => {
                const subscribed = subs.sales.includes(cat.id)
                return (
                  <li
                    key={cat.id}
                    className={`sale-row${cat.is_active ? ' sale-row--active' : ''}`}
                  >
                    <SaleTypeIcon type={cat.sale_type} />
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
