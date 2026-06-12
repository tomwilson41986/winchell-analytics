/**
 * Live Sales data layer: types mirroring pipeline/livesales/run.py's feed,
 * the runtime loader, and display helpers (country grouping, date spans).
 */
import { fetchJson } from './fetchData'

export interface LiveLot {
  lot_no: string
  horse_name: string
  sex: string
  colour: string
  sire: string
  dam: string
  dam_sire: string
  vendor: string
}

export interface LiveCatalogue {
  id: string
  house: string
  country: string
  name: string
  sale_type: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  is_new: boolean
  status: string
  url: string
  house_url: string
  online: boolean
  first_seen: string | null
  lots_error: string
  lots: LiveLot[]
}

export interface LiveSalesFeed {
  generated_at: string
  catalogues: LiveCatalogue[]
  diagnostics: { source_status: string }
}

export function loadLiveSales(): Promise<LiveSalesFeed> {
  return fetchJson<LiveSalesFeed>('/data/sales/live/live_sales.json')
}

/** Fixed country display order; unknown codes group last under "Other". */
export const COUNTRY_ORDER = ['UK', 'IRE', 'FR', 'DE', 'US', 'AUS', 'NZ']

export const COUNTRY_FLAGS: Record<string, string> = {
  UK: '🇬🇧',
  IRE: '🇮🇪',
  FR: '🇫🇷',
  DE: '🇩🇪',
  US: '🇺🇸',
  AUS: '🇦🇺',
  NZ: '🇳🇿',
}

export const SALE_TYPE_ICONS: Record<string, string> = {
  'Breeze Up': '⏱️',
  HIT: '🏇',
  'Foal / Weanling': '🍼',
  Broodmare: '♀️',
  Yearling: '🐎',
  Mixed: '🔀',
}

export interface CountryGroup {
  country: string
  flag: string
  catalogues: LiveCatalogue[]
}

/** Group an already-sorted feed by country in the fixed display order. */
export function groupByCountry(catalogues: LiveCatalogue[]): CountryGroup[] {
  const groups = new Map<string, LiveCatalogue[]>()
  for (const cat of catalogues) {
    const key = COUNTRY_ORDER.includes(cat.country) ? cat.country : 'Other'
    const list = groups.get(key) ?? []
    list.push(cat)
    groups.set(key, list)
  }
  return [...COUNTRY_ORDER, 'Other']
    .filter((c) => groups.has(c))
    .map((c) => ({ country: c, flag: COUNTRY_FLAGS[c] ?? '🌍', catalogues: groups.get(c)! }))
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function parseIso(iso: string): { d: number; m: number; y: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

/** Human date span: "6 – 8 Oct 2026", "2 Sep 2026" or "Date TBC". */
export function formatDateSpan(start: string | null, end: string | null): string {
  const s = start ? parseIso(start) : null
  if (!s) return 'Date TBC'
  const startLabel = `${s.d} ${MONTHS_SHORT[s.m - 1]} ${s.y}`
  const e = end ? parseIso(end) : null
  if (!e) return startLabel
  if (e.y === s.y && e.m === s.m) {
    return `${s.d} – ${e.d} ${MONTHS_SHORT[s.m - 1]} ${s.y}`
  }
  if (e.y === s.y) {
    return `${s.d} ${MONTHS_SHORT[s.m - 1]} – ${e.d} ${MONTHS_SHORT[e.m - 1]} ${s.y}`
  }
  return `${startLabel} – ${e.d} ${MONTHS_SHORT[e.m - 1]} ${e.y}`
}
