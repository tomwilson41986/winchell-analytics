import { Link } from 'react-router-dom'
import Icon from '../../../components/Icon'
import {
  ageSexText,
  distanceText,
  finishText,
  type FlaggedRun,
  preferJa,
  runIdentityKey,
  runName,
  secondary,
  titleCase,
} from '../../../lib/japanProspects'
import RatingBadge from './RatingBadge'

interface ProspectCardProps {
  run: FlaggedRun
  /** Stable key (horse_id || horse) used to link the card to the detail page. */
  detailKey?: string | null
}

/** One Sire/Dam/Trainer/Owner cell: Japanese with English beneath. */
function PedigreeItem({
  label,
  ja,
  romaji,
}: {
  label: string
  ja: string | null
  romaji: string | null
}) {
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

/**
 * A single flagged prospect, laid out like the daily email digest item:
 * rating badge, class/finish/distance/surface/age-sex chips, full pedigree
 * (Sire/Dam/Trainer/Owner with English beneath Japanese) and the
 * Profile & Form / Race Result links.
 */
export default function ProspectCard({ run, detailKey }: ProspectCardProps) {
  const name = runName(run)
  const romaji = secondary(run.horse, run.horse_romaji)
  const finish = finishText(run.finish_pos, run.field_size)
  const surface = (run.surface ?? '').trim().toLowerCase()
  const key = detailKey ?? (runIdentityKey(run) || null)

  return (
    <article className="prospect-card">
      <div className="prospect-card__top">
        <h3 className="prospect-card__name">
          {key ? (
            <Link to={`/broodmares/japan-prospects/prospect/${encodeURIComponent(key)}`}>
              {name}
            </Link>
          ) : (
            name
          )}
          {romaji ? <span className="prospect-card__romaji">{romaji}</span> : null}
        </h3>
        <RatingBadge rating={run.rating} />
      </div>

      <div className="prospect-card__chips">
        {run.class_label ? <span className="meta-chip">{run.class_label}</span> : null}
        {run.race_name ? <span className="meta-chip">{run.race_name}</span> : null}
        {finish ? (
          <span className="meta-chip">
            <Icon name="trophy" size={13} /> {finish}
          </span>
        ) : null}
        {run.distance_m != null ? (
          <span className="meta-chip">{distanceText(run.distance_m)}</span>
        ) : null}
        {surface ? (
          <span className={`meta-chip meta-chip--surface-${surface}`}>
            {titleCase(surface)}
          </span>
        ) : null}
        {ageSexText(run.age, run.sex) ? (
          <span className="meta-chip">{ageSexText(run.age, run.sex)}</span>
        ) : null}
        {run.track ? <span className="meta-chip">{run.track}</span> : null}
        {run.org ? <span className="meta-chip">{run.org.toUpperCase()}</span> : null}
      </div>

      <div className="pedigree">
        <PedigreeItem label="Sire" ja={run.sire} romaji={run.sire_romaji} />
        <PedigreeItem label="Dam" ja={run.dam} romaji={run.dam_romaji} />
        <PedigreeItem label="Trainer" ja={run.trainer} romaji={run.trainer_romaji} />
        <PedigreeItem label="Owner" ja={run.owner} romaji={run.owner_romaji} />
      </div>

      {run.profile_url || run.result_url ? (
        <div className="prospect-card__links">
          {run.profile_url ? (
            <a
              className="link-btn"
              href={run.profile_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="external" size={14} /> Profile &amp; Form
            </a>
          ) : null}
          {run.result_url ? (
            <a
              className="link-btn"
              href={run.result_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="external" size={14} /> Race Result
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
