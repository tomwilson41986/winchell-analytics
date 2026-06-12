/**
 * Designed line icons for the six sale-type buckets, replacing the emoji set
 * (inconsistent across platforms). Same stroke style as the site Icon set,
 * presented in a tinted tile with the type name as the tooltip.
 */
import './SaleTypeIcon.css'

export const SALE_TYPES = [
  'Breeze Up',
  'HIT',
  'Foal / Weanling',
  'Broodmare',
  'Yearling',
  'Mixed',
] as const

const PATHS: Record<string, React.ReactNode> = {
  // Stopwatch — two-year-olds breezing against the clock
  'Breeze Up': (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5l3.5-3.5M10 2.5h4M12 2.5v3.5M18.5 6.5l1.5 1.5" />
    </>
  ),
  // Race flag — horses in training / of racing age
  HIT: (
    <>
      <path d="M5 21V3.5" />
      <path d="M5 4h13.5l-2.8 4.25L18.5 12.5H5" />
      <path d="M9.5 4v8.5M14 4v8.5M5 8.25h13.5" />
    </>
  ),
  // Feeding bottle — foals and weanlings
  'Foal / Weanling': (
    <>
      <path d="M10 6V4.75a2 2 0 0 1 4 0V6" />
      <rect x="8.25" y="6" width="7.5" height="15" rx="2.5" />
      <path d="M8.25 11.5h7.5M8.25 16h7.5" />
    </>
  ),
  // Female symbol — broodmares and breeding stock
  Broodmare: (
    <>
      <circle cx="12" cy="9" r="5.75" />
      <path d="M12 14.75V22M8.5 18.5h7" />
    </>
  ),
  // Horseshoe — yearlings
  Yearling: (
    <>
      <path d="M6 21v-9a6 6 0 0 1 12 0v9" />
      <circle cx="8" cy="10" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  // Shuffle — mixed catalogues
  Mixed: (
    <>
      <path d="M3 7h4.5L17 17h4M3 17h4.5l2.6-2.9M13.9 9.9L17 7h4" />
      <path d="M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5" />
    </>
  ),
}

export default function SaleTypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  return (
    <span className="sale-type-icon" title={type} aria-label={type}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {PATHS[type] ?? PATHS.Mixed}
      </svg>
    </span>
  )
}
