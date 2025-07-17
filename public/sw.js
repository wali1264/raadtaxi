const CACHE_NAME = 'buraq-cache-v2'; // Increment version on change
const urlsToCache = [
  '/',
  '/index.html',
  '/bundle.js',
  '/manifest.json',
  '/assets/ra-ad-logo.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

// URLs that should be fetched from the network only
const networkOnlyUrls = [
  'https://lpxomioaloqfrueikjcc.supabase.co', // Supabase API
  'https://nominatim.openstreetmap.org', // Geocoding API
  'https://router.project-osrm.org', // Routing API
  'https://overpass-api.de' // POI API
];

// Sound for notifications, embedded as a data URI for offline reliability
const NOTIFICATION_SOUND_URI = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSBvT18DAAAAAQABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5enx9fn+AgYKDhIWGh4iJiouMjY6PkJGSj5OTlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8AAQACAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6fH1+f4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfa2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AAUAAAADAAAAAAAAAAUAAAAAAAAABgAAAAQAAAAAAAAABwAAAAUAAAAAAAAACAAAAAYAAAAAAAAACQAAAAcAAAAAAAAACgAAAAgAAAAAAAAACwAAAAkAAAAAAAAADAAAAAoAAAAAAAAADQAAAAsAAAAAAAAADgAAAAwAAAAAAAAADwAAAA0AAAAAAAAAEAAAAA4AAAAAAAAAEQAAABAAAAAAAAAAEgAAABEAAAAAAAAAEwAAABIAAAAAAAAAFAAAABMAAAAAAAAABQAAABEAAAANAAAAAwAAAAcAAAANAAAAEwAAABcAAAAZAAAAGgAAABYAAAAQAAAADgAAAAgAAAADAAAAAwAAAAgAAAANAAAAEQAAABQAAAAVAAAAFQAAABQAAAARAAAADQAAAAcAAAADAAAAAwAAAAgAAAANAAAAEQAAABQAAAAVAAAAFQAAABQAAAARAAAADQAAAAgAAAAFAAAAAQAAAAQAAAALAAAAEQAAABUAAAAWAAAAFgAAABUAAAARAAAACwAAAAQAAAABAAAABQAAAAgAAAANAAAAEQAAABQAAAAVAAAAFQAAABQAAAARAAAADQAAAAgAAAAEAAAAAQAAAAYAAAAJAAAADAAAAA0AAAANAAAADAAAAAkAAAAEAAAAAgAAAAUAAAAHAAAACQAAAAsAAAALAAAACQAAAAcAAAAEAAAAAQAAAAMAAAAFAAAABgAAAAcAAAAIAAAACAAAAAcAAAAFAAAAAwAAAAIAAAACAAAAAwAAAAMAAAADAAAAAwAAAAMAAAACAAAAAgAAAAIAAAACAAAAAgAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABQ=='.replace(/\s/g, '');


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

  // Strategy for API calls: Network-Only.
  // This ensures that we always try to get the freshest data for API requests.
  if (networkOnlyUrls.some(url => requestUrl.href.startsWith(url))) {
    event.respondWith(
      // Simply fetch the request from the network.
      // We add a .catch() to handle cases where the network is unavailable.
      fetch(event.request)
        .catch(error => {
          // The fetch failed, likely due to a network error.
          // This could be because the user is offline.
          // We must return a Response object to fulfill the event.
          console.error('Service Worker: Fetch failed for network-only resource:', event.request.url, error);
          // Return a synthetic error response. The client-side code will see this as a failed request.
          return new Response(JSON.stringify({ message: 'Network error: The service worker could not connect to the network.' }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Strategy for App Shell (Stale-While-Revalidate).
  // This serves assets from the cache first for speed, then updates the cache from the network.
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

        // Return cached response immediately if available, otherwise wait for the network.
        // The network fetch will happen in the background to update the cache.
        return cachedResponse || fetchPromise;
      });
    })
  );
});


self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    console.error('Error parsing push notification payload:', e);
    payload = {
      title: 'درخواست جدید',
      body: 'یک مسافر منتظر شماست',
    };
  }

  const title = payload.title || 'درخواست سفر جدید';
  const options = {
    body: payload.body || 'یک مسافر منتظر شماست.',
    icon: payload.icon || '/assets/ra-ad-logo.png',
    badge: '/assets/ra-ad-logo.png',
    vibrate: [200, 100, 200, 100, 200],
    sound: NOTIFICATION_SOUND_URI, // Use embedded sound for reliability
    data: {
      url: self.location.origin, // URL to open on click
    },
    actions: [
      { action: 'explore', title: 'مشاهده جزئیات' },
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received.');

  event.notification.close();

  const urlToOpen = event.notification.data.url || self.location.origin;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // If a window for the app is already open, focus it.
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});