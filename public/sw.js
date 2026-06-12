/* Service worker: shows Web Push notifications sent by the live-sales
 * pipeline and focuses/opens the relevant page on click. */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Winchell Analytics', {
      body: data.body || '',
      icon: '/winchell-silks.png',
      badge: '/winchell-silks.png',
      tag: data.tag || 'live-sales',
      data: { url: data.url || '/sales/live' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/sales/live'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    }),
  )
})
