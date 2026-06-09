export type IconName =
  | 'horseshoe'
  | 'tag'
  | 'crown'
  | 'pedigree'
  | 'globe'
  | 'chart'
  | 'arrow'
  | 'database'
  | 'spark'
  | 'search'
  | 'funnel'
  | 'menu'
  | 'close'
  | 'external'
  | 'calendar'
  | 'trophy'

interface IconProps {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}

const PATHS: Record<IconName, React.ReactNode> = {
  // Horseshoe — open-bottom arch with two nail holes
  horseshoe: (
    <>
      <path d="M6 21v-9a6 6 0 0 1 12 0v9" />
      <circle cx="8" cy="10" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  crown: (
    <>
      <path d="M3 8l4 4 5-7 5 7 4-4v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z" />
      <path d="M3 18h18" />
    </>
  ),
  pedigree: (
    <>
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="5.5" cy="19" r="2.2" />
      <circle cx="18.5" cy="19" r="2.2" />
      <path d="M12 7.2v3.3M12 10.5c0 2.5-6.5 2.5-6.5 6M12 10.5c0 2.5 6.5 2.5 6.5 6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v15a1 1 0 0 0 1 1h15" />
      <path d="M7 15l4-5 3 3 5-7" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
      <path d="M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
    </>
  ),
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  funnel: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
      <path d="M10 14.5V17M14 14.5V17M8 20h8M9 20a3 3 0 0 1 6 0" />
    </>
  ),
}

export default function Icon({
  name,
  size = 24,
  className,
  strokeWidth = 1.6,
}: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
