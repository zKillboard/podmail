// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const OFFLINE_MODE_ENABLED = false;

const CACHE_VERSION = '3497b2e';
const CACHE_NAME = `PodMail-${CACHE_VERSION}`;

const APP_SHELL = [
	'/',
	'/?v=3497b2e',
	'/index.html?v=3497b2e',
	'/404.html?v=3497b2e',
	'/auth.html?v=3497b2e',
	'/css/app.css?v=3497b2e',
	'/css/supports.css?v=3497b2e',
	'/js/app.js?v=3497b2e',
	'/js/esi.js?v=3497b2e',
	'/js/SimpleESI.js?v=3497b2e',
	'/js/KeyValues.js?v=3497b2e',
	'/favicon.ico?v=3497b2e',
	'/README.md?v=3497b2e',
	'/img/github.svg?v=3497b2e',
	'/img/podmail.png?v=3497b2e',
	'/img/ssologin.png?v=3497b2e',
	'/img/character.jpg?v=3497b2e',
];

// CDN includes only when offline mode is ON
const CDN_SHELL = [
	'https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/css/bootstrap.min.css',
	'https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/js/bootstrap.bundle.min.js',
	'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css',
	'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.min.js',
	'https://cdn.jsdelivr.net/npm/marked@15.0.6/marked.min.js',
	'https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js'
];

const NETWORK_TIMEOUT = 3000;

// ------------------------------------------------------------
// INSTALL — only cache when offline mode enabled
// ------------------------------------------------------------
self.addEventListener('install', event => {
	self.skipWaiting(); // Always replace previous worker immediately

	if (!OFFLINE_MODE_ENABLED) return;

	event.waitUntil(
		caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL.concat(CDN_SHELL)))
	);
});

// ------------------------------------------------------------
// ACTIVATE — always take control AND always delete old caches
// ------------------------------------------------------------
self.addEventListener('activate', event => {
	event.waitUntil(
		(async () => {
			const names = await caches.keys();
			await Promise.all(
				names.map(name => name !== CACHE_NAME ? caches.delete(name) : Promise.resolve())
			);
		})()
	);

	self.clients.claim(); // Take over immediately
});

// ------------------------------------------------------------
// FETCH — completely bypass cache when offline mode is off
// ------------------------------------------------------------
self.addEventListener('fetch', event => {

	// HARD DISABLE CACHING MODE
	if (!OFFLINE_MODE_ENABLED) {
		event.respondWith(fetch(event.request));
		return;
	}

	// Only GET requests can be cached
	if (event.request.method !== 'GET') return;

	const url = event.request.url;

	// ------------------------------------------------------------
	// CDN requests — cache-first
	// ------------------------------------------------------------
	if (url.startsWith('https://cdn.jsdelivr.net')) {
		event.respondWith(
			caches.match(event.request).then(cached => {
				if (cached) return cached;

				return fetch(event.request)
					.then(res => {
						if (res.ok) {
							const copy = res.clone();
							caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
						}
						return res;
					})
					.catch(() => new Response('CDN unavailable', { status: 503 }));
			})
		);
		return;
	}

	// ------------------------------------------------------------
	// Navigation — network-first with timeout and fallback
	// ------------------------------------------------------------
	if (event.request.mode === 'navigate') {
		event.respondWith(
			Promise.race([
				fetch(event.request)
					.then(res => {
						if (res.ok) {
							const copy = res.clone();
							caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
						}
						return res;
					}),
				new Promise((_, reject) => setTimeout(reject, NETWORK_TIMEOUT))
			]).catch(() =>
				caches.match(`/index.html?v=${CACHE_VERSION}`) ||
				new Response('Offline', { status: 503 })
			)
		);
		return;
	}

	// ------------------------------------------------------------
	// Static assets — stale-while-revalidate
	// ------------------------------------------------------------
	event.respondWith(
		caches.match(event.request).then(cached => {
			const networkFetch = fetch(event.request)
				.then(res => {
					if (res.ok) {
						const copy = res.clone();
						caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
					}
					return res;
				})
				.catch(() => null);

			// Return cached immediately, or wait for network
			return cached || networkFetch || new Response('Offline', { status: 503 });
		})
	);
});
