/**
 * Subscription store hook for the Live Sales page.
 *
 * Signed out (or accounts unconfigured): subscriptions live in localStorage,
 * exactly as before. Signed in: the subscription *lists* are synced to the
 * user's Supabase profile (so the daily pipeline can push notifications),
 * with any existing in-browser subscriptions migrated up on first sign-in.
 * The "what have I already seen" snapshots powering in-app notifications
 * stay per-device in localStorage either way.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './auth'
import type { LiveCatalogue, LiveSalesFeed } from './liveSales'
import {
  acknowledgeAll,
  addSire,
  loadSubscriptions,
  normalizeHorseName,
  removeSire,
  saveSubscriptions,
  toggleSale,
  type SubscriptionState,
} from './saleSubscriptions'
import { supabase } from './supabaseClient'

export interface SubscriptionsApi {
  subs: SubscriptionState
  /** True while the signed-in user's subscriptions are being fetched. */
  syncing: boolean
  toggleSaleSub: (cat: LiveCatalogue) => void
  addSireSub: (name: string, feed: LiveSalesFeed | null) => void
  removeSireSub: (name: string) => void
  acknowledge: (feed: LiveSalesFeed) => void
}

export function useSubscriptions(): SubscriptionsApi {
  const { user } = useAuth()
  const [subs, setSubs] = useState<SubscriptionState>(loadSubscriptions)
  const [syncing, setSyncing] = useState(false)
  const syncedFor = useRef<string | null>(null)

  const persist = useCallback((next: SubscriptionState) => {
    setSubs(next)
    saveSubscriptions(next)
  }, [])

  // On sign-in: merge this browser's subscriptions into the account, then
  // adopt the account's lists as the source of truth.
  useEffect(() => {
    if (!user || !supabase || syncedFor.current === user.id) return
    syncedFor.current = user.id
    const client = supabase
    let cancelled = false

    const sync = async () => {
      setSyncing(true)
      try {
        const local = loadSubscriptions()
        if (local.sales.length > 0) {
          await client.from('sale_subscriptions').upsert(
            local.sales.map((id) => ({ user_id: user.id, catalogue_id: id })),
            { onConflict: 'user_id,catalogue_id' },
          )
        }
        if (local.sires.length > 0) {
          await client.from('sire_subscriptions').upsert(
            local.sires.map((name) => ({
              user_id: user.id,
              sire_key: normalizeHorseName(name),
              sire_name: name,
            })),
            { onConflict: 'user_id,sire_key' },
          )
        }
        const [salesRes, siresRes] = await Promise.all([
          client.from('sale_subscriptions').select('catalogue_id'),
          client.from('sire_subscriptions').select('sire_name'),
        ])
        if (cancelled || salesRes.error || siresRes.error) return
        const next: SubscriptionState = {
          ...loadSubscriptions(),
          sales: salesRes.data.map((r) => r.catalogue_id as string),
          sires: siresRes.data.map((r) => r.sire_name as string),
        }
        persist(next)
      } finally {
        if (!cancelled) setSyncing(false)
      }
    }
    void sync()
    return () => {
      cancelled = true
    }
  }, [user, persist])

  const toggleSaleSub = useCallback(
    (cat: LiveCatalogue) => {
      const wasSubscribed = subs.sales.includes(cat.id)
      persist(toggleSale(subs, cat))
      if (user && supabase) {
        const table = supabase.from('sale_subscriptions')
        void (wasSubscribed
          ? table.delete().eq('user_id', user.id).eq('catalogue_id', cat.id)
          : table.upsert(
              { user_id: user.id, catalogue_id: cat.id, sale_name: cat.name },
              { onConflict: 'user_id,catalogue_id' },
            ))
      }
    },
    [subs, user, persist],
  )

  const addSireSub = useCallback(
    (name: string, feed: LiveSalesFeed | null) => {
      const next = addSire(subs, name, feed)
      if (next === subs) return
      persist(next)
      if (user && supabase) {
        void supabase.from('sire_subscriptions').upsert(
          {
            user_id: user.id,
            sire_key: normalizeHorseName(name),
            sire_name: name.trim(),
          },
          { onConflict: 'user_id,sire_key' },
        )
      }
    },
    [subs, user, persist],
  )

  const removeSireSub = useCallback(
    (name: string) => {
      persist(removeSire(subs, name))
      if (user && supabase) {
        void supabase
          .from('sire_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('sire_key', normalizeHorseName(name))
      }
    },
    [subs, user, persist],
  )

  const acknowledge = useCallback(
    (feed: LiveSalesFeed) => persist(acknowledgeAll(feed, subs)),
    [subs, persist],
  )

  return { subs, syncing, toggleSaleSub, addSireSub, removeSireSub, acknowledge }
}
