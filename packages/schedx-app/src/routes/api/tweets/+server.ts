import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import type { Tweet, TwitterApp } from '@schedx/shared-lib/types/types';
import { TweetStatus } from '@schedx/shared-lib/types/types';
import logger, { log } from '$lib/server/logger';
import { TwitterApi } from 'twitter-api-v2';
import { createValidationMiddleware } from '$lib/validation/middleware';
import { z } from 'zod';
import { userRateLimit, RATE_LIMITS } from '$lib/rate-limiting';
import { TwitterAuthService } from '$lib/server/twitterAuth';
import { validateAccountOwnership, validateScheduledDate, validateThreadTweets } from '$lib/validation/accountValidation';
import { getAdminUserId } from '$lib/server/adminCache';
import { sanitizeTweetContent } from '$lib/utils/twitter';

// Tweet API validation schema
const tweetApiSchema = z.object({
	action: z.enum(['schedule', 'publish', 'draft', 'queue']),
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
		.default([])
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
		const userId = await getAdminUserId();
		if (!userId) {
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
			media
		} = data;

		// Validate account ownership
		const accountValidation = await validateAccountOwnership(accountId, userId);
		if (!accountValidation.valid) {
			return new Response(JSON.stringify({ error: accountValidation.error }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		const account = accountValidation.account;

		log.info('Account validated successfully');

		// Sanitize content to remove problematic characters
		const sanitizedContent = sanitizeTweetContent(content);
		
		// Create tweet object based on action
		const tweet: Partial<Tweet> = {
			userId: userId,
			content: sanitizedContent,
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

				case 'queue':
					tweet.status = TweetStatus.QUEUED;
					tweet.scheduledDate = new Date(); // Placeholder, will be set by queue processor
					// Get current queue length for this account to set position
					const allQueuedTweets = await (db as any).getTweetsByStatus(userId, TweetStatus.QUEUED);
					const accountQueuedTweets = allQueuedTweets.filter(
						(t: any) => t.twitterAccountId === account.providerAccountId
					);
					tweet.queuePosition = accountQueuedTweets.length;
					const queuedId = await db.saveTweet(tweet as Tweet);
					log.info('Tweet added to queue successfully', { 
						queuedId, 
						queuePosition: tweet.queuePosition,
						twitterAccountId: account.providerAccountId 
					});
					return new Response(
						JSON.stringify({
							id: queuedId,
							success: true,
							message: 'Tweet added to queue successfully'
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
					
					// Validate scheduled date
					const dateValidation = validateScheduledDate(new Date(scheduledDate));
					if (!dateValidation.valid) {
						return new Response(JSON.stringify({ error: dateValidation.error }), {
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
						// Log account details for debugging
						log.info('Publishing tweet - account details:', {
							accountId: account.id,
							providerAccountId: account.providerAccountId,
							twitterAppId: account.twitterAppId,
							username: account.username
						});

						// Get Twitter app configuration
						if (!account.twitterAppId) {
							throw new Error('Account is missing twitterAppId - please reconnect your Twitter account');
						}

						const twitterApp = await db.getTwitterApp(account.twitterAppId);
						if (!twitterApp) {
							throw new Error(`Twitter app configuration not found for ID: ${account.twitterAppId}`);
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

						// Get authenticated client with automatic token refresh
						const twitterAuth = TwitterAuthService.getInstance();
						const { client: twitterClient } = await twitterAuth.getAuthenticatedClient(account, twitterApp);

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

										// Determine media type for Twitter API v1.1 based on file extension
										// This is more accurate than relying on the logical type
										const ext = mediaItem.url.split('.').pop()?.toLowerCase() || '';
										let twitterMediaType: string;
										
										if (mediaItem.type === 'video') {
											// Map video extensions to proper MIME types
											switch (ext) {
												case 'webm':
													twitterMediaType = 'video/webm';
													break;
												case 'mov':
													twitterMediaType = 'video/quicktime';
													break;
												case 'mp4':
												default:
													twitterMediaType = 'video/mp4';
													break;
											}
										} else if (mediaItem.type === 'gif') {
											twitterMediaType = 'image/gif';
										} else {
											// Map image extensions to proper MIME types
											switch (ext) {
												case 'png':
													twitterMediaType = 'image/png';
													break;
												case 'gif':
													twitterMediaType = 'image/gif';
													break;
												case 'webp':
													twitterMediaType = 'image/webp';
													break;
												case 'jpg':
												case 'jpeg':
												default:
													twitterMediaType = 'image/jpeg';
													break;
											}
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
							userId: userId,
							content: content.trim(),
							scheduledDate: new Date(),
							community: '',
							status: TweetStatus.POSTED,
							createdAt: new Date(),
							recurrenceType: null,
							recurrenceInterval: null,
							recurrenceEndDate: null,
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

