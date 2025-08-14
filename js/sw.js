const CACHE_NAME = 'PodMail-v--hash--';
const urlsToCache = [
	'/?v=--hash--',
	'/index.html?v=--hash--',
	'/css/app.css?v=--hash--',
	'/css/supports.css?v=--hash--',
	'/js/app.js?v=--hash--',
	'/js/esi.js?v=--hash--',
	'/js/SimpleESI.js?v=--hash--',
	'/js/sw.js?v=--hash--',
	'/favicon.ico?v=--hash--',
	'/README.md?v=--hash--'
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
