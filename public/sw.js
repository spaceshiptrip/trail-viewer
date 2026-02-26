// Trail Explorer Service Worker
// Handles offline map tile caching

const CACHE_VERSION = 'v1';
const TILE_CACHE = 'trail-explorer-tiles-v1';
const APP_CACHE = 'trail-explorer-app-v1';

// Tile URL patterns to intercept and cache
const TILE_PATTERNS = [
  /tile\.openstreetmap\.org/,
  /tile-cyclosm\.openstreetmap\.fr/,
  /tile\.thunderforest\.com/,
  /tile\.tracestrack\.com/,
];

// Install event - cache the app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => {
      // Cache app shell for offline use
      return cache.addAll([
        '/',
        '/index.html',
      ]).catch(err => {
        console.warn('[SW] Failed to cache app shell:', err);
      });
    })
  );
  
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old caches
          if (cacheName.startsWith('trail-explorer-') && 
              cacheName !== TILE_CACHE && 
              cacheName !== APP_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Take control immediately
  return self.clients.claim();
});

// Fetch event - intercept network requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Check if request is for a map tile
  const isTile = TILE_PATTERNS.some(pattern => pattern.test(url.href));
  
  if (isTile) {
    // Handle map tile requests
    event.respondWith(handleTileRequest(event.request));
  } else {
    // Handle other requests (app files, API calls, etc.)
    event.respondWith(handleAppRequest(event.request));
  }
});

// Handle map tile requests - Cache First strategy
async function handleTileRequest(request) {
  const cache = await caches.open(TILE_CACHE);
  
  try {
    // Try cache first
    const cached = await cache.match(request);
    if (cached) {
      // console.log('[SW] ✅ Tile from cache:', new URL(request.url).pathname);
      return cached;
    }
    
    // Not in cache, fetch from network
    // console.log('[SW] 🌐 Fetching tile:', new URL(request.url).pathname);
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      cache.put(request, response.clone());
      // console.log('[SW] 💾 Cached tile:', new URL(request.url).pathname);
    }
    
    return response;
    
  } catch (error) {
    console.error('[SW] ❌ Tile fetch failed:', error);
    
    // Try to serve from cache as fallback
    const cached = await cache.match(request);
    if (cached) {
      console.log('[SW] 📦 Serving stale tile from cache');
      return cached;
    }
    
    // Return offline placeholder
    return new Response('Offline - Tile not cached', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Handle app requests - Network First for fresh data
async function handleAppRequest(request) {
  try {
    // Try network first for app files
    const response = await fetch(request);
    
    // Cache successful responses for offline use
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(APP_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
    
  } catch (error) {
    // Network failed, try cache
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Serving from app cache:', request.url);
      return cached;
    }
    
    // Nothing in cache, return error
    return new Response('Offline and not cached', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      getCacheSize().then(size => {
        event.ports[0].postMessage({ size });
      })
    );
  }
});

// Helper: Calculate cache size
async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }
  
  return totalSize;
}

console.log('[SW] Service Worker loaded');
