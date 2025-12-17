import webpush from 'web-push';
import { getDbInstance, getRawDbInstance } from './db';
import { log } from './logger';

// VAPID keys for push notifications
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@schedx.app';

// Initialize web-push with VAPID keys
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
	webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
	log.info('Push notifications initialized with VAPID keys');
} else {
	log.warn('Push notifications disabled - VAPID keys not configured');
}

export interface PushSubscription {
	endpoint: string;
	keys: {
		p256dh: string;
		auth: string;
	};
}

export interface PushNotificationPayload {
	title: string;
	body: string;
	url?: string;
	tag?: string;
	icon?: string;
	actions?: Array<{ action: string; title: string }>;
	renotify?: boolean;
}

/**
 * Push Notification Service
 * Handles sending push notifications to subscribed users
 */
export class PushNotificationService {
	private static instance: PushNotificationService;

	private constructor() {}

	public static getInstance(): PushNotificationService {
		if (!PushNotificationService.instance) {
			PushNotificationService.instance = new PushNotificationService();
		}
		return PushNotificationService.instance;
	}

	/**
	 * Check if push notifications are enabled
	 */
	public isEnabled(): boolean {
		return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
	}

	/**
	 * Get the public VAPID key for client subscription
	 */
	public getPublicKey(): string {
		return VAPID_PUBLIC_KEY;
	}

	/**
	 * Save a push subscription for a user
	 */
	public async saveSubscription(userId: string, subscription: PushSubscription): Promise<void> {
		const rawDb = getRawDbInstance();
		const now = Date.now();

		// Check if subscription already exists
		const existing = rawDb.queryOne(
			'SELECT id FROM push_subscriptions WHERE userId = ? AND endpoint = ?',
			[userId, subscription.endpoint]
		);

		if (existing) {
			// Update existing subscription
			rawDb.execute(
				`UPDATE push_subscriptions 
				 SET p256dh = ?, auth = ?, updatedAt = ? 
				 WHERE userId = ? AND endpoint = ?`,
				[subscription.keys.p256dh, subscription.keys.auth, now, userId, subscription.endpoint]
			);
			log.info('Updated push subscription', { userId });
		} else {
			// Create new subscription
			const id = rawDb.generateId();
			rawDb.execute(
				`INSERT INTO push_subscriptions (id, userId, endpoint, p256dh, auth, createdAt, updatedAt)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[id, userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, now, now]
			);
			log.info('Created push subscription', { userId });
		}
	}

	/**
	 * Remove a push subscription
	 */
	public async removeSubscription(userId: string, endpoint: string): Promise<void> {
		const rawDb = getRawDbInstance();
		rawDb.execute(
			'DELETE FROM push_subscriptions WHERE userId = ? AND endpoint = ?',
			[userId, endpoint]
		);
		log.info('Removed push subscription', { userId });
	}

	/**
	 * Send a push notification to a specific user
	 */
	public async sendToUser(userId: string, payload: PushNotificationPayload): Promise<void> {
		if (!this.isEnabled()) {
			log.warn('Push notifications disabled, skipping notification');
			return;
		}

		const rawDb = getRawDbInstance();
		const subscriptions = rawDb.query(
			'SELECT * FROM push_subscriptions WHERE userId = ?',
			[userId]
		) as any[];

		if (!subscriptions || subscriptions.length === 0) {
			log.debug('No push subscriptions found for user', { userId });
			return;
		}

		const notificationPayload = JSON.stringify({
			title: payload.title,
			body: payload.body,
			url: payload.url || '/',
			tag: payload.tag || 'schedx-notification',
			icon: payload.icon || '/app-icon-light.png',
			actions: payload.actions || [],
			renotify: payload.renotify || false
		});

		for (const sub of subscriptions) {
			try {
				await webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: {
							p256dh: sub.p256dh,
							auth: sub.auth
						}
					},
					notificationPayload
				);
				log.debug('Push notification sent', { userId, endpoint: sub.endpoint });
			} catch (error: any) {
				// Handle expired or invalid subscriptions
				if (error.statusCode === 404 || error.statusCode === 410) {
					log.info('Removing expired push subscription', { userId, endpoint: sub.endpoint });
					await this.removeSubscription(userId, sub.endpoint);
				} else {
					log.error('Failed to send push notification', {
						userId,
						error: error.message,
						statusCode: error.statusCode
					});
				}
			}
		}
	}

	/**
	 * Send notification when a tweet is posted successfully
	 */
	public async notifyTweetPosted(userId: string, tweetId: string, tweetUrl: string, accountUsername?: string): Promise<void> {
		const accountInfo = accountUsername ? ` for @${accountUsername}` : '';
		await this.sendToUser(userId, {
			title: '✅ Tweet Posted!',
			body: `Your scheduled tweet${accountInfo} has been posted successfully.`,
			url: tweetUrl,
			tag: `tweet-posted-${tweetId}`,
			actions: [
				{ action: 'view', title: 'View Tweet' }
			]
		});
	}

	/**
	 * Send notification when a tweet fails to post
	 */
	public async notifyTweetFailed(userId: string, tweetId: string, error: string, accountUsername?: string): Promise<void> {
		const accountInfo = accountUsername ? ` for @${accountUsername}` : '';
		await this.sendToUser(userId, {
			title: '❌ Tweet Failed',
			body: `Your scheduled tweet${accountInfo} failed to post: ${error}`,
			url: `/scheduled?highlight=${tweetId}`,
			tag: `tweet-failed-${tweetId}`,
			actions: [
				{ action: 'retry', title: 'View Details' }
			]
		});
	}

	/**
	 * Send notification for upcoming scheduled tweet
	 */
	public async notifyUpcomingTweet(userId: string, tweetId: string, minutesUntil: number, accountUsername?: string): Promise<void> {
		const accountInfo = accountUsername ? ` for @${accountUsername}` : '';
		await this.sendToUser(userId, {
			title: '⏰ Tweet Scheduled Soon',
			body: `Your tweet${accountInfo} will be posted in ${minutesUntil} minutes.`,
			url: `/scheduled?highlight=${tweetId}`,
			tag: `tweet-upcoming-${tweetId}`
		});
	}

	/**
	 * Send notification for thread posted
	 */
	public async notifyThreadPosted(userId: string, threadId: string, tweetUrl: string, accountUsername?: string): Promise<void> {
		const accountInfo = accountUsername ? ` for @${accountUsername}` : '';
		await this.sendToUser(userId, {
			title: '✅ Thread Posted!',
			body: `Your scheduled thread${accountInfo} has been posted successfully.`,
			url: tweetUrl,
			tag: `thread-posted-${threadId}`,
			actions: [
				{ action: 'view', title: 'View Thread' }
			]
		});
	}
}

export const pushNotificationService = PushNotificationService.getInstance();
