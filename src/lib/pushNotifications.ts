/**
 * Web Push opt-in, per device and per signed-in user.
 *
 * The browser's push subscription (endpoint + keys) is stored against the
 * user in Supabase; the daily live-sales pipeline reads those rows and sends
 * pushes via the Web Push protocol (VAPID). Requires the site to expose the
 * VAPID *public* key as VITE_VAPID_PUBLIC_KEY (the private key lives only in
 * the pipeline's secrets).
 *
 * Note: iOS Safari only delivers Web Push to sites added to the Home Screen.
 */
import { supabase } from './supabaseClient'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushStatus =
  | 'enabled' // this device pushes to this account
  | 'disabled' // supported, not enabled
  | 'denied' // user blocked notifications in the browser
  | 'unsupported' // browser lacks service worker / Push API
  | 'unconfigured' // no VAPID public key on this deployment

export function pushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && supabase)
}

function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalized)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushConfigured()) return 'unconfigured'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return (await currentSubscription()) ? 'enabled' : 'disabled'
}

/** Ask permission, subscribe this browser and store the endpoint. */
export async function enablePush(userId: string): Promise<PushStatus> {
  if (!pushConfigured() || !supabase) return 'unconfigured'
  if (!pushSupported()) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!).buffer as ArrayBuffer,
    }))

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    await subscription.unsubscribe()
    throw new Error(error.message)
  }
  return 'enabled'
}

/** Unsubscribe this browser and remove its stored endpoint. */
export async function disablePush(): Promise<PushStatus> {
  const subscription = await currentSubscription()
  if (subscription) {
    if (supabase) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
    }
    await subscription.unsubscribe()
  }
  return 'disabled'
}
