// SchedX Service Worker
// Handles caching, offline support, background sync, and push notifications

const CACHE_NAME = 'schedx-cache-v1';

// Assets to cache on install
const STATIC_ASSETS = [
	'/',
	'/manifest.webmanifest',
	'/favicon.png',
	'/app-icon-light.png',
	'/app-icon-dark.png'
];

// API routes that should never be cached
const NO_CACHE_PATTERNS = [
	'/api/',
	'/auth/',
	'/login',
	'/logout'
];

// Background sync tag for failed tweet posts
const SYNC_TAG_FAILED_TWEETS = 'sync-failed-tweets';

// IndexedDB for storing failed tweets
const DB_NAME = 'schedx-offline';
const DB_VERSION = 1;
const STORE_FAILED_TWEETS = 'failed-tweets';

/**
 * Open IndexedDB
 */
function openDatabase() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
		
		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			if (!db.objectStoreNames.contains(STORE_FAILED_TWEETS)) {
				db.createObjectStore(STORE_FAILED_TWEETS, { keyPath: 'id', autoIncrement: true });
			}
		};
	});
}

/**
 * Add a failed tweet to the queue
 */
async function queueFailedTweet(tweet) {
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_FAILED_TWEETS, 'readwrite');
		const store = tx.objectStore(STORE_FAILED_TWEETS);
		const request = store.add({ ...tweet, timestamp: Date.now() });
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/**
 * Get all failed tweets from the queue
 */
async function getFailedTweets() {
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_FAILED_TWEETS, 'readonly');
		const store = tx.objectStore(STORE_FAILED_TWEETS);
		const request = store.getAll();
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/**
 * Remove a tweet from the failed queue
 */
async function removeFailedTweet(id) {
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_FAILED_TWEETS, 'readwrite');
		const store = tx.objectStore(STORE_FAILED_TWEETS);
		const request = store.delete(id);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

/**
 * Check if a URL should be cached
 */
function shouldCache(url) {
	return !NO_CACHE_PATTERNS.some(pattern => url.includes(pattern));
}

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => cache.addAll(STATIC_ASSETS))
			.then(() => self.skipWaiting())
	);
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames
						.filter((name) => name !== CACHE_NAME)
						.map((name) => caches.delete(name))
				);
			})
			.then(() => self.clients.claim())
	);
});

/**
 * Fetch event - serve from cache, fallback to network
 */
self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	
	// Skip non-GET requests
	if (event.request.method !== 'GET') {
		return;
	}
	
	// Skip API and auth routes
	if (!shouldCache(url.pathname)) {
		return;
	}
	
	event.respondWith(
		(async () => {
			// Try cache first
			const cachedResponse = await caches.match(event.request);
			
			// Return cached response if available
			if (cachedResponse) {
				// Fetch in background to update cache (stale-while-revalidate)
				event.waitUntil(
					fetch(event.request)
						.then((response) => {
							if (response.ok) {
								const responseClone = response.clone();
								caches.open(CACHE_NAME).then((cache) => {
									cache.put(event.request, responseClone);
								});
							}
						})
						.catch(() => {
							// Network failed, that's okay - we served from cache
						})
				);
				return cachedResponse;
			}
			
			// No cache, try network
			try {
				const response = await fetch(event.request);
				
				// Cache successful responses
				if (response.ok && shouldCache(url.pathname)) {
					const responseClone = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseClone);
					});
				}
				
				return response;
			} catch (error) {
				// Network failed, return offline page if available
				const offlineResponse = await caches.match('/');
				return offlineResponse || new Response('Offline', { status: 503 });
			}
		})()
	);
});

/**
 * Background sync event - retry failed tweet posts
 */
self.addEventListener('sync', (event) => {
	if (event.tag === SYNC_TAG_FAILED_TWEETS) {
		event.waitUntil(retryFailedTweets());
	}
});

/**
 * Retry posting failed tweets
 */
async function retryFailedTweets() {
	const failedTweets = await getFailedTweets();
	
	for (const tweet of failedTweets) {
		try {
			const response = await fetch('/api/tweets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(tweet.data)
			});
			
			if (response.ok) {
				await removeFailedTweet(tweet.id);
				// Notify user of successful retry
				await self.registration.showNotification('Tweet Posted', {
					body: 'A previously failed tweet has been posted successfully.',
					icon: '/app-icon-light.png',
					badge: '/favicon.png',
					tag: 'tweet-retry-success'
				});
			}
		} catch (error) {
			console.error('Failed to retry tweet:', error);
		}
	}
}

/**
 * Push notification event
 */
self.addEventListener('push', (event) => {
	if (!event.data) {
		return;
	}
	
	let data;
	try {
		data = event.data.json();
	} catch (e) {
		data = {
			title: 'SchedX',
			body: event.data.text(),
			url: '/'
		};
	}
	
	const options = {
		body: data.body || '',
		icon: data.icon || '/app-icon-light.png',
		badge: '/favicon.png',
		tag: data.tag || 'schedx-notification',
		data: {
			url: data.url || '/'
		},
		vibrate: [100, 50, 100],
		requireInteraction: data.requireInteraction || false
	};
	
	event.waitUntil(
		self.registration.showNotification(data.title || 'SchedX', options)
	);
});

/**
 * Notification click event
 */
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	
	const url = event.notification.data?.url || '/';
	
	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true })
			.then((clientList) => {
				// Try to focus an existing window
				for (const client of clientList) {
					if (client.url.includes(self.location.origin) && 'focus' in client) {
						client.navigate(url);
						return client.focus();
					}
				}
				// Open a new window if none exists
				if (clients.openWindow) {
					return clients.openWindow(url);
				}
			})
	);
});

/**
 * Message event - handle messages from the main app
 */
self.addEventListener('message', (event) => {
	if (event.data?.type === 'QUEUE_FAILED_TWEET') {
		queueFailedTweet(event.data.tweet)
			.then(() => {
				// Register for background sync
				if ('sync' in self.registration) {
					return self.registration.sync.register(SYNC_TAG_FAILED_TWEETS);
				}
			})
			.catch((error) => {
				console.error('Failed to queue tweet:', error);
			});
	}
	
	if (event.data?.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});
