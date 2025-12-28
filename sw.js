const CACHE_NAME = 'directdrop-v2'; // Updated version to force cache refresh
const urlsToCache = [
  '/style.css',
  '/manifest.json'
  // Don't cache HTML/JS files - always fetch fresh from network
];

// Install Service Worker
self.addEventListener('install', (event) => {
  // Skip waiting to activate new service worker immediately
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - network-first for HTML/JS, cache-first for CSS/images
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first strategy for HTML and JavaScript files
  if (url.pathname.match(/\.(html|js)$/) || url.pathname === '/' || url.pathname.startsWith('/receive/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Don't cache HTML/JS files
          return response;
        })
        .catch(() => {
          // If network fails, try cache (offline fallback)
          return caches.match(event.request);
        })
    );
  } else {
    // Cache-first for other resources (CSS, images, etc.)
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request);
        })
    );
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  // Take control of all pages immediately
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Background Sync - Retry failed connections
self.addEventListener('sync', (event) => {
  if (event.tag === 'retry-connection') {
    event.waitUntil(retryFailedConnections());
  }
});

async function retryFailedConnections() {
  // Notify the main app to retry connection
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'RETRY_CONNECTION'
    });
  });
}

// Push notification handler
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Someone wants to send you a file!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'Open DirectDrop',
        icon: '/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('DirectDrop File Transfer', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Periodic background sync for updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-updates') {
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  // Check for app updates and refresh cache if needed
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();

    // Update critical files
    for (const request of requests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response);
        }
      } catch (error) {
        console.log('Failed to update:', request.url);
      }
    }
  } catch (error) {
    console.log('Update check failed:', error);
  }
}