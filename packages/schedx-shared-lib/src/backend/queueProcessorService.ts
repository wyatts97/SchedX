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
	 */
	static async processQueue(
		db: any,
		userId: string = 'admin'
	): Promise<{ scheduled: number; errors: string[] }> {
		const errors: string[] = [];
		let scheduled = 0;

		try {
			// Get queue settings
			const settings = await db.getQueueSettings(userId);
			if (!settings || !settings.enabled) {
				log.info('Queue processing skipped - queue is disabled');
				return { scheduled: 0, errors: [] };
			}

			// Get all queued tweets ordered by position
			const queuedTweets = await db.getTweetsByStatus(userId, TweetStatus.QUEUED);
			if (!queuedTweets || queuedTweets.length === 0) {
				log.info('No queued tweets to process');
				return { scheduled: 0, errors: [] };
			}

			log.info(`Processing ${queuedTweets.length} queued tweets`, {
				userId,
				queueLength: queuedTweets.length
			});

			// Get existing scheduled tweets to avoid conflicts
			const scheduledTweets = await db.getTweetsByStatus(userId, TweetStatus.SCHEDULED);
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
					queuedCount: queuedTweets.length,
					availableSlots: timeSlots.length
				});
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
