const CACHE_NAME = 'PodMail-v1';
const urlsToCache = [
	'/',
	'/index.html',
	'/css/app.css',
	'/css/supports.css',
	'/js/app.js',
	'/js/esi.js',
	'/js/SimpleESI.js',
	'/js/sw.js',
	'/favicon.ico',
	'/README.md',
	'/podmail.version',
];

self.addEventListener('install', function (event) {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then(function (cache) {
				return cache.addAll(urlsToCache);
			})
	);
});

self.addEventListener('fetch', function (event) {
	event.respondWith(
		caches.match(event.request)
			.then(function (response) {
				// Serve from cache if available
				if (response) {
					return response;
				}
				// Else fetch from network
				return fetch(event.request);
			})
	);
});

self.addEventListener('activate', function (event) {
	// Clean up old caches if you update your cache name
	event.waitUntil(
		caches.keys().then(function (cacheNames) {
			return Promise.all(
				cacheNames.filter(function (name) {
					return name !== CACHE_NAME;
				}).map(function (name) {
					return caches.delete(name);
				})
			);
		})
	);
});
