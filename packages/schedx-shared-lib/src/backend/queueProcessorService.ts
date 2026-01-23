import { Tweet, TweetStatus, QueueSettings } from '../types/types.js';

// Simple logger for queue processor
const log = {
	info: (msg: string, data?: any) => console.log(`[QueueProcessor] INFO: ${msg}`, data || ''),
	warn: (msg: string, data?: any) => console.warn(`[QueueProcessor] WARN: ${msg}`, data || ''),
	error: (msg: string, data?: any) => console.error(`[QueueProcessor] ERROR: ${msg}`, data || '')
};

/**
 * Convert a time in user's timezone to UTC Date
 * @param year Year in user's timezone
 * @param month Month (0-11) in user's timezone
 * @param day Day in user's timezone
 * @param hours Hours in user's timezone
 * @param minutes Minutes in user's timezone
 * @param timezone IANA timezone string (e.g., 'America/New_York')
 * @returns Date object in UTC
 */
function convertToUTC(
	year: number,
	month: number,
	day: number,
	hours: number,
	minutes: number,
	timezone: string
): Date {
	try {
		// Create a date string in ISO format
		const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
		
		// Use Intl.DateTimeFormat to get the UTC offset for the timezone at this specific date/time
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
		
		// Parse the local time in the given timezone
		// Create a temporary date to get the offset
		const tempDate = new Date(dateStr);
		const utcDate = new Date(tempDate.toLocaleString('en-US', { timeZone: 'UTC' }));
		const tzDate = new Date(tempDate.toLocaleString('en-US', { timeZone: timezone }));
		const offset = utcDate.getTime() - tzDate.getTime();
		
		// Adjust for the timezone offset
		return new Date(tempDate.getTime() + offset);
	} catch (error) {
		log.warn(`Failed to convert timezone ${timezone}, falling back to local time`, { error });
		return new Date(year, month, day, hours, minutes, 0, 0);
	}
}

/**
 * Get the current date/time components in a specific timezone
 */
function getNowInTimezone(timezone: string): { year: number; month: number; day: number; hours: number; minutes: number; dayOfWeek: number } {
	try {
		const now = new Date();
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			weekday: 'short'
		});
		
		const parts = formatter.formatToParts(now);
		const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
		
		const weekdayStr = getPart('weekday');
		const dayOfWeekMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
		
		return {
			year: parseInt(getPart('year')),
			month: parseInt(getPart('month')) - 1, // 0-indexed
			day: parseInt(getPart('day')),
			hours: parseInt(getPart('hour')),
			minutes: parseInt(getPart('minute')),
			dayOfWeek: dayOfWeekMap[weekdayStr] ?? now.getDay()
		};
	} catch (error) {
		log.warn(`Failed to get time in timezone ${timezone}, falling back to local`, { error });
		const now = new Date();
		return {
			year: now.getFullYear(),
			month: now.getMonth(),
			day: now.getDate(),
			hours: now.getHours(),
			minutes: now.getMinutes(),
			dayOfWeek: now.getDay()
		};
	}
}

/**
 * Queue Processor Service
 * Automatically schedules queued tweets based on queue settings
 * Now with proper timezone handling and transaction support
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
	 * Uses atomic operations to prevent race conditions
	 */
	private static async processQueueForAccount(
		db: any,
		userId: string,
		settings: QueueSettings
	): Promise<{ scheduled: number; errors: string[] }> {
		const errors: string[] = [];
		let scheduled = 0;

		try {
			// Get queued tweets for this account, sorted by queue position
			const allQueuedTweets = await db.getTweetsByStatus(userId, TweetStatus.QUEUED);
			const queuedTweets = (settings.twitterAccountId
				? allQueuedTweets.filter((t: Tweet) => t.twitterAccountId === settings.twitterAccountId)
				: allQueuedTweets
			).sort((a: Tweet, b: Tweet) => (a.queuePosition || 0) - (b.queuePosition || 0));

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

			// Process each tweet with atomic claim to prevent race conditions
			for (let i = 0; i < queuedTweets.length && i < timeSlots.length; i++) {
				const tweet = queuedTweets[i];
				const scheduledDate = timeSlots[i];

				try {
					// Use atomic claim operation if available, otherwise fall back to regular update
					if (typeof db.claimQueuedTweetForScheduling === 'function') {
						// Atomic: Only succeeds if tweet is still QUEUED
						const claimed = await db.claimQueuedTweetForScheduling(
							tweet.id,
							scheduledDate,
							TweetStatus.SCHEDULED
						);
						
						if (!claimed) {
							log.info('Tweet already claimed by another process, skipping', {
								tweetId: tweet.id
							});
							continue;
						}
					} else {
						// Fallback: Regular update (less safe but backwards compatible)
						await db.updateTweet(tweet.id, {
							scheduledDate,
							status: TweetStatus.SCHEDULED,
							queuePosition: null // Clear queue position
						});
					}

					// Track the newly scheduled time to avoid conflicts within this batch
					existingTimes.add(scheduledDate.getTime());

					scheduled++;
					log.info(`Scheduled queued tweet`, {
						tweetId: tweet.id,
						scheduledDate: scheduledDate.toISOString(),
						timezone: settings.timezone
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
	 * Uses the user's timezone to interpret posting times correctly
	 */
	private static generateTimeSlots(
		settings: QueueSettings,
		existingTimes: Set<number>
	): Date[] {
		const slots: Date[] = [];
		const timezone = settings.timezone || 'UTC';
		const maxDays = 30; // Look ahead 30 days

		// Get current time in user's timezone
		const nowInTz = getNowInTimezone(timezone);
		const nowUtc = new Date();

		// Parse posting times (these are in user's timezone)
		const postingTimes = settings.postingTimes.map((time) => {
			const [hours, minutes] = time.split(':').map(Number);
			return { hours, minutes };
		});

		// Sort posting times chronologically
		postingTimes.sort((a, b) => {
			if (a.hours !== b.hours) return a.hours - b.hours;
			return a.minutes - b.minutes;
		});

		// Generate slots for each day
		for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
			// Calculate the date in user's timezone
			const targetYear = nowInTz.year;
			const targetMonth = nowInTz.month;
			const targetDay = nowInTz.day + dayOffset;
			
			// Create a date to get the correct day of week (handles month overflow)
			const tempDate = new Date(targetYear, targetMonth, targetDay);
			const dayOfWeek = tempDate.getDay();

			// Skip weekends if configured
			if (settings.skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
				continue;
			}

			// Generate slots for each posting time
			let dailyCount = 0;
			for (const time of postingTimes) {
				if (dailyCount >= settings.maxPostsPerDay) {
					break;
				}

				// Convert the posting time in user's timezone to UTC for storage
				const slotUtc = convertToUTC(
					tempDate.getFullYear(),
					tempDate.getMonth(),
					tempDate.getDate(),
					time.hours,
					time.minutes,
					timezone
				);

				// Skip if in the past (compare UTC times)
				if (slotUtc <= nowUtc) {
					continue;
				}

				// Skip if conflicts with existing tweet (within 1 minute tolerance)
				const hasConflict = Array.from(existingTimes).some(existingTime => 
					Math.abs(existingTime - slotUtc.getTime()) < 60000 // 1 minute tolerance
				);
				if (hasConflict) {
					continue;
				}

				// Check minimum interval with previous slot
				if (slots.length > 0) {
					const lastSlot = slots[slots.length - 1];
					const intervalMinutes = (slotUtc.getTime() - lastSlot.getTime()) / (1000 * 60);
					if (intervalMinutes < settings.minInterval) {
						continue;
					}
				}

				slots.push(slotUtc);
				dailyCount++;
			}
		}

		log.info(`Generated ${slots.length} time slots in timezone ${timezone}`, {
			timezone,
			firstSlot: slots[0]?.toISOString(),
			lastSlot: slots[slots.length - 1]?.toISOString()
		});

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
