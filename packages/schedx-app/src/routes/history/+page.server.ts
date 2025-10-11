import type { Actions, PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { TweetStatus } from '@schedx/shared-lib';
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
		: await db.getUserAccounts(userId);

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

	const page = Number(url.searchParams.get('page')) || 1;

	try {
		const statusFilter = [TweetStatus.POSTED, TweetStatus.FAILED];
		logger.debug('=== History Page Debug ===');
		logger.debug('=== History Page Debug ===');

		// Debug: Check if there are any tweets at all for this user
		const allTweets = await db.getTweets(userId, 1, 100, undefined, -1, undefined);
		logger.debug('All tweets for user (any status)');

		const [tweets, totalTweets] = await Promise.all([
			db.getTweets(userId, page, TWEETS_PER_PAGE, statusFilter, -1, twitterAccountId),
			db.countTweets(userId, statusFilter, twitterAccountId)
		]);

		logger.debug('Database returned tweets');
		logger.debug('Total tweets count');
		logger.debug('Tweets length');

		return {
			tweets,
			currentPage: page,
			totalPages: Math.ceil(totalTweets / TWEETS_PER_PAGE),
			session: null, // No OAuth session for admin
			accounts,
			selectedAccountId: twitterAccountId
		};
	} catch (err) {
		log.error('Error fetching tweet history:', { userId, page, error: err });
		throw error(500, 'Failed to load tweets');
	}
};
