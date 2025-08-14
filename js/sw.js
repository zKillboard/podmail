const CACHE_NAME = 'PodMail-v1';
const urlsToCache = [
	'/', // hash
	'/index.html', // hash
	'/css/app.css', // hash
	'/css/supports.css', // hash
	'/js/app.js', // hash
	'/js/esi.js', // hash
	'/js/SimpleESI.js', // hash
	'/js/sw.js', // hash
	'/favicon.ico', // hash
	'/README.md', // hash
	'/podmail.version', // hash
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
