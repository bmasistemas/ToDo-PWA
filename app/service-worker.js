var cacheName = 'todoPWA-v2'
var dataCacheName = 'todoData-v1'

var filesToCache = [
  '/',
  '/index.html',
  '/js/angular.min.js',
  '/js/app.js',
  '/images/ic_add_white_24px.svg',
  '/images/ic_refresh_white_24px.svg'
]

self.addEventListener('install', function (event) {
  // console.log('[Service Worker] Install')
  event.waitUntil(
    caches.open(cacheName).then(function (cache) {
      // console.log('[Service Worker] Caching app shell')
      return cache.addAll(filesToCache)
    })
  )
})

self.addEventListener('activate', function (event) {
  // console.log('[Service Worker] Activate')
  event.waitUntil(
    caches.keys().then(function (keyList) {
      return Promise.all(keyList.map(function (key) {
        if (key !== cacheName && key !== dataCacheName) {
          // console.log('[Service Worker] Removing old cache', key)
          return caches.delete(key)
        }
      }))
    })
  )
  return self.clients.claim()
})

self.addEventListener('fetch', function (event) {
  // console.log('[Service Worker] Fetch', event.request.method, event.request.url)
  var dataUrl = 'https://test.fumasa.org/api'
  if (event.request.method === 'GET' && event.request.url.indexOf(dataUrl) > -1) {
    event.respondWith(
      caches.open(dataCacheName).then(function (cache) {
        return fetch(event.request).then(function (response) {
          cache.put(event.request.url, response.clone())
          // console.log('data cached: ' + event.request.url)
          return response
        })
      })
    )
  } else {
    event.respondWith(
      caches.match(event.request).then(function (response) {
        return response || fetch(event.request)
      })
    )
  }
})
