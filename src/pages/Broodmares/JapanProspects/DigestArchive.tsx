import { Link } from 'react-router-dom'
import PageHeader from '../../../components/PageHeader'
import { formatDate, INDEX_PATH, type ProspectsIndex } from '../../../lib/japanProspects'
import { ErrorBox, Loading } from './Async'
import { useJson } from './useJson'
import '../../page.css'
import './japan.css'

/** Browsable index of daily digests — one entry per day, newest first. */
export default function DigestArchive() {
  const { data, error, loading } = useJson<ProspectsIndex>(INDEX_PATH)
  const days = data ? [...data.days].sort((a, b) => b.date.localeCompare(a.date)) : []

  return (
    <div className="page">
      <PageHeader
        eyebrow="Japan Prospects"
        title="Daily Digest Archive"
        icon="calendar"
        crumbs={[
          { to: '/broodmares', label: 'Broodmares' },
          { to: '/broodmares/japan-prospects', label: 'Japan Prospects' },
          { to: '/broodmares/japan-prospects/digests', label: 'Digests' },
        ]}
        intro="One page per day, mirroring the daily digest email. Pick a date to see every prospect flagged that day."
      />

      {error ? (
        <ErrorBox message={error} />
      ) : loading ? (
        <Loading label="Loading digest archive…" />
      ) : days.length === 0 ? (
        <div className="digest-empty">
          <strong>No digests yet</strong>
          <span>The daily job will add a page here for each run, including empty days.</span>
        </div>
      ) : (
        <section className="section">
          <div className="day-grid">
            {days.map((d) => (
              <Link
                key={d.date}
                to={`/broodmares/japan-prospects/digests/${d.date}`}
                className="day-card"
              >
                <span className="day-card__date">{formatDate(d.date)}</span>
                <span
                  className={`day-card__count${d.count === 0 ? ' day-card__count--zero' : ''}`}
                >
                  {d.count === 0
                    ? 'No prospects'
                    : `${d.count} prospect${d.count === 1 ? '' : 's'}`}
                </span>
                {d.runsAnalysed != null ? (
                  <span className="section__note tnum">
                    {d.runsAnalysed.toLocaleString()} runs analysed
                    {d.racesCovered != null ? ` · ${d.racesCovered} races` : ''}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
