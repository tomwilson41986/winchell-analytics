import { Link, useParams } from 'react-router-dom'
import Icon from '../../../components/Icon'
import PageHeader from '../../../components/PageHeader'
import StatTile from '../../../components/StatTile'
import {
  ageSexText,
  distanceText,
  finishText,
  type FlaggedRun,
  formatDate,
  type MasterProspect,
  MASTER_PATH,
  masterName,
  preferJa,
  PROSPECTS_PATH,
  type ProspectsByKey,
  runName,
  secondary,
  titleCase,
} from '../../../lib/japanProspects'
import { ErrorBox, Loading } from './Async'
import RatingBadge from './RatingBadge'
import { useJson } from './useJson'
import '../../page.css'
import './japan.css'

/** Sire/Dam/Trainer/Owner cell — Japanese with English beneath. */
function PedigreeItem({ label, ja, romaji }: { label: string; ja: string | null; romaji: string | null }) {
  const main = preferJa(ja, romaji)
  if (!main) return null
  const sub = secondary(ja, romaji)
  return (
    <div className="pedigree__item">
      <span className="pedigree__label">{label}</span>
      <span className="pedigree__value">
        {main}
        {sub ? <span className="pedigree__value-sub"> {sub}</span> : null}
      </span>
    </div>
  )
}

/** One flagged race in the mare's history. */
function RaceHistoryItem({ run }: { run: FlaggedRun }) {
  const finish = finishText(run.finish_pos, run.field_size)
  const surface = (run.surface ?? '').trim().toLowerCase()
  return (
    <article className="prospect-card">
      <div className="prospect-card__top">
        <h3 className="prospect-card__name" style={{ fontSize: '1.05rem' }}>
          {run.race_name || run.class_label || 'Flagged run'}
          {run.date ? (
            <span className="prospect-card__romaji">
              <Link to={`/broodmares/japan-prospects/digests/${run.date}`}>
                {formatDate(run.date)}
              </Link>
            </span>
          ) : null}
        </h3>
        <RatingBadge rating={run.rating} />
      </div>

      <div className="prospect-card__chips">
        {run.class_label ? <span className="meta-chip">{run.class_label}</span> : null}
        {finish ? (
          <span className="meta-chip">
            <Icon name="trophy" size={13} /> {finish}
          </span>
        ) : null}
        {run.distance_m != null ? (
          <span className="meta-chip">{distanceText(run.distance_m)}</span>
        ) : null}
        {surface ? (
          <span className={`meta-chip meta-chip--surface-${surface}`}>{titleCase(surface)}</span>
        ) : null}
        {run.track ? <span className="meta-chip">{run.track}</span> : null}
        {run.org ? <span className="meta-chip">{run.org.toUpperCase()}</span> : null}
        {run.official_rating != null ? (
          <span className="meta-chip">Official {run.official_rating}</span>
        ) : null}
      </div>

      {run.profile_url || run.result_url ? (
        <div className="prospect-card__links">
          {run.profile_url ? (
            <a className="link-btn" href={run.profile_url} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={14} /> Profile &amp; Form
            </a>
          ) : null}
          {run.result_url ? (
            <a className="link-btn" href={run.result_url} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={14} /> Race Result
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export default function ProspectDetail() {
  const { key: rawKey = '' } = useParams()
  const key = decodeURIComponent(rawKey)
  const prospects = useJson<ProspectsByKey>(PROSPECTS_PATH)
  const master = useJson<MasterProspect[]>(MASTER_PATH)

  const detail = prospects.data?.[key]
  const masterRow = master.data?.find((p) => p.key === key)

  // Appearances newest-first; representative identity prefers the master row,
  // falling back to the most recent appearance.
  const appearances = detail
    ? [...detail.appearances].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    : []
  const latest = appearances[0]

  const displayName = masterRow
    ? masterName(masterRow)
    : latest
      ? runName(latest)
      : key
  const romaji = masterRow
    ? secondary(masterRow.horse, masterRow.horse_romaji)
    : latest
      ? secondary(latest.horse, latest.horse_romaji)
      : ''

  const ident = {
    sire: masterRow?.sire ?? latest?.sire ?? null,
    sire_romaji: masterRow?.sire_romaji ?? latest?.sire_romaji ?? null,
    dam: masterRow?.dam ?? latest?.dam ?? null,
    dam_romaji: masterRow?.dam_romaji ?? latest?.dam_romaji ?? null,
    trainer: masterRow?.trainer ?? latest?.trainer ?? null,
    trainer_romaji: masterRow?.trainer_romaji ?? latest?.trainer_romaji ?? null,
    owner: masterRow?.owner ?? latest?.owner ?? null,
    owner_romaji: masterRow?.owner_romaji ?? latest?.owner_romaji ?? null,
  }

  const bestRating =
    masterRow?.best_rating ??
    (appearances.reduce((m, r) => Math.max(m, r.rating ?? 0), 0) || null)
  const bestDistance = masterRow?.best_distance_m ?? latest?.distance_m ?? null
  const lastSeen = masterRow?.last_seen ?? latest?.date ?? null
  const ageSex = latest ? ageSexText(latest.age, latest.sex) : ''

  const notFound = !prospects.loading && !master.loading && !detail && !masterRow

  return (
    <div className="page">
      <PageHeader
        eyebrow="Prospect"
        title={displayName}
        icon="pedigree"
        crumbs={[
          { to: '/broodmares', label: 'Broodmares' },
          { to: '/broodmares/japan-prospects', label: 'Japan Prospects' },
          { to: `/broodmares/japan-prospects/prospect/${encodeURIComponent(key)}`, label: displayName },
        ]}
        intro={romaji || undefined}
      />

      {prospects.error || master.error ? (
        <ErrorBox message={prospects.error ?? master.error ?? ''} />
      ) : prospects.loading || master.loading ? (
        <Loading label="Loading prospect…" />
      ) : notFound ? (
        <div className="digest-empty">
          <strong>Prospect not found</strong>
          <span>No flagged mare matches this key.</span>
          <Link className="link-btn" to="/broodmares/japan-prospects">
            ← Back to all prospects
          </Link>
        </div>
      ) : (
        <>
          <section className="section" aria-label="Summary">
            <div className="detail-hero">
              <RatingBadge rating={bestRating} className="detail-hero__rating" />
              {ageSex ? <span className="meta-chip">{ageSex}</span> : null}
            </div>
            <div className="stat-grid">
              <StatTile label="Best rating" value={bestRating != null ? String(bestRating) : '—'} />
              <StatTile
                label="Best distance"
                value={bestDistance != null ? distanceText(bestDistance) : '—'}
              />
              <StatTile label="Flagged runs" value={String(appearances.length)} />
              <StatTile label="Last seen" value={lastSeen ? formatDate(lastSeen) : '—'} />
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Pedigree &amp; connections</h2>
            </div>
            <div className="prospect-card">
              <div className="pedigree" style={{ borderTop: 'none', paddingTop: 0 }}>
                <PedigreeItem label="Sire" ja={ident.sire} romaji={ident.sire_romaji} />
                <PedigreeItem label="Dam" ja={ident.dam} romaji={ident.dam_romaji} />
                <PedigreeItem label="Trainer" ja={ident.trainer} romaji={ident.trainer_romaji} />
                <PedigreeItem label="Owner" ja={ident.owner} romaji={ident.owner_romaji} />
                {masterRow?.track ? (
                  <div className="pedigree__item">
                    <span className="pedigree__label">Track</span>
                    <span className="pedigree__value">{masterRow.track}</span>
                  </div>
                ) : null}
              </div>
              {latest?.profile_url ? (
                <div className="prospect-card__links">
                  <a
                    className="link-btn"
                    href={latest.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="external" size={14} /> Profile &amp; Form
                  </a>
                </div>
              ) : null}
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Flagged race history</h2>
              <span className="section__note">
                {appearances.length} flagged run{appearances.length === 1 ? '' : 's'}, newest first
              </span>
            </div>
            {appearances.length === 0 ? (
              <div className="digest-empty">
                <strong>No flagged runs recorded</strong>
                <span>This mare appears in the master list but has no per-run records yet.</span>
              </div>
            ) : (
              <div className="digest-list">
                {appearances.map((run, i) => (
                  <RaceHistoryItem key={`${run.race_id ?? run.date ?? 'r'}-${i}`} run={run} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
