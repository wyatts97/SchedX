import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { rt } from '../runtime.js';
import { logger, errorMessage } from '../logger.js';
import type { Notification } from './index.js';

let configuredFor: string | undefined;

export function pushEnabled(): boolean {
	return !!rt().vapid;
}

export function vapidPublicKey(): string | undefined {
	return rt().vapid?.publicKey;
}

function configure(): boolean {
	const vapid = rt().vapid;
	if (!vapid) return false;
	if (configuredFor !== vapid.publicKey) {
		webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
		configuredFor = vapid.publicKey;
	}
	return true;
}

export function saveSubscription(
	sub: { endpoint: string; p256dh: string; auth: string },
	userAgent?: string
) {
	getDb()
		.insert(schema.pushSubscriptions)
		.values({ ...sub, userAgent: userAgent?.slice(0, 200) })
		.onConflictDoUpdate({
			target: schema.pushSubscriptions.endpoint,
			set: { p256dh: sub.p256dh, auth: sub.auth }
		})
		.run();
}

export function removeSubscription(endpoint: string) {
	getDb()
		.delete(schema.pushSubscriptions)
		.where(eq(schema.pushSubscriptions.endpoint, endpoint))
		.run();
}

export function subscriptionCount(): number {
	return getDb().select().from(schema.pushSubscriptions).all().length;
}

export async function sendPush(n: Notification): Promise<void> {
	if (!configure()) return;
	const subs = getDb().select().from(schema.pushSubscriptions).all();
	const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url ?? '/', tag: n.event });
	await Promise.all(
		subs.map(async (s) => {
			try {
				await webpush.sendNotification(
					{ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
					payload,
					{ TTL: 60 * 60 * 24 }
				);
			} catch (err) {
				const status = (err as { statusCode?: number }).statusCode;
				if (status === 404 || status === 410) removeSubscription(s.endpoint);
				else logger.warn({ err: errorMessage(err), status }, 'push send failed');
			}
		})
	);
}
