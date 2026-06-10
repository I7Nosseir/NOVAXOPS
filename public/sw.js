const CACHE = 'novax-v2'

// Only cache true static assets — never URLs that involve auth redirects
const STATIC_ASSETS = [
  '/icon.svg',
  '/manifest.json',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== location.origin) return

  // Never intercept navigation requests — the middleware handles auth redirects
  // and the browser must follow them natively. Intercepting causes ERR_FAILED.
  if (event.request.mode === 'navigate') return

  // Never intercept API routes — always need fresh authenticated responses
  if (url.pathname.startsWith('/api/')) return

  // Cache-first for static assets only (images, fonts, icons)
  if (/\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(response => {
          if (response.ok) {
            const toCache = response.clone()
            caches.open(CACHE).then(cache => cache.put(event.request, toCache))
          }
          return response
        })
      })
    )
  }
  // All other requests: fall through to network (no SW interference)
})
