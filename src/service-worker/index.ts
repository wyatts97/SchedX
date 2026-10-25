import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self } from '$app/service-worker';

// Build assets are content-hashed, so caching them per version is always safe. Pages and data
// are never cached: a scheduler must not show stale schedules.
const CACHE = `schedx-${version}`;
// The emoji picker's data (a large .json asset) is left out: the picker keeps its own copy in
// IndexedDB once it has been opened.
const PRECACHE = [...immutable.map((f) => f.path), ...assets.map((f) => f.path)]
	.filter((p) => !p.endsWith('.json'))
	.map((p) => (p.startsWith('/') ? p : `/${p}`));

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin || !PRECACHE.includes(url.pathname)) return;
	event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
});

self.addEventListener('message', (event) => {
	if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', (event) => {
	let data: { title?: string; body?: string; url?: string; tag?: string };
	try {
		data = event.data?.json() ?? {};
	} catch {
		data = { body: event.data?.text() };
	}
	event.waitUntil(
		self.registration.showNotification(data.title ?? 'SchedX', {
			body: data.body,
			tag: data.tag,
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-192.png',
			data: { url: data.url ?? '/' }
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = new URL((event.notification.data?.url as string) ?? '/', self.location.origin)
		.href;
	event.waitUntil(
		(async () => {
			const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
			if (existing) {
				await existing.focus();
				return existing.navigate(target);
			}
			return self.clients.openWindow(target);
		})()
	);
});
