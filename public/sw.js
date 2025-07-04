const CACHE_NAME = 'buraq-cache-v2'; // Increment version on change
const urlsToCache = [
  '/',
  '/index.html',
  '/bundle.js',
  '/manifest.json',
  '/assets/icons/icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

// URLs that should be fetched from the network only
const networkOnlyUrls = [
  'https://lpxomioaloqfrueikjcc.supabase.co', // Supabase API
  'https://nominatim.openstreetmap.org', // Geocoding API
  'https://router.project-osrm.org', // Routing API
  'https://overpass-api.de' // POI API
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate worker immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Use no-cache to ensure we get the latest from network during install
        const cachePromises = urlsToCache.map((urlToCache) => {
            const request = new Request(urlToCache, {cache: 'reload'});
            return fetch(request).then(response => {
                // For cross-origin resources, we might get an opaque response.
                // We can cache it, but can't inspect it.
                if (response.status === 200 || response.type === 'opaque') {
                    return cache.put(urlToCache, response);
                }
                return Promise.reject('bad response: ' + response.status);
            });
        });
        return Promise.all(cachePromises);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ).then(() => {
        return self.clients.claim(); // Take control of all clients
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Network-only for API calls
  if (networkOnlyUrls.some(url => requestUrl.href.startsWith(url))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Stale-while-revalidate for app shell resources
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Check for valid network response before caching
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });

        // Return cached response immediately, and update cache in background
        return cachedResponse || fetchPromise;
      });
    })
  );
});
