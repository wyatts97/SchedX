import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { TweetStatus } from '@schedx/shared-lib/types/types';
import { log } from '$lib/server/logger';
import { TwitterAuthService } from '$lib/server/twitterAuth';
import { TwitterApi } from 'twitter-api-v2';
import { validateAccountOwnership, validateScheduledDate, validateThreadTweets } from '$lib/validation/accountValidation';

// POST: Create a new thread
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const adminSession = cookies.get('admin_session');
		if (!adminSession) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const db = getDbInstance();
		const user = await (db as any).getAdminUserByUsername('admin');
		if (!user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		const userId = user.id;
		const body = await request.json();

		const { tweets, scheduledDate, accountId, action, title } = body;

		// Validate thread tweets
		const tweetsValidation = validateThreadTweets(tweets);
		if (!tweetsValidation.valid) {
			return new Response(
				JSON.stringify({ error: tweetsValidation.error }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		// Validate scheduled date if scheduling
		if (action === 'schedule' && scheduledDate) {
			const dateValidation = validateScheduledDate(new Date(scheduledDate));
			if (!dateValidation.valid) {
				return new Response(
					JSON.stringify({ error: dateValidation.error }),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}
		}

		// Handle immediate publish
		if (action === 'publish') {
			// Validate account ownership
			const accountValidation = await validateAccountOwnership(accountId, userId);
			if (!accountValidation.valid) {
				return new Response(JSON.stringify({ error: accountValidation.error }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			const account = accountValidation.account;

			// Get Twitter app configuration
			const twitterApp = await db.getTwitterApp(account.twitterAppId);
			if (!twitterApp) {
				return new Response(JSON.stringify({ error: 'Twitter app not found' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// Get authenticated client with automatic token refresh
			const twitterAuth = TwitterAuthService.getInstance();
			const { client: twitterClient } = await twitterAuth.getAuthenticatedClient(
				account,
				twitterApp
			);

			// Check if OAuth 1.0a credentials are available for media uploads
			const hasOAuth1Credentials =
				(twitterApp as any).consumerKey &&
				(twitterApp as any).consumerSecret &&
				(twitterApp as any).accessToken &&
				(twitterApp as any).accessTokenSecret;

			let oauth1Client: any = null;
			if (hasOAuth1Credentials) {
				oauth1Client = new TwitterApi({
					appKey: (twitterApp as any).consumerKey!,
					appSecret: (twitterApp as any).consumerSecret!,
					accessToken: (twitterApp as any).accessToken!,
					accessSecret: (twitterApp as any).accessTokenSecret!
				});
			}

			// Post tweets in sequence
			const tweetIds: string[] = [];
			let previousTweetId: string | undefined = undefined;

			for (let i = 0; i < tweets.length; i++) {
				const tweetContent = tweets[i];
				
				// Prepare tweet data
				const tweetData: any = {
					text: tweetContent.content
				};

				// Add reply reference if not the first tweet
				if (previousTweetId) {
					tweetData.reply = {
						in_reply_to_tweet_id: previousTweetId
					};
				}

				// Handle media if present
				if (tweetContent.media && tweetContent.media.length > 0 && oauth1Client) {
					const mediaIds: string[] = [];

					for (const mediaItem of tweetContent.media) {
						try {
							const response = await fetch(mediaItem.url);
							const buffer = await response.arrayBuffer();

							const twitterMediaType =
								mediaItem.type === 'video'
									? 'video/mp4'
									: mediaItem.type === 'gif'
										? 'image/gif'
										: 'image/jpeg';

							const mediaId = await oauth1Client.v1.uploadMedia(Buffer.from(buffer), {
								mimeType: twitterMediaType
							});

							mediaIds.push(mediaId);
						} catch (mediaError) {
							log.error('Failed to upload media for thread tweet', {
								position: i + 1,
								error: mediaError instanceof Error ? mediaError.message : 'Unknown error'
							});
						}
					}

					if (mediaIds.length > 0) {
						tweetData.media = { media_ids: mediaIds };
					}
				}

				// Post the tweet
				const postedTweet = await twitterClient.v2.tweet(tweetData);

				if (!postedTweet.data) {
					throw new Error(`No tweet data returned for tweet ${i + 1} in thread`);
				}

				tweetIds.push(postedTweet.data.id);
				previousTweetId = postedTweet.data.id;

				log.info('Thread tweet posted', {
					position: i + 1,
					total: tweets.length,
					twitterTweetId: postedTweet.data.id
				});

				// Small delay between tweets
				if (i < tweets.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 2000));
				}
			}

			// Save thread to database as posted
			const thread = {
				userId,
				title: title || `Thread (${tweets.length} tweets)`,
				twitterAccountId: account.providerAccountId,
				scheduledDate: new Date(),
				status: TweetStatus.POSTED,
				twitterThreadId: tweetIds[0],
				tweets: tweets.map((t: any, index: number) => ({
					content: t.content,
					media: t.media || [],
					position: index + 1
				}))
			};

			const threadId = await db.saveThread(thread);

			log.info('Thread published successfully', {
				threadId,
				tweetCount: tweetIds.length,
				firstTweetId: tweetIds[0]
			});

			return new Response(
				JSON.stringify({
					id: threadId,
					success: true,
					tweetIds,
					firstTweetUrl: `https://twitter.com/${account.username}/status/${tweetIds[0]}`,
					message: 'Thread published successfully'
				}),
				{
					status: 201,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		// Handle schedule/queue/draft
		const thread = {
			userId,
			title: title || `Thread (${tweets.length} tweets)`,
			twitterAccountId: accountId,
			scheduledDate: action === 'schedule' ? new Date(scheduledDate) : new Date(),
			status: action === 'schedule' ? TweetStatus.SCHEDULED : action === 'queue' ? TweetStatus.QUEUED : TweetStatus.DRAFT,
			tweets: tweets.map((t: any, index: number) => ({
				content: t.content,
				media: t.media || [],
				position: index + 1
			}))
		};

		const threadId = await db.saveThread(thread);

		log.info('Thread created successfully', {
			threadId,
			tweetCount: tweets.length,
			action
		});

		return new Response(
			JSON.stringify({
				id: threadId,
				success: true,
				message: `Thread ${action === 'schedule' ? 'scheduled' : action === 'queue' ? 'queued' : 'saved'} successfully`
			}),
			{
				status: 201,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error creating thread', { error });
		return new Response(
			JSON.stringify({
				error: 'Failed to create thread',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};

// GET: Fetch threads
export const GET: RequestHandler = async ({ url, cookies }) => {
	try {
		const adminSession = cookies.get('admin_session');
		if (!adminSession) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const db = getDbInstance();
		const user = await (db as any).getAdminUserByUsername('admin');
		if (!user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		const userId = user.id;
		const status = url.searchParams.get('status');

		const threads = await db.getThreads(userId, status);

		return new Response(
			JSON.stringify({
				threads,
				success: true
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error fetching threads', { error });
		return new Response(
			JSON.stringify({
				error: 'Failed to fetch threads',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};