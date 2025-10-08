import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { TweetStatus } from '@schedx/shared-lib/types/types';
import type { Tweet, TwitterApp } from '@schedx/shared-lib/types/types';
import logger, { log } from '$lib/server/logger';
import { TwitterApi } from 'twitter-api-v2';
import { createValidationMiddleware } from '$lib/validation/middleware';
import { z } from 'zod';
import { userRateLimit, RATE_LIMITS } from '$lib/rate-limiting';

// Tweet API validation schema
const tweetApiSchema = z.object({
	action: z.enum(['schedule', 'publish', 'draft', 'template', 'queue']),
	content: z
		.string()
		.min(1, 'Tweet content is required')
		.max(280, 'Tweet content cannot exceed 280 characters'),
	accountId: z.string().min(1, 'Invalid account ID'), // Changed from UUID to accept providerAccountId
	scheduledDate: z.coerce.date().optional(),
	recurrence: z
		.object({
			type: z.enum(['daily', 'weekly', 'monthly']).optional(),
			interval: z.number().int().positive().optional(),
			endDate: z.coerce.date().optional()
		})
		.optional(),
	media: z
		.array(
			z.object({
				url: z.string().min(1), // Changed from url() to accept relative paths like /uploads/file.jpg
				type: z.enum(['photo', 'gif', 'video'])
			})
		)
		.optional()
		.default([]),
	templateName: z.string().optional(),
	templateCategory: z.string().optional()
});

export const POST = userRateLimit(RATE_LIMITS.tweets)(
	createValidationMiddleware(tweetApiSchema)(async (data, { cookies, fetch }) => {
		const adminSession = cookies.get('admin_session');

		if (!adminSession || adminSession.trim() === '') {
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

		// Extract validated payload
		const {
			action,
			content,
			accountId,
			scheduledDate,
			recurrence,
			media,
			templateName,
			templateCategory
		} = data;

		// Look up account by database ID (which is what we receive as accountId from frontend)
		const allAccounts = await (db as any).getAllUserAccounts();
		const account = allAccounts.find((acc: any) => acc.id === accountId);
		
		if (!account) {
			log.error('Account not found by ID');
			return new Response(JSON.stringify({ error: 'Selected account not found' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		log.info('Account found successfully');

		// Create tweet object based on action
		const tweet: Partial<Tweet> = {
			userId: 'admin', // Since this is a single-user app
			content: content.trim(),
			twitterAccountId: account.providerAccountId, // Use providerAccountId for proper association
			media: media || [],
			createdAt: new Date(),
			updatedAt: new Date()
		};

		// Handle different actions
		try {
			switch (action) {
				case 'draft':
					tweet.status = TweetStatus.DRAFT;
					tweet.scheduledDate = new Date();
					const draftId = await db.saveTweet(tweet as Tweet);
					logger.info('Draft saved successfully');
					return new Response(
						JSON.stringify({
							id: draftId,
							success: true,
							message: 'Draft saved successfully'
						}),
						{
							status: 201,
							headers: { 'Content-Type': 'application/json' }
						}
					);

				case 'template':
					tweet.status = TweetStatus.DRAFT;
					tweet.scheduledDate = new Date();
					// Use provided template name or fallback to truncated content
					tweet.templateName = templateName || content.substring(0, 50) + (content.length > 50 ? '...' : '');
					// Optional category
					if (templateCategory) {
						// Extend type at runtime; DB layer can ignore unknown fields if unused
						(tweet as any).templateCategory = templateCategory;
					}
					const templateId = await db.saveTweet(tweet as Tweet);
					log.info('Template saved successfully', { templateId, accountId, templateName: tweet.templateName });
					return new Response(
						JSON.stringify({
							id: templateId,
							success: true,
							message: 'Template saved successfully'
						}),
						{
							headers: { 'Content-Type': 'application/json' }
						}
					);

				case 'queue':
				tweet.status = TweetStatus.QUEUED;
				tweet.scheduledDate = new Date(); // Placeholder, will be set by queue processor
				// Get current queue length to set position
				const queuedTweets = await (db as any).getTweetsByStatus(tweet.userId, TweetStatus.QUEUED);
				tweet.queuePosition = queuedTweets.length;
				const queuedId = await db.saveTweet(tweet as Tweet);
				log.info('Tweet added to queue successfully', { queuedId, queuePosition: tweet.queuePosition });
					return new Response(
						JSON.stringify({
							id: queuedId,
							success: true,
							message: 'Tweet added to queue successfully',
							queuePosition: tweet.queuePosition
						}),
						{
							status: 201,
							headers: { 'Content-Type': 'application/json' }
						}
					);

				case 'schedule':
					if (!scheduledDate) {
						return new Response(JSON.stringify({ error: 'Scheduled date is required' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}
					tweet.status = TweetStatus.SCHEDULED;
					tweet.scheduledDate = new Date(scheduledDate);

					// Handle recurrence
					if (recurrence && recurrence.type) {
						tweet.recurrenceType = recurrence.type;
						tweet.recurrenceInterval = recurrence.interval || 1; // Default interval
					}

					const scheduledId = await db.saveTweet(tweet as Tweet);
					logger.info('Tweet scheduled successfully');
					return new Response(
						JSON.stringify({
							id: scheduledId,
							success: true,
							message: 'Tweet scheduled successfully'
						}),
						{
							status: 201,
							headers: { 'Content-Type': 'application/json' }
						}
					);

				case 'publish':
					try {
						// Create Twitter client for immediate publishing
						// Check if token needs refresh
						const now = Math.floor(Date.now() / 1000);
						let accessToken = account.access_token;

						// Create Twitter client with proper OAuth2 setup for v2 API calls
						const twitterApp = await db.getTwitterApp(account.twitterAppId);
						if (!twitterApp) {
							throw new Error('Twitter app configuration not found');
						}

						// Log the complete Twitter app data for debugging
						log.info('Complete Twitter app data from database:', {
							appId: account.twitterAppId,
							appName: twitterApp.name,
							clientId: twitterApp.clientId ? 'SET' : 'NOT SET',
							clientSecret: twitterApp.clientSecret ? 'SET' : 'NOT SET',
							consumerKey: (twitterApp as any).consumerKey ? 'SET' : 'NOT SET',
							consumerSecret: (twitterApp as any).consumerSecret ? 'SET' : 'NOT SET',
							accessToken: (twitterApp as any).accessToken ? 'SET' : 'NOT SET',
							accessTokenSecret: (twitterApp as any).accessTokenSecret ? 'SET' : 'NOT SET',
							callbackUrl: twitterApp.callbackUrl
						});

						// Create OAuth2 client for token refresh operations
						const oauthClient = new TwitterApi({
							clientId: twitterApp.clientId,
							clientSecret: twitterApp.clientSecret
						});

						// Create authenticated client for v2 API calls
						let twitterClient = new TwitterApi(accessToken);

						// Check if OAuth 1.0a credentials are available for media uploads
						const hasOAuth1Credentials =
							(twitterApp as any).consumerKey &&
							(twitterApp as any).consumerSecret &&
							(twitterApp as any).accessToken &&
							(twitterApp as any).accessTokenSecret;

						// Log the exact values being checked for OAuth 1.0a credentials
						log.info('Checking OAuth 1.0a credentials:', {
							consumerKey: (twitterApp as any).consumerKey || 'NULL',
							consumerSecret: (twitterApp as any).consumerSecret || 'NULL',
							accessToken: (twitterApp as any).accessToken || 'NULL',
							accessTokenSecret: (twitterApp as any).accessTokenSecret || 'NULL',
							consumerKeyLength: (twitterApp as any).consumerKey?.length || 0,
							consumerSecretLength: (twitterApp as any).consumerSecret?.length || 0,
							accessTokenLength: (twitterApp as any).accessToken?.length || 0,
							accessTokenSecretLength: (twitterApp as any).accessTokenSecret?.length || 0,
							hasOAuth1Credentials
						});

						// Check if token needs refresh
						if (account.expires_at && now >= account.expires_at - 300) {
							// Token expires within 5 minutes, try to refresh
							try {
								log.info('Refreshing access token for immediate publish', { accountId });

								const {
									accessToken: newAccessToken,
									refreshToken: newRefreshToken,
									expiresIn
								} = await oauthClient.refreshOAuth2Token(account.refresh_token);

								// Update the account in the database
								const updatedAccount = {
									...account,
									access_token: newAccessToken,
									refresh_token: newRefreshToken || account.refresh_token,
									expires_at: Math.floor(Date.now() / 1000) + expiresIn,
									updatedAt: new Date()
								};

								await db.saveUserAccount(updatedAccount);
								accessToken = newAccessToken;
								log.info('Successfully refreshed access token for immediate publish', {
									accountId
								});

								// Create new authenticated client with refreshed token
								twitterClient = new TwitterApi(accessToken);
							} catch (refreshError) {
								log.error('Failed to refresh access token for immediate publish:', {
									accountId,
									error: refreshError instanceof Error ? refreshError.message : 'Unknown error'
								});
								// Continue with existing token
							}
						}

						// Log the Twitter app configuration for debugging
						log.info('Twitter app configuration for media upload:', {
							appId: account.twitterAppId,
							appName: twitterApp?.name,
							hasClientId: !!twitterApp?.clientId,
							hasClientSecret: !!twitterApp?.clientSecret,
							hasOAuth1Credentials,
							accountId,
							accessTokenLength: accessToken?.length || 0
						});

						// Verify the client can make API calls
						try {
							const me = await twitterClient.v2.me();
							log.info('Twitter client authenticated successfully', {
								accountId,
								userId: me.data?.id,
								username: me.data?.username
							});
						} catch (authError) {
							log.error('Twitter client authentication failed:', {
								accountId,
								error: authError instanceof Error ? authError.message : 'Unknown error'
							});
							throw new Error('Twitter authentication failed');
						}

						// Prepare tweet data
						const tweetData: any = {
							text: content.trim()
						};

						// Handle media upload if present
						if (media && media.length > 0) {
							// Check if OAuth 1.0a credentials are available for media uploads
							const hasOAuth1Credentials =
								(twitterApp as any).consumerKey &&
								(twitterApp as any).consumerSecret &&
								(twitterApp as any).accessToken &&
								(twitterApp as any).accessTokenSecret;

							if (!hasOAuth1Credentials) {
								log.error('Cannot upload media: OAuth 1.0a credentials not configured', {
									appId: account.twitterAppId,
									accountId
								});
								// Continue without media rather than failing the entire tweet
							} else {
								// Create OAuth 1.0a client for media uploads
								const oauth1Client = new TwitterApi({
									appKey: (twitterApp as any).consumerKey,
									appSecret: (twitterApp as any).consumerSecret,
									accessToken: (twitterApp as any).accessToken,
									accessSecret: (twitterApp as any).accessTokenSecret
								});

								// Upload media files
								const mediaIds = [];
								for (const mediaItem of media) {
									try {
										// Construct absolute URL for the media file
										const port = process.env.PORT || '5173';
										const baseUrl = process.env.ORIGIN || `http://localhost:${port}`;
										const mediaUrl = mediaItem.url.startsWith('http')
											? mediaItem.url
											: `${baseUrl}${mediaItem.url}`;

										log.info('Uploading media for immediate publish', {
											mediaUrl: mediaItem.url,
											absoluteMediaUrl: mediaUrl,
											mediaType: mediaItem.type,
											accountId,
											baseUrl
										});

										// Download the media file using event.fetch
										const response = await fetch(mediaUrl);
										if (!response.ok) {
											throw new Error(`Failed to download media: ${response.statusText}`);
										}

										const buffer = await response.arrayBuffer();

										// Determine media type for Twitter API v1.1 (by logical type)
										let twitterMediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'video/mp4' = 'image/jpeg';
										if (mediaItem.type === 'video') {
											twitterMediaType = 'video/mp4';
										} else if (mediaItem.type === 'gif') {
											twitterMediaType = 'image/gif';
										} else {
											// photo -> default to JPEG
											twitterMediaType = 'image/jpeg';
										}

										// Upload media using OAuth 1.0a client (v1.1 API)
										// Note: Twitter API v2 media upload requires OAuth 1.0a authentication
										const mediaId = await oauth1Client.v1.uploadMedia(Buffer.from(buffer), {
											mimeType: twitterMediaType
										});

										mediaIds.push(mediaId);
										log.info('Media uploaded successfully', {
											mediaId,
											mediaUrl: mediaItem.url,
											accountId
										});
									} catch (mediaError: any) {
										// Handle rate limiting specifically
										if (mediaError?.code === 429) {
											log.error('Rate limit exceeded during media upload:', {
												mediaUrl: mediaItem.url,
												mediaType: mediaItem.type,
												accountId,
												error: mediaError.message,
												rateLimit: mediaError.rateLimit
											});
											// Continue without this media rather than failing the entire tweet
											continue;
										}

										log.error('Failed to upload media for immediate publish:', {
											mediaUrl: mediaItem.url,
											mediaType: mediaItem.type,
											accountId,
											error: mediaError instanceof Error ? mediaError.message : 'Unknown error'
										});

										// Continue without this media rather than failing the entire tweet
										continue;
									}
								}

								// Add media IDs to tweet data if any were uploaded successfully
								if (mediaIds.length > 0) {
									tweetData.media = { media_ids: mediaIds };
									log.info('Added media IDs to tweet', {
										mediaIds,
										mediaCount: mediaIds.length,
										accountId
									});
								}
							}
						}

						// Post the tweet
						const postedTweet = await twitterClient.v2.tweet(tweetData);

						if (!postedTweet.data) {
							throw new Error('No tweet data returned from Twitter API');
						}

						// Save the tweet to database with posted status
						const tweet: Tweet = {
							userId: 'admin',
							content: content.trim(),
							scheduledDate: new Date(),
							community: '',
							status: TweetStatus.POSTED,
							createdAt: new Date(),
							recurrenceType: null,
							recurrenceInterval: null,
							recurrenceEndDate: null,
							templateName: undefined,
							templateCategory: undefined,
							media: media || [],
							twitterAccountId: account.providerAccountId, // Use providerAccountId for consistency
							twitterTweetId: postedTweet.data.id,
							updatedAt: new Date()
						};

						const publishedId = await db.saveTweet(tweet);

						// Construct the tweet URL
						const tweetUrl = `https://twitter.com/${account.username}/status/${postedTweet.data.id}`;

						log.info('Tweet published successfully', {
							tweetId: publishedId,
							twitterTweetId: postedTweet.data.id,
							tweetUrl,
							accountId
						});

						return new Response(
							JSON.stringify({
								success: true,
								message: 'Tweet published successfully',
								twitterTweetId: postedTweet.data.id,
								tweetUrl,
								username: account.username
							}),
							{
								status: 200,
								headers: { 'Content-Type': 'application/json' }
							}
						);
					} catch (twitterError) {
						log.error('Failed to publish tweet immediately:', {
							accountId,
							content: content.substring(0, 50),
							error: twitterError instanceof Error ? twitterError.message : 'Unknown error',
							stack: twitterError instanceof Error ? twitterError.stack : undefined,
							hasMedia: media && media.length > 0,
							mediaCount: media ? media.length : 0
						});

						// Provide more specific error messages
						let errorMessage = 'Failed to publish tweet';
						if (twitterError instanceof Error) {
							if (twitterError.message.includes('401')) {
								errorMessage = 'Twitter authentication failed. Please reconnect your account.';
							} else if (twitterError.message.includes('403')) {
								errorMessage = 'Twitter API access denied. Please check your app permissions.';
							} else if (twitterError.message.includes('429')) {
								errorMessage = 'Twitter rate limit exceeded. Please try again later.';
							} else {
								errorMessage = `Failed to publish tweet: ${twitterError.message}`;
							}
						}

						return new Response(
							JSON.stringify({
								error: errorMessage
							}),
							{
								status: 500,
								headers: { 'Content-Type': 'application/json' }
							}
						);
					}

				default:
					return new Response(JSON.stringify({ error: 'Invalid action' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					});
			}
		} catch (error) {
			logger.error('Error creating tweet');
			return new Response(JSON.stringify({ error: 'Failed to create tweet' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	})
);
