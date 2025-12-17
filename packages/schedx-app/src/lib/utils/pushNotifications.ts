/**
 * Push Notification Client Utilities
 * Handles subscription management for web push notifications
 */

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported(): boolean {
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get the current notification permission status
 */
export function getPermissionStatus(): NotificationPermission {
	if (!('Notification' in window)) {
		return 'denied';
	}
	return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestPermission(): Promise<NotificationPermission> {
	if (!('Notification' in window)) {
		return 'denied';
	}
	return await Notification.requestPermission();
}

/**
 * Get the VAPID public key from the server
 */
async function getVapidPublicKey(): Promise<string | null> {
	try {
		const response = await fetch('/api/push');
		if (!response.ok) return null;
		
		const data = await response.json();
		return data.enabled ? data.publicKey : null;
	} catch {
		return null;
	}
}

/**
 * Convert a base64 string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<{ success: boolean; error?: string }> {
	if (!isPushSupported()) {
		return { success: false, error: 'Push notifications not supported in this browser' };
	}

	// Request permission
	const permission = await requestPermission();
	if (permission !== 'granted') {
		return { success: false, error: 'Notification permission denied' };
	}

	// Get VAPID public key
	const vapidPublicKey = await getVapidPublicKey();
	if (!vapidPublicKey) {
		return { success: false, error: 'Push notifications not configured on server' };
	}

	try {
		// Get service worker registration
		const registration = await navigator.serviceWorker.ready;

		// Check for existing subscription
		let subscription = await registration.pushManager.getSubscription();

		// Create new subscription if none exists
		if (!subscription) {
			subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
			});
		}

		// Send subscription to server
		const response = await fetch('/api/push', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ subscription: subscription.toJSON() })
		});

		if (!response.ok) {
			const data = await response.json();
			return { success: false, error: data.error || 'Failed to save subscription' };
		}

		return { success: true };
	} catch (error) {
		console.error('Push subscription error:', error);
		return { success: false, error: 'Failed to subscribe to push notifications' };
	}
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
	if (!isPushSupported()) {
		return { success: false, error: 'Push notifications not supported' };
	}

	try {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();

		if (!subscription) {
			return { success: true }; // Already unsubscribed
		}

		// Unsubscribe locally
		await subscription.unsubscribe();

		// Remove from server
		await fetch('/api/push', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ endpoint: subscription.endpoint })
		});

		return { success: true };
	} catch (error) {
		console.error('Push unsubscribe error:', error);
		return { success: false, error: 'Failed to unsubscribe' };
	}
}

/**
 * Check if currently subscribed to push notifications
 */
export async function isSubscribed(): Promise<boolean> {
	if (!isPushSupported()) {
		return false;
	}

	try {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();
		return subscription !== null;
	} catch {
		return false;
	}
}

/**
 * Queue a failed tweet for background sync
 * This stores the tweet in IndexedDB and registers for background sync
 */
export async function queueFailedTweetForSync(tweet: any): Promise<boolean> {
	if (!('serviceWorker' in navigator)) {
		return false;
	}

	try {
		const registration = await navigator.serviceWorker.ready;
		
		// Send message to service worker to queue the tweet
		if (registration.active) {
			registration.active.postMessage({
				type: 'QUEUE_FAILED_TWEET',
				tweet
			});
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Register service worker and set up push notifications
 */
export async function initializePushNotifications(): Promise<void> {
	if (!isPushSupported()) {
		console.log('Push notifications not supported');
		return;
	}

	try {
		// Register service worker if not already registered
		const registration = await navigator.serviceWorker.register('/service-worker.js', {
			scope: '/'
		});

		console.log('Service worker registered:', registration.scope);

		// Check if already subscribed
		const subscribed = await isSubscribed();
		if (subscribed) {
			console.log('Already subscribed to push notifications');
		}
	} catch (error) {
		console.error('Service worker registration failed:', error);
	}
}
