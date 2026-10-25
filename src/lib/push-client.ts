import { api } from './utils.js';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
	const out = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

export function pushSupported(): boolean {
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
	if (!pushSupported()) return null;
	const reg = await navigator.serviceWorker.getRegistration();
	return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function subscribe(vapidKey: string): Promise<void> {
	const permission = await Notification.requestPermission();
	if (permission !== 'granted')
		throw new Error('Notifications are blocked for this site in your browser settings.');
	const reg = await navigator.serviceWorker.ready;
	const sub =
		(await reg.pushManager.getSubscription()) ??
		(await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidKey)
		}));
	await api('/api/push', sub.toJSON());
}

export async function unsubscribe(): Promise<void> {
	const sub = await currentSubscription();
	if (!sub) return;
	await api('/api/push', { endpoint: sub.endpoint }, 'DELETE');
	await sub.unsubscribe();
}
