// This is a service worker file for PWA functionality

// Use a versioned cache name
const CACHE_NAME = "studycards-v1"

// List of assets to cache
const ASSETS_TO_CACHE = ["/", "/index.html", "/manifest.json", "/icon-192x192.png", "/icon-512x512.png"]

// Install event handler
self.addEventListener("install", (event) => {
  // Skip waiting to activate the new service worker immediately
  self.skipWaiting()

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Opened cache")
        return cache.addAll(ASSETS_TO_CACHE)
      })
      .catch((error) => {
        console.error("Failed to cache assets:", error)
      }),
  )
})

// Activate event handler
self.addEventListener("activate", (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName)
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )

  // Ensure the service worker takes control immediately
  return self.clients.claim()
})

// Fetch event handler with improved error handling
self.addEventListener("fetch", (event) => {
  // Only cache GET requests
  if (event.request.method !== "GET") return

  // Skip caching for certain URLs
  if (
    event.request.url.includes("/api/") ||
    event.request.url.includes("chrome-extension://") ||
    event.request.url.includes("extension://")
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if found
      if (response) {
        return response
      }

      // Otherwise fetch from network
      return fetch(event.request)
        .then((fetchResponse) => {
          // Don't cache non-successful responses
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== "basic") {
            return fetchResponse
          }

          // Cache important assets for offline use
          const responseToCache = fetchResponse.clone()

          caches
            .open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache)
            })
            .catch((error) => {
              console.error("Failed to cache response:", error)
            })

          return fetchResponse
        })
        .catch((error) => {
          console.error("Fetch failed:", error)

          // Return a fallback for offline experience
          if (event.request.url.includes(".html") || event.request.mode === "navigate") {
            return caches.match("/")
          }

          // For other resources, just let the error happen
          throw error
        })
    }),
  )
})

