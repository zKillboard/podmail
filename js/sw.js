const CACHE_NAME = 'PodMail-vd016881';
const urlsToCache = [
	'/?v=d016881',
	'/index.html?v=d016881',
	'/css/app.css?v=d016881',
	'/css/supports.css?v=d016881',
	'/js/app.js?v=d016881',
	'/js/esi.js?v=d016881',
	'/js/SimpleESI.js?v=d016881',
	'/js/sw.js?v=d016881',
	'/favicon.ico?v=d016881',
	'/README.md?v=d016881'
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
