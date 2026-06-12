/**
 * Client-side subscriptions for Live Sales.
 *
 * The site is fully static (no backend or user accounts), so subscriptions
 * live in this browser's localStorage. On every visit the current feed is
 * diffed against the snapshot taken when you last marked notifications read:
 * new catalogue entries for a subscribed sale, a subscribed sale going
 * active, and new entries by a subscribed sire / damsire all surface as
 * in-app notifications. Server-pushed email would need a backend.
 */
import type { LiveCatalogue, LiveSalesFeed } from './liveSales'

const STORAGE_KEY = 'winchell.liveSales.subscriptions.v1'

interface SaleSnapshot {
  lotCount: number
  active: boolean
}

export interface SubscriptionState {
  /** Subscribed sales, by catalogue id. */
  sales: string[]
  /** Subscribed sire / damsire / broodmare-sire names, as entered. */
  sires: string[]
  /** Last-acknowledged state, used to detect what is new since last visit. */
  saleSnapshots: Record<string, SaleSnapshot>
  sireCounts: Record<string, number>
}

export interface SaleNotification {
  id: string
  kind: 'sale-lots' | 'sale-active' | 'sire-entries'
  title: string
  detail: string
  saleId?: string
}

const EMPTY: SubscriptionState = {
  sales: [],
  sires: [],
  saleSnapshots: {},
  sireCounts: {},
}

export function loadSubscriptions(): SubscriptionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw)
    return {
      sales: Array.isArray(parsed.sales) ? parsed.sales : [],
      sires: Array.isArray(parsed.sires) ? parsed.sires : [],
      saleSnapshots: parsed.saleSnapshots ?? {},
      sireCounts: parsed.sireCounts ?? {},
    }
  } catch {
    return { ...EMPTY }
  }
}

export function saveSubscriptions(state: SubscriptionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable (private mode etc.) — subscriptions just won't persist.
  }
}

/** Names match ignoring case, punctuation and the "(GB)"-style suffix. */
export function normalizeHorseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([a-z]{2,4}\)\s*$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function lotMatchesSire(lot: { sire: string; dam_sire: string }, sireKey: string): boolean {
  return (
    normalizeHorseName(lot.sire) === sireKey ||
    normalizeHorseName(lot.dam_sire) === sireKey
  )
}

export interface SireMatch {
  catalogue: LiveCatalogue
  lotNos: string[]
}

/** All current entries by a sire (as sire or damsire) across the feed. */
export function findSireEntries(feed: LiveSalesFeed, sireName: string): SireMatch[] {
  const key = normalizeHorseName(sireName)
  if (!key) return []
  const matches: SireMatch[] = []
  for (const cat of feed.catalogues) {
    const lotNos = cat.lots.filter((l) => lotMatchesSire(l, key)).map((l) => l.lot_no)
    if (lotNos.length > 0) matches.push({ catalogue: cat, lotNos })
  }
  return matches
}

function countSireEntries(feed: LiveSalesFeed, sireName: string): number {
  return findSireEntries(feed, sireName).reduce((n, m) => n + m.lotNos.length, 0)
}

function saleSnapshot(cat: LiveCatalogue): SaleSnapshot {
  return { lotCount: cat.lots.length, active: cat.is_active }
}

export function toggleSale(state: SubscriptionState, cat: LiveCatalogue): SubscriptionState {
  if (state.sales.includes(cat.id)) {
    const { [cat.id]: _dropped, ...rest } = state.saleSnapshots
    return { ...state, sales: state.sales.filter((id) => id !== cat.id), saleSnapshots: rest }
  }
  // Baseline at subscribe time, so only *future* changes notify.
  return {
    ...state,
    sales: [...state.sales, cat.id],
    saleSnapshots: { ...state.saleSnapshots, [cat.id]: saleSnapshot(cat) },
  }
}

export function addSire(
  state: SubscriptionState,
  name: string,
  feed: LiveSalesFeed | null,
): SubscriptionState {
  const trimmed = name.trim()
  const key = normalizeHorseName(trimmed)
  if (!key) return state
  if (state.sires.some((s) => normalizeHorseName(s) === key)) return state
  return {
    ...state,
    sires: [...state.sires, trimmed],
    sireCounts: {
      ...state.sireCounts,
      [key]: feed ? countSireEntries(feed, trimmed) : 0,
    },
  }
}

export function removeSire(state: SubscriptionState, name: string): SubscriptionState {
  const key = normalizeHorseName(name)
  const { [key]: _dropped, ...rest } = state.sireCounts
  return {
    ...state,
    sires: state.sires.filter((s) => normalizeHorseName(s) !== key),
    sireCounts: rest,
  }
}

/** Diff the current feed against the acknowledged snapshots. */
export function computeNotifications(
  feed: LiveSalesFeed,
  state: SubscriptionState,
): SaleNotification[] {
  const notifications: SaleNotification[] = []
  const byId = new Map(feed.catalogues.map((c) => [c.id, c]))

  for (const saleId of state.sales) {
    const cat = byId.get(saleId)
    if (!cat) continue
    const before = state.saleSnapshots[saleId] ?? { lotCount: 0, active: false }
    if (cat.lots.length > before.lotCount) {
      const added = cat.lots.length - before.lotCount
      notifications.push({
        id: `sale-lots|${saleId}|${cat.lots.length}`,
        kind: 'sale-lots',
        title: cat.name,
        detail:
          before.lotCount === 0
            ? `Catalogue published — ${cat.lots.length} lots`
            : `${added} new ${added === 1 ? 'entry' : 'entries'} in the catalogue`,
        saleId,
      })
    }
    if (cat.is_active && !before.active) {
      notifications.push({
        id: `sale-active|${saleId}`,
        kind: 'sale-active',
        title: cat.name,
        detail: 'This sale is now active',
        saleId,
      })
    }
  }

  for (const sire of state.sires) {
    const key = normalizeHorseName(sire)
    const matches = findSireEntries(feed, sire)
    const count = matches.reduce((n, m) => n + m.lotNos.length, 0)
    const before = state.sireCounts[key] ?? 0
    if (count > before) {
      const sales = matches.map((m) => m.catalogue.name).join(', ')
      notifications.push({
        id: `sire-entries|${key}|${count}`,
        kind: 'sire-entries',
        title: sire,
        detail: `${count - before} new ${count - before === 1 ? 'entry' : 'entries'} (${sales})`,
        saleId: matches[0]?.catalogue.id,
      })
    }
  }

  return notifications
}

/** Mark everything read: snapshot the current feed state for next time. */
export function acknowledgeAll(
  feed: LiveSalesFeed,
  state: SubscriptionState,
): SubscriptionState {
  const byId = new Map(feed.catalogues.map((c) => [c.id, c]))
  const saleSnapshots = { ...state.saleSnapshots }
  for (const saleId of state.sales) {
    const cat = byId.get(saleId)
    if (cat) saleSnapshots[saleId] = saleSnapshot(cat)
  }
  const sireCounts = { ...state.sireCounts }
  for (const sire of state.sires) {
    sireCounts[normalizeHorseName(sire)] = countSireEntries(feed, sire)
  }
  return { ...state, saleSnapshots, sireCounts }
}
