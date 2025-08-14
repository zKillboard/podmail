const VERSION = 'bc4e324';
const CACHE_NAME = `PodMail-${VERSION}`;
const CORE = [
	'/',
	'/index.html?v=bc4e324',
	'/css/app.css?v=bc4e324',
	'/css/supports.css?v=bc4e324',
	'/js/app.js?v=bc4e324',
	'/js/esi.js?v=bc4e324',
	'/js/SimpleESI.js?v=bc4e324',
	'/favicon.ico?v=bc4e324'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE))
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((names) =>
			Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
		)
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	const { request } = event;

	// Only handle same-origin GETs
	if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
		return; // let the browser/network handle it
	}

	// 1) Page navigations: network-first, fallback to cached index for SPA
	if (request.mode === 'navigate') {
		event.respondWith((async () => {
			try {
				const net = await fetch(request);
				// Optionally cache the shell HTML:
				const cache = await caches.open(CACHE_NAME);
				cache.put(request, net.clone());
				return net;
			} catch {
				// Serve the app shell when offline, ignoring query strings
				return (await caches.match('/index.html?v=bc4e324', { ignoreSearch: true })) ||
					new Response('Offline', { status: 503 });
			}
		})());
		return;
	}

	// 2) Static assets: stale-while-revalidate
	event.respondWith((async () => {
		const cache = await caches.open(CACHE_NAME);
		const cached = await cache.match(request, { ignoreSearch: true });
		const fetchPromise = fetch(request).then((net) => {
			if (net && net.ok) cache.put(request, net.clone());
			return net;
		}).catch(() => null);

		// Serve cache immediately if present, update in background
		if (cached) return cached;

		// Otherwise wait for network (or fail if offline)
		return (await fetchPromise) || new Response('Offline', { status: 503 });
	})());
});
