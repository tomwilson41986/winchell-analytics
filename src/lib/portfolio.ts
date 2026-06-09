/**
 * Portfolio data layer: types mirroring the pipeline's pydantic schema, runtime
 * loaders for the generated JSON, and display formatters.
 *
 * Missing values are surfaced as "no data found" by the formatters here —
 * never a fabricated placeholder.
 */
import { fetchJson } from './fetchData'

// --- Types (mirror pipeline/schema.py) ------------------------------------ //

export interface PedigreeNode {
  name: string | null
  year_of_birth: number | null
  country: string | null
}

export interface Pedigree {
  sire: PedigreeNode | null
  dam: PedigreeNode | null
  damsire: PedigreeNode | null
  extended: Record<string, PedigreeNode>
  inbreeding: string[]
}

export interface SaleRecord {
  sale_house: string | null
  sale_name: string | null
  sale_date: string | null
  lot: string | null
  price: number | null
  currency: string | null
  buyer: string | null
  consignor: string | null
  rfna: boolean
}

export interface RaceResult {
  race_date: string | null
  track: string | null
  race_name: string | null
  surface: string | null
  distance_furlongs: number | null
  going: string | null
  grade: string | null
  finish_position: number | null
  field_size: number | null
  margin: string | null
  jockey: string | null
  trainer: string | null
  earnings: number | null
  currency: string | null
  speed_figure: number | null
  comment: string | null
}

export interface FormSummary {
  starts: number
  wins: number
  seconds: number
  thirds: number
  total_earnings: number | null
  currency: string | null
  black_type_wins: number
  graded_wins: number
  last_run: string | null
  form_string: string | null
}

export interface Scores {
  earnings_per_start: number | null
  win_strike_rate: number | null
  place_strike_rate: number | null
  best_speed_figure: number | null
  class_trajectory: 'rising' | 'flat' | 'falling' | null
  black_type: boolean
  value_flag: string | null
}

export interface HorseProfile {
  horse_id: string
  name: string
  year_of_birth: number | null
  sex: string | null
  colour: string | null
  country: string | null
  breeder: string | null
  current_trainer: string | null
  ownership_note: string | null
  status: string | null
  pedigree: Pedigree | null
  sales: SaleRecord[]
  form: FormSummary | null
  results: RaceResult[]
  scores: Scores | null
  sources: string[]
  last_updated: string | null
}

export interface PortfolioCard {
  horse_id: string
  name: string
  sire: string | null
  dam: string | null
  trainer: string | null
  status: string | null
  starts: number
  wins: number
  total_earnings: number | null
  currency: string | null
  black_type: boolean
  value_flag: string | null
}

export interface PortfolioRollup {
  generated_at: string
  horse_count: number
  active_count: number
  total_earnings: number | null
  currency: string | null
  graded_winners: number
  black_type_winners: number
  horses: PortfolioCard[]
}

// --- Loaders -------------------------------------------------------------- //

const BASE = '/data/portfolio'

export function loadPortfolio(): Promise<PortfolioRollup> {
  return fetchJson<PortfolioRollup>(`${BASE}/portfolio.json`)
}

export function loadProfile(horseId: string): Promise<HorseProfile> {
  return fetchJson<HorseProfile>(`${BASE}/profiles/${horseId}.json`)
}

// --- Formatters ----------------------------------------------------------- //

/** The single placeholder used everywhere a value is genuinely absent. */
export const NO_DATA = 'no data found'

/** Format an integer amount as currency (USD default), or the no-data tag. */
export function money(value: number | null | undefined, currency = 'USD'): string {
  if (value == null) return NO_DATA
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

/** Format a 0–1 ratio as a percentage, or the no-data tag. */
export function pct(value: number | null | undefined, digits = 0): string {
  if (value == null) return NO_DATA
  return `${(value * 100).toFixed(digits)}%`
}

/** Return the value as a string, or the no-data tag when empty. */
export function orDash(value: unknown): string {
  if (value == null || value === '') return NO_DATA
  return String(value)
}

/** Title-case a source name that arrives in caps (e.g. "CANDY RIDE"). */
export function titleCase(value: string | null | undefined): string {
  if (!value) return NO_DATA
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
}
