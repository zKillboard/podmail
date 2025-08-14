const CACHE_NAME = 'PodMail-v1';
const urlsToCache = [
	'/?v=3340499', // hash
	'/index.html?v=3340499', // hash
	'/css/app.css?v=3340499', // hash
	'/css/supports.css?v=3340499', // hash
	'/js/app.js?v=3340499?v=3340499', // hash
	'/js/esi.js?v=3340499?v=3340499', // hash
	'/js/SimpleESI.js?v=3340499?v=3340499', // hash
	'/js/sw.js?v=3340499?v=3340499', // hash
	'/favicon.ico?v=3340499', // hash
	'/README.md?v=3340499', // hash
	'/podmail.version?v=3340499', // hash
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
