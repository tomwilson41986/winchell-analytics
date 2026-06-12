/**
 * Small SVG country flags for the sales listing. Drawn inline (simplified but
 * recognisable) rather than emoji because Windows renders flag emoji as bare
 * letter pairs. Unknown countries fall back to a neutral globe tile.
 */
import './CountryFlag.css'

interface CountryFlagProps {
  country: string
  /** Width in px; height follows the 3:2 ratio. */
  size?: number
}

/** Union Jack, drawn into a w×h box (reused as the AUS/NZ canton). */
function UnionJack({ w, h }: { w: number; h: number }) {
  return (
    <g>
      <rect width={w} height={h} fill="#012169" />
      <path d={`M0 0L${w} ${h}M${w} 0L0 ${h}`} stroke="#fff" strokeWidth={h / 5} />
      <path d={`M0 0L${w} ${h}M${w} 0L0 ${h}`} stroke="#C8102E" strokeWidth={h / 10} />
      <path d={`M${w / 2} 0V${h}M0 ${h / 2}H${w}`} stroke="#fff" strokeWidth={h / 3.2} />
      <path d={`M${w / 2} 0V${h}M0 ${h / 2}H${w}`} stroke="#C8102E" strokeWidth={h / 5.5} />
    </g>
  )
}

function Stars({ points, fill = '#fff' }: { points: [number, number, number][]; fill?: string }) {
  return (
    <g>
      {points.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={fill} />
      ))}
    </g>
  )
}

const FLAGS: Record<string, React.ReactNode> = {
  UK: <UnionJack w={60} h={40} />,
  IRE: (
    <g>
      <rect width="20" height="40" fill="#169B62" />
      <rect x="20" width="20" height="40" fill="#fff" />
      <rect x="40" width="20" height="40" fill="#FF883E" />
    </g>
  ),
  FR: (
    <g>
      <rect width="20" height="40" fill="#002395" />
      <rect x="20" width="20" height="40" fill="#fff" />
      <rect x="40" width="20" height="40" fill="#ED2939" />
    </g>
  ),
  DE: (
    <g>
      <rect width="60" height="13.4" fill="#000" />
      <rect y="13.3" width="60" height="13.4" fill="#DD0000" />
      <rect y="26.6" width="60" height="13.4" fill="#FFCE00" />
    </g>
  ),
  US: (
    <g>
      <rect width="60" height="40" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 40) / 13} width="60" height={40 / 13} fill="#B22234" />
      ))}
      <rect width="26" height={(40 / 13) * 7} fill="#3C3B6E" />
      <Stars
        points={[
          [5, 5, 1.4], [13, 5, 1.4], [21, 5, 1.4],
          [9, 11, 1.4], [17, 11, 1.4],
          [5, 17, 1.4], [13, 17, 1.4], [21, 17, 1.4],
        ]}
      />
    </g>
  ),
  AUS: (
    <g>
      <rect width="60" height="40" fill="#012169" />
      <g transform="scale(0.5)">
        <UnionJack w={60} h={40} />
      </g>
      <Stars
        points={[
          [15, 31, 2.6], // Commonwealth star
          [45, 8, 1.8], [52, 16, 1.8], [38, 18, 1.8], [47, 27, 1.8], [42, 33, 1.3],
        ]}
      />
    </g>
  ),
  NZ: (
    <g>
      <rect width="60" height="40" fill="#012169" />
      <g transform="scale(0.5)">
        <UnionJack w={60} h={40} />
      </g>
      <Stars
        points={[
          [45, 9, 2.4], [52, 17, 2.4], [38, 17, 2.4], [45, 27, 2.4],
        ]}
        fill="#fff"
      />
      <Stars
        points={[
          [45, 9, 1.5], [52, 17, 1.5], [38, 17, 1.5], [45, 27, 1.5],
        ]}
        fill="#CC142B"
      />
    </g>
  ),
}

export default function CountryFlag({ country, size = 21 }: CountryFlagProps) {
  const flag = FLAGS[country]
  return (
    <span className="flag" style={{ width: size, height: (size * 2) / 3 }}>
      {flag ? (
        <svg
          width={size}
          height={(size * 2) / 3}
          viewBox="0 0 60 40"
          role="img"
          aria-label={`${country} flag`}
        >
          {flag}
        </svg>
      ) : (
        <svg
          width={size}
          height={(size * 2) / 3}
          viewBox="0 0 60 40"
          role="img"
          aria-label={country}
        >
          <rect width="60" height="40" fill="#e8e2e2" />
          <circle cx="30" cy="20" r="12" fill="none" stroke="#8a7f7f" strokeWidth="2.5" />
          <path
            d="M18 20h24M30 8c5 6 5 18 0 24c-5-6-5-18 0-24z"
            fill="none"
            stroke="#8a7f7f"
            strokeWidth="2.5"
          />
        </svg>
      )}
    </span>
  )
}
