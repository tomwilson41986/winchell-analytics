import { Link, useParams } from 'react-router-dom'
import PageHeader from '../../../components/PageHeader'
import StatTile from '../../../components/StatTile'
import {
  dayPath,
  type DigestDay as DigestDayMeta,
  type FlaggedRun,
  formatDate,
  INDEX_PATH,
  type ProspectsIndex,
  ratingBand,
} from '../../../lib/japanProspects'
import { ErrorBox, Loading } from './Async'
import ProspectCard from './ProspectCard'
import { useJson } from './useJson'
import '../../page.css'
import './japan.css'

/** A single day's digest — same content & order as that day's email. */
export default function DigestDay() {
  const { date = '' } = useParams()
  const index = useJson<ProspectsIndex>(INDEX_PATH)
  const day = useJson<FlaggedRun[]>(/^\d{4}-\d{2}-\d{2}$/.test(date) ? dayPath(date) : null)

  const runs = day.data ?? []
  const meta = index.data?.days.find((d) => d.date === date) as DigestDayMeta | undefined

  // Prev / next (chronological) for inter-day navigation.
  const sorted = index.data
    ? [...index.data.days].sort((a, b) => a.date.localeCompare(b.date))
    : []
  const pos = sorted.findIndex((d) => d.date === date)
  const prev = pos > 0 ? sorted[pos - 1] : undefined
  const next = pos >= 0 && pos < sorted.length - 1 ? sorted[pos + 1] : undefined

  const elite = runs.filter((r) => {
    const b = ratingBand(r.rating).band
    return b === 'elite' || b === 'black-type'
  }).length
  const topRating = runs.reduce((m, r) => Math.max(m, r.rating ?? 0), 0)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Daily Digest"
        title={date ? formatDate(date) : 'Digest'}
        icon="calendar"
        crumbs={[
          { to: '/broodmares', label: 'Broodmares' },
          { to: '/broodmares/japan-prospects', label: 'Japan Prospects' },
          { to: '/broodmares/japan-prospects/digests', label: 'Digests' },
          { to: `/broodmares/japan-prospects/digests/${date}`, label: date },
        ]}
        intro={`Flagged Japanese broodmare prospects for ${date ? formatDate(date) : 'this day'}.`}
      />

      {day.error ? (
        <ErrorBox message={day.error} />
      ) : day.loading || index.loading ? (
        <Loading label="Loading digest…" />
      ) : (
        <>
          <section className="section" aria-label="Summary">
            <div className="stat-grid">
              <StatTile label="Prospects flagged" value={String(runs.length)} />
              <StatTile label="Black-type+ (≥105)" value={String(elite)} pending={runs.length === 0} />
              <StatTile
                label="Top rating"
                value={topRating ? String(topRating) : '—'}
                pending={runs.length === 0}
              />
              {meta?.runsAnalysed != null ? (
                <StatTile label="Runs analysed" value={meta.runsAnalysed.toLocaleString()} />
              ) : null}
            </div>
          </section>

          <section className="section">
            {runs.length === 0 ? (
              <div className="digest-empty">
                <strong>No prospects met the criteria</strong>
                <span>
                  No female runners over 1400–2600m reached a house class rating of 90+ on this day.
                </span>
              </div>
            ) : (
              <div className="digest-list digest-list--2">
                {runs.map((run, i) => (
                  <ProspectCard key={`${run.horse_id ?? run.horse ?? 'p'}-${run.race_id ?? i}`} run={run} />
                ))}
              </div>
            )}
          </section>

          <nav className="prospect-card__links" aria-label="Adjacent days">
            {prev ? (
              <Link className="link-btn" to={`/broodmares/japan-prospects/digests/${prev.date}`}>
                ← {formatDate(prev.date)}
              </Link>
            ) : null}
            {next ? (
              <Link className="link-btn" to={`/broodmares/japan-prospects/digests/${next.date}`}>
                {formatDate(next.date)} →
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </div>
  )
}
