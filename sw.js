const CACHE_NAME = 'PodMail-vec059b0';
const urlsToCache = [
	'/',
	'/?v=ec059b0',
	'/index.html?v=ec059b0',
	'/css/app.css?v=ec059b0',
	'/css/supports.css?v=ec059b0',
	'/js/app.js?v=ec059b0',
	'/js/esi.js?v=ec059b0',
	'/js/SimpleESI.js?v=ec059b0',
	'/favicon.ico?v=ec059b0',
	'/README.md?v=ec059b0'
];

// Install: cache all core files and activate immediately
self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
	);
	self.skipWaiting(); // Activate new service worker immediately
});

// Fetch: cache first for instant performance, update in background
self.addEventListener('fetch', event => {
	// Only handle same-origin GET requests
	if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) {
		return;
	}

	// Navigation requests: network-first with cache fallback
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request)
				.then(networkResponse => {
					if (networkResponse && networkResponse.ok) {
						const responseToCache = networkResponse.clone();
						caches.open(CACHE_NAME).then(cache => {
							cache.put(event.request, responseToCache).catch(err => {
								console.warn('Failed to cache navigation:', err);
							});
						});
					}
					return networkResponse;
				})
				.catch(() => {
					return caches.match('/index.html?v=ec059b0')
						.then(cached => cached || new Response('Offline', { status: 503 }));
				})
		);
		return;
	}

	// Static assets: cache-first with background update (stale-while-revalidate)
	event.respondWith(
		caches.match(event.request).then(cached => {
			// Start network fetch in background
			const fetchPromise = fetch(event.request)
				.then(networkResponse => {
					if (networkResponse && networkResponse.ok) {
						const responseToCache = networkResponse.clone();
						caches.open(CACHE_NAME).then(cache => {
							cache.put(event.request, responseToCache).catch(err => {
								console.warn('Failed to cache asset:', err);
							});
						});
					}
					return networkResponse;
				})
				.catch(() => null);

			// Return cached version immediately if available
			// Otherwise wait for network
			return cached || fetchPromise || new Response('Offline', { status: 503 });
		})
	);
});

// Activate: remove old caches and take control immediately
self.addEventListener('activate', event => {
	const currentVersion = 'ec059b0';
	
	event.waitUntil(
		Promise.all([
			// Remove old cache versions
			caches.keys().then(cacheNames => {
				return Promise.all(
					cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
				);
			}),
			// Clean up cached entries not matching current version
			caches.open(CACHE_NAME).then(cache => {
				return cache.keys().then(requests => {
					return Promise.all(
						requests.map(request => {
							const url = new URL(request.url);
							const versionParam = url.searchParams.get('v');
							
							// Delete if it has a version param that doesn't match current version
							if (versionParam && versionParam !== currentVersion) {
								return cache.delete(request);
							}
						})
					);
				});
			})
		])
	);
	self.clients.claim(); // Take control of all pages immediately
});
