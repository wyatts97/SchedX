import { redirect, fail } from '@sveltejs/kit';
import type { Actions, RequestEvent } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { TweetStatus, type Tweet, getAvailableCommunities } from '@schedx/shared-lib';
import { fromZonedTime } from 'date-fns-tz';
import { log } from '$lib/server/logger.js';
import { getEnvironmentConfig } from '$lib/server/env';

// Helper function to convert local time to UTC
function convertToUTC(date: string, time: string, timezone: string): Date {
	try {
		// If no timezone provided, treat as UTC
		if (!timezone) {
			return new Date(`${date}T${time}:00.000Z`);
		}

		// Create the local datetime string
		const localDateTime = `${date} ${time}:00`;

		// Use date-fns-tz to convert the user's local time to UTC
		// This handles all timezone complexities including DST automatically
		const utcDate = fromZonedTime(localDateTime, timezone);

		return utcDate;
	} catch (error) {
		log.error('Error converting timezone:', { error, timezone, date, time });
		// Fallback: treat as UTC if timezone conversion fails
		return new Date(`${date}T${time}:00.000Z`);
	}
}

export const load = async (event: RequestEvent) => {
	// Check if user is authenticated (admin)
	const adminSession = event.cookies.get('admin_session');
	if (!adminSession || adminSession.trim() === '') {
		throw redirect(303, '/login');
	}

	// Get available communities from shared-lib
	const availableCommunities = getAvailableCommunities();

	// Fetch all Twitter accounts (for admin user)
	const db = getDbInstance();
	const accounts = await (db as any).getAllUserAccounts();

	const config = getEnvironmentConfig();
	return {
		availableCommunities,
		accounts,
		maxUploadSize: config.MAX_UPLOAD_SIZE
	};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		// Check if user is authenticated (admin)
		const adminSession = cookies.get('admin_session');
		if (!adminSession || adminSession.trim() === '') {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const content = formData.get('content') as string;
		const scheduledDate = formData.get('scheduledDate') as string;
		const scheduledTime = formData.get('scheduledTime') as string;
		const community = formData.get('community') as string;
		const timezone = formData.get('timezone') as string;
		const recurrenceType = formData.get('recurrenceType') as string;
		const recurrenceInterval = formData.get('recurrenceInterval') as string;
		const recurrenceEndDate = formData.get('recurrenceEndDate') as string;
		const saveAsDraft = formData.get('saveAsDraft') === 'true';
		const saveAsTemplate = formData.get('saveAsTemplate') === 'true';
		const templateName = formData.get('templateName') as string;
		const mediaJson = formData.get('media') as string;
		const twitterAccountId = formData.get('twitterAccountId') as string;
		let media = [];
		try {
			media = mediaJson ? JSON.parse(mediaJson) : [];
		} catch {}

		if (!twitterAccountId) {
			return fail(400, { error: 'Twitter account is required.' });
		}

		// Validation for scheduled tweets
		if (!saveAsDraft) {
			if (!content || content.trim() === '') {
				return fail(400, { content, error: 'Tweet content is required' });
			}
			if (content.length > 280) {
				return fail(400, { content, error: 'Tweet content must be 280 characters or less' });
			}
			if (!scheduledDate || !scheduledTime) {
				return fail(400, { content, error: 'Date and time are required' });
			}
			// Convert the local time to UTC using the user's timezone
			const scheduledDateTime = convertToUTC(scheduledDate, scheduledTime, timezone);
			if (scheduledDateTime < new Date()) {
				return fail(400, { content, error: 'Scheduled time must be in the future' });
			}
		}

		try {
			// Fix recurrenceType assignment to match Tweet type
			let recurrenceTypeValue: 'daily' | 'weekly' | 'monthly' | null = null;
			if (
				recurrenceType === 'daily' ||
				recurrenceType === 'weekly' ||
				recurrenceType === 'monthly'
			) {
				recurrenceTypeValue = recurrenceType;
			}
			const tweet: any = {
				userId: 'admin', // Use admin as the user ID
				content,
				scheduledDate: scheduledDate
					? convertToUTC(scheduledDate, scheduledTime, timezone)
					: new Date(),
				community,
				status: saveAsDraft ? TweetStatus.DRAFT : TweetStatus.SCHEDULED,
				createdAt: new Date(),
				recurrenceType: recurrenceTypeValue,
				recurrenceInterval: recurrenceInterval ? Number(recurrenceInterval) : null,
				recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
				templateName: saveAsTemplate && templateName ? templateName : undefined,
				templateCategory:
					saveAsTemplate && formData.get('templateCategory')
						? (formData.get('templateCategory') as string)
						: undefined,
				media,
				twitterAccountId
			};
			if (saveAsTemplate && templateName) {
				await getDbInstance().saveDraft({ ...tweet, templateName });
				return { success: true, message: 'Template saved!' };
			} else if (saveAsDraft) {
				await getDbInstance().saveDraft(tweet);
				return { success: true, message: 'Draft saved!' };
			} else {
				await getDbInstance().saveTweet(tweet);
				return redirect(303, '/scheduled');
			}
		} catch (error) {
			log.error('Failed to save tweet:', { userId: 'admin', content, error });
			return fail(500, { content, error: 'Failed to save tweet. Please try again.' });
		}
	}
};
