const CACHE_NAME = 'PodMail-v--hash--';
const NETWORK_TIMEOUT = 3000; // 3 seconds before falling back to cache

const urlsToCache = [
	'/',
	'/?v=--hash--',
	'/index.html?v=--hash--',
	'/404.html?v=--hash--',
	'/auth.html?v=--hash--',
	'/css/app.css?v=--hash--',
	'/css/supports.css?v=--hash--',
	'/js/app.js?v=--hash--',
	'/js/esi.js?v=--hash--',
	'/js/SimpleESI.js?v=--hash--',
	'/favicon.ico?v=--hash--',
	'/README.md?v=--hash--',
	'/img/github.svg?v=--hash--',
	'/img/podmail.png?v=--hash--',
	'/img/ssologin.png?v=--hash--',
	'/img/character.jpg?v=--hash--',
	// CDN resources for offline functionality
	'https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/css/bootstrap.min.css',
	'https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/js/bootstrap.bundle.min.js',
	'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css',
	'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.min.js',
	'https://cdn.jsdelivr.net/npm/marked@15.0.6/marked.min.js',
	'https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js'
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
	// Skip non-GET requests
	if (event.request.method !== 'GET') {
		return;
	}

	// CDN requests: cache-first (CDN resources rarely change)
	const isCDN = event.request.url.startsWith('https://cdn.jsdelivr.net');
	if (isCDN) {
		event.respondWith(
			caches.match(event.request).then(cached => {
				return cached || fetch(event.request, { mode: 'cors' })
					.then(response => {
						if (response && response.ok) {
							const responseToCache = response.clone();
							caches.open(CACHE_NAME).then(cache => {
								cache.put(event.request, responseToCache).catch(err => {
									console.warn('Failed to cache CDN resource:', err);
								});
							});
						}
						return response;
					})
					.catch(() => new Response('CDN resource unavailable', { status: 503 }));
			})
		);
		return;
	}

	// Navigation requests: network-first with timeout and cache fallback
	if (event.request.mode === 'navigate') {
		event.respondWith(
			Promise.race([
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
					}),
				new Promise((_, reject) => 
					setTimeout(() => reject(new Error('Network timeout')), NETWORK_TIMEOUT)
				)
			])
			.catch(() => {
				return caches.match('/index.html?v=--hash--')
					.then(cached => cached || new Response('Offline', { status: 503 }));
			})
		);
		return;
	}

	// Static assets: cache-first with background update (stale-while-revalidate)
	event.respondWith(
		caches.match(event.request).then(cached => {
			// Start network fetch in background with timeout
			const fetchPromise = Promise.race([
				fetch(event.request)
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
					}),
				new Promise((_, reject) => 
					setTimeout(() => reject(new Error('Network timeout')), NETWORK_TIMEOUT)
				)
			]).catch(() => null);

			// Return cached version immediately if available
			// Otherwise wait for network (with timeout)
			return cached || fetchPromise || new Response('Offline', { status: 503 });
		})
	);
});

// Activate: remove old caches and take control immediately
self.addEventListener('activate', event => {
	const currentVersion = '--hash--';
	
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
