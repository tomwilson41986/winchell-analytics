import { ratingBand } from '../../../lib/japanProspects'

interface RatingBadgeProps {
  rating: number | null | undefined
  /** Larger variant for detail/hero use. */
  className?: string
}

/**
 * House class-score badge (0–120). Colour bands match the email digest:
 * green (elite ≥115 / black-type ≥105), amber (stakes ≥95), grey otherwise.
 */
export default function RatingBadge({ rating, className }: RatingBadgeProps) {
  const { label, tone } = ratingBand(rating)
  return (
    <span
      className={`rating-badge rating-badge--${tone}${className ? ` ${className}` : ''}`}
      title={`House class rating ${rating ?? '—'} / 120`}
    >
      <span className="rating-badge__value">{rating ?? '—'}</span>
      <span className="rating-badge__band">{label}</span>
    </span>
  )
}
