import { Tweet, TweetStatus, QueueSettings } from '../types/types.js';

// Simple logger for queue processor
const log = {
	info: (msg: string, data?: any) => console.log(`[QueueProcessor] INFO: ${msg}`, data || ''),
	warn: (msg: string, data?: any) => console.warn(`[QueueProcessor] WARN: ${msg}`, data || ''),
	error: (msg: string, data?: any) => console.error(`[QueueProcessor] ERROR: ${msg}`, data || '')
};

/**
 * Queue Processor Service
 * Automatically schedules queued tweets based on queue settings
 */
export class QueueProcessorService {
	/**
	 * Process the queue and assign scheduled times to queued tweets
	 * Processes each account's queue separately with its own settings
	 */
	static async processQueue(
		db: any,
		userId: string,
		twitterAccountId?: string
	): Promise<{ scheduled: number; errors: string[] }> {
		const errors: string[] = [];
		let scheduled = 0;

		try {
			// Get all queue settings for this user
			const allSettings = await db.getAllQueueSettings(userId);
			
			// Filter settings if specific account requested
			const settingsToProcess = twitterAccountId
				? allSettings.filter((s: any) => s.twitterAccountId === twitterAccountId)
				: allSettings;

			// If no settings found, try default settings
			if (settingsToProcess.length === 0) {
				const defaultSettings = await db.getQueueSettings(userId);
				if (defaultSettings && defaultSettings.enabled) {
					settingsToProcess.push(defaultSettings);
				}
			}

			if (settingsToProcess.length === 0) {
				log.info('Queue processing skipped - no enabled queue settings found');
				return { scheduled: 0, errors: [] };
			}

			// Process queue for each settings configuration
			for (const settings of settingsToProcess) {
				if (!settings.enabled) {
					continue;
				}

				const result = await this.processQueueForAccount(
					db,
					userId,
					settings
				);
				scheduled += result.scheduled;
				errors.push(...result.errors);
			}

			return { scheduled, errors };
		} catch (error) {
			const errorMsg = `Queue processing failed: ${error}`;
			log.error(errorMsg, { error });
			errors.push(errorMsg);
			return { scheduled, errors };
		}
	}

	/**
	 * Process queue for a specific account/settings configuration
	 */
	private static async processQueueForAccount(
		db: any,
		userId: string,
		settings: QueueSettings
	): Promise<{ scheduled: number; errors: string[] }> {
		const errors: string[] = [];
		let scheduled = 0;

		try {
			// Get queued tweets for this account
			const allQueuedTweets = await db.getTweetsByStatus(userId, TweetStatus.QUEUED);
			const queuedTweets = settings.twitterAccountId
				? allQueuedTweets.filter((t: Tweet) => t.twitterAccountId === settings.twitterAccountId)
				: allQueuedTweets;

			if (!queuedTweets || queuedTweets.length === 0) {
				log.info('No queued tweets to process for account', {
					twitterAccountId: settings.twitterAccountId || 'default'
				});
				return { scheduled: 0, errors: [] };
			}

			log.info(`Processing ${queuedTweets.length} queued tweets`, {
				userId,
				twitterAccountId: settings.twitterAccountId || 'default',
				queueLength: queuedTweets.length
			});

			// Get existing scheduled tweets to avoid conflicts
			const allScheduledTweets = await db.getTweetsByStatus(userId, TweetStatus.SCHEDULED);
			// Filter to same account if account-specific settings
			const scheduledTweets = settings.twitterAccountId
				? allScheduledTweets.filter((t: Tweet) => t.twitterAccountId === settings.twitterAccountId)
				: allScheduledTweets;
			const existingTimes = new Set<number>(
				scheduledTweets.map((t: Tweet) => t.scheduledDate.getTime())
			);

			// Generate available time slots
			const timeSlots = this.generateTimeSlots(settings, existingTimes);

			// Assign time slots to queued tweets
			for (let i = 0; i < queuedTweets.length && i < timeSlots.length; i++) {
				const tweet = queuedTweets[i];
				const scheduledDate = timeSlots[i];

				try {
					await db.updateTweet(tweet.id, {
						scheduledDate,
						status: TweetStatus.SCHEDULED,
						queuePosition: null // Clear queue position
					});

					scheduled++;
					log.info(`Scheduled queued tweet`, {
						tweetId: tweet.id,
						scheduledDate: scheduledDate.toISOString()
					});
				} catch (error) {
					const errorMsg = `Failed to schedule tweet ${tweet.id}: ${error}`;
					errors.push(errorMsg);
					log.error(errorMsg, { error });
				}
			}

			// If there are more queued tweets than available slots, log a warning
			if (queuedTweets.length > timeSlots.length) {
				const remaining = queuedTweets.length - timeSlots.length;
				log.warn(`${remaining} queued tweets could not be scheduled - no available time slots`, {
					twitterAccountId: settings.twitterAccountId || 'default',
					queuedCount: queuedTweets.length,
					availableSlots: timeSlots.length
				});
			}

			return { scheduled, errors };
		} catch (error) {
			const errorMsg = `Queue processing failed for account: ${error}`;
			log.error(errorMsg, { error, twitterAccountId: settings.twitterAccountId });
			errors.push(errorMsg);
			return { scheduled, errors };
		}
	}

	/**
	 * Generate available time slots based on queue settings
	 */
	private static generateTimeSlots(
		settings: QueueSettings,
		existingTimes: Set<number>
	): Date[] {
		const slots: Date[] = [];
		const now = new Date();
		const maxDays = 30; // Look ahead 30 days

		// Parse posting times
		const postingTimes = settings.postingTimes.map((time) => {
			const [hours, minutes] = time.split(':').map(Number);
			return { hours, minutes };
		});

		// Generate slots for each day
		for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
			const date = new Date(now);
			date.setDate(date.getDate() + dayOffset);

			// Skip weekends if configured
			if (settings.skipWeekends && (date.getDay() === 0 || date.getDay() === 6)) {
				continue;
			}

			// Generate slots for each posting time
			let dailyCount = 0;
			for (const time of postingTimes) {
				if (dailyCount >= settings.maxPostsPerDay) {
					break;
				}

				const slotDate = new Date(date);
				slotDate.setHours(time.hours, time.minutes, 0, 0);

				// Skip if in the past
				if (slotDate <= now) {
					continue;
				}

				// Skip if conflicts with existing tweet
				if (existingTimes.has(slotDate.getTime())) {
					continue;
				}

				// Check minimum interval with previous slot
				if (slots.length > 0) {
					const lastSlot = slots[slots.length - 1];
					const intervalMinutes = (slotDate.getTime() - lastSlot.getTime()) / (1000 * 60);
					if (intervalMinutes < settings.minInterval) {
						continue;
					}
				}

				slots.push(slotDate);
				dailyCount++;
			}
		}

		return slots;
	}

	/**
	 * Reorder queue items
	 */
	static async reorderQueue(
		db: any,
		userId: string,
		tweetId: string,
		newPosition: number
	): Promise<void> {
		const queuedTweets = await db.getTweetsByStatus(userId, TweetStatus.QUEUED);

		// Update positions
		const updates = queuedTweets.map((tweet: Tweet, index: number) => {
			let position = index;
			if (tweet.id === tweetId) {
				position = newPosition;
			} else if (index >= newPosition) {
				position = index + 1;
			}
			return { id: tweet.id, queuePosition: position };
		});

		// Apply updates
		for (const update of updates) {
			await db.updateTweet(update.id, { queuePosition: update.queuePosition });
		}

		log.info(`Reordered queue for user ${userId}`, { tweetId, newPosition });
	}
}
