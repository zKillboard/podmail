const CACHE_NAME = 'PodMail-v216c98d';
const urlsToCache = [
	'/',
	'/?v=216c98d',
	'/index.html?v=216c98d',
	'/css/app.css?v=216c98d',
	'/css/supports.css?v=216c98d',
	'/js/app.js?v=216c98d',
	'/js/esi.js?v=216c98d',
	'/js/SimpleESI.js?v=216c98d',
	'/js/sw.js?v=216c98d',
	'/favicon.ico?v=216c98d',
	'/README.md?v=216c98d'
];

// Install: cache all core files
self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
	);
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', event => {
	event.respondWith(
		fetch(event.request)
			.then(networkResponse => {
				if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
					caches.open(CACHE_NAME).then(cache => {
						cache.put(event.request, networkResponse.clone());
					});
				}
				return networkResponse.clone();
			})
			.catch(() => {
				return caches.match(event.request).then(cached => {
					// If it's in cache, return it
					if (cached) return cached;

					// If it's a navigation request, serve index.html for SPA fallback
					return caches.match('/index.html?v=216c98d');
				});
			})
	);
});

// Activate: remove old caches
self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys().then(cacheNames => {
			return Promise.all(
				cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
			);
		})
	);
});
