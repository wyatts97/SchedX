import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDbInstance } from '$lib/server/db';
import { TweetStatus, type Tweet, getAvailableCommunities } from '@schedx/shared-lib';
import { log } from '$lib/server/logger.js';
import logger from '$lib/logger';

const TWEETS_PER_PAGE = 10;

export const load: PageServerLoad = async ({
	locals,
	url,
	cookies
}: {
	locals: App.Locals;
	url: URL;
	cookies: any;
}) => {
	// Check for admin session first
	const adminSession = cookies.get('admin_session');
	let userId = null;
	let isAdmin = false;

	if (adminSession && adminSession.trim() !== '') {
		try {
			const db = getDbInstance();

			// Verify session exists and is valid
			const session = await db.getSession(adminSession);
			if (session && session.data.user.username === 'admin') {
				const user = await (db as any).getAdminUserByUsername('admin');
				if (user) {
					userId = user.id;
					isAdmin = true;
				}
			}
		} catch (error) {
			logger.error('Error validating admin session');
		}
	}

	// If not admin, check OAuth session
	if (!userId) {
		const session = await locals.auth();
		if (!session?.user?.id) {
			throw redirect(303, '/signin');
		}
		userId = session.user.id;
	}

	// Fetch all user Twitter accounts
	const db = getDbInstance();
	const rawAccounts = isAdmin
		? await (db as any).getAllUserAccounts()
		: (await db.getUserAccounts(userId)) || [];

	// Transform accounts to match expected format
	const accounts = rawAccounts.map((account: any) => ({
		id: account.providerAccountId, // Use providerAccountId as the primary id for frontend
		userId: account.userId,
		username: account.username,
		provider: account.provider,
		providerAccountId: account.providerAccountId,
		displayName: account.displayName || account.username,
		profileImage: account.profileImage,
		isDefault: account.isDefault || false,
		createdAt: account.createdAt,
		updatedAt: account.updatedAt
	}));

	const twitterAccountId =
		url.searchParams.get('twitterAccountId') || (accounts[0]?.providerAccountId ?? '');

	const page = parseInt(url.searchParams.get('page') || '1');

	try {
		const [rawTweets, totalTweets] = await Promise.all([
			db.getTweets(userId, page, TWEETS_PER_PAGE, TweetStatus.SCHEDULED, 1, twitterAccountId),
			db.countTweets(userId, TweetStatus.SCHEDULED, twitterAccountId)
		]);

		// Ensure tweets have the media field
		const tweets = rawTweets.map((tweet) => ({
			...tweet,
			media: (tweet as any).media || []
		}));

		const availableCommunities = getAvailableCommunities();
		return {
			tweets,
			currentPage: page,
			totalPages: Math.ceil(totalTweets / TWEETS_PER_PAGE),
			session: null, // No OAuth session for admin
			accounts,
			selectedAccountId: twitterAccountId,
			availableCommunities
		};
	} catch (error) {
		log.error('Error loading scheduled tweets:', { userId, page, error });
		return fail(500, { error: 'Failed to load scheduled tweets.' });
	}
};

export const actions: Actions = {
	deleteTweet: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}
		const userId = session.user.id;

		const formData = await request.formData();
		const tweetId = formData.get('tweetId')?.toString();

		if (!tweetId) {
			return fail(400, { error: 'Tweet ID is required' });
		}

		try {
			const result = await getDbInstance().deleteTweet(tweetId, userId);

			if (!result.success) {
				return fail(404, { error: 'Tweet not found or you do not have permission to delete it' });
			}

			return { success: true, deletedTweetId: tweetId };
		} catch (error) {
			log.error('Error deleting tweet:', { userId, tweetId, error });
			return fail(500, { error: 'Failed to delete tweet' });
		}
	},
	createTweet: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}
		const userId = session.user.id;
		const formData = await request.formData();
		const content = formData.get('content') as string;
		const scheduledDateTimeStr = formData.get('scheduledDateTime') as string;
		const twitterAccountId = formData.get('twitterAccountId') as string;
		const timezone = formData.get('timezone') as string;
		const community = formData.get('community') as string;
		const recurrenceType = formData.get('recurrenceType') as string;
		const recurrenceInterval = formData.get('recurrenceInterval') as string;
		const recurrenceEndDate = formData.get('recurrenceEndDate') as string;
		const mediaJson = formData.get('media') as string;
		let media = [];
		try {
			media = mediaJson ? JSON.parse(mediaJson) : [];
		} catch {}
		if (!content || content.trim() === '') {
			return fail(400, { error: 'Tweet content is required' });
		}
		if (content.length > 280) {
			return fail(400, { error: 'Tweet content must be 280 characters or less' });
		}
		if (!scheduledDateTimeStr) {
			return fail(400, { error: 'Date and time are required' });
		}
		// Convert "YYYY-MM-DD HH:mm" to ISO string for Date parsing
		const scheduledDateTime = new Date(scheduledDateTimeStr.replace(' ', 'T'));
		if (isNaN(scheduledDateTime.getTime()) || scheduledDateTime < new Date()) {
			return fail(400, { error: 'Scheduled time must be in the future' });
		}
		if (!twitterAccountId) {
			return fail(400, { error: 'Twitter account is required.' });
		}
		try {
			await getDbInstance().saveTweet({
				userId,
				content,
				scheduledDate: scheduledDateTime,
				community: community || '',
				status: TweetStatus.SCHEDULED,
				createdAt: new Date(),
				recurrenceType: recurrenceType || null,
				recurrenceInterval: recurrenceInterval ? Number(recurrenceInterval) : null,
				recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
				media,
				twitterAccountId
			} as Tweet);
			return { success: true };
		} catch (error) {
			log.error('Failed to save tweet from calendar modal:', { userId, content, error });
			return fail(500, { error: 'Failed to save tweet. Please try again.' });
		}
	},
	rescheduleTweet: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}
		const userId = session.user.id;
		const formData = await request.formData();
		const tweetId = formData.get('tweetId') as string;
		const newDate = formData.get('newDate') as string; // YYYY-MM-DD
		if (!tweetId || !newDate) {
			return fail(400, { error: 'Tweet ID and new date are required.' });
		}
		try {
			const db = getDbInstance();
			// Find the tweet
			const tweets = await db.getTweets(userId, 1, 1, undefined, undefined, undefined);
			const tweet = tweets.find((t) => t.id === tweetId);
			if (!tweet) {
				return fail(404, { error: 'Tweet not found.' });
			}
			// Preserve the original time, update the date
			const oldDate = new Date(tweet.scheduledDate);
			const [year, month, day] = newDate.split('-').map(Number);
			const updatedDate = new Date(oldDate);
			updatedDate.setFullYear(year, month - 1, day);
			// Update in DB
			await db.updateTweet(tweetId, {
				scheduledDate: updatedDate,
				updatedAt: new Date()
			});
			return { success: true };
		} catch (error) {
			log.error('Failed to reschedule tweet:', { userId, tweetId, newDate, error });
			return fail(500, { error: 'Failed to reschedule tweet. Please try again.' });
		}
	}
};
