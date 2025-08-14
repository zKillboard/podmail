const CACHE_NAME = 'PodMail-v2677f1e';
const urlsToCache = [
	'/?v=2677f1e',
	'/index.html?v=2677f1e',
	'/css/app.css?v=2677f1e',
	'/css/supports.css?v=2677f1e',
	'/js/app.js?v=2677f1e',
	'/js/esi.js?v=2677f1e',
	'/js/SimpleESI.js?v=2677f1e',
	'/js/sw.js?v=2677f1e',
	'/favicon.ico?v=2677f1e',
	'/README.md?v=2677f1e'
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
				// Update the cache with the latest version
				if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
					caches.open(CACHE_NAME).then(cache => {
						cache.put(event.request, networkResponse.clone());
					});
				}
				return networkResponse.clone();
			})
			.catch(() => {
				// Fallback to cache if offline or fetch fails
				return caches.match(event.request);
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
