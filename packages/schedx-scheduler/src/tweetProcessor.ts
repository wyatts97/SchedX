import { Tweet, TweetStatus, UserAccount } from '@schedx/shared-lib';
import { DatabaseClient } from '@schedx/shared-lib/backend';
import { TokenManager } from './tokenManager.js';
import { log } from './logger.js';
import { TwitterApi } from 'twitter-api-v2';
import { ORIGIN } from './config.js';

export class TweetProcessor {
  private dbClient: DatabaseClient;
  private tokenManager: TokenManager;

  constructor(dbClient: DatabaseClient) {
    this.dbClient = dbClient;
    this.tokenManager = new TokenManager(dbClient);
  }

  /**
   * Handle Twitter API errors with specific error codes
   */
  private handleTwitterError(error: any): string {
    if (error.code === 187) {
      return 'Duplicate tweet content';
    } else if (error.code === 186) {
      return 'Tweet too long (exceeds 280 characters)';
    } else if (error.code === 170) {
      return 'Missing required parameter';
    } else if (error.code === 88 || error.code === 429) {
      return 'Rate limit exceeded';
    } else if (error.code === 89) {
      return 'Invalid or expired token';
    } else if (error.code === 32) {
      return 'Could not authenticate you';
    } else if (error.code === 64) {
      return 'Your account is suspended and is not permitted to access this feature';
    }
    return error.message || 'Unknown Twitter error';
  }

  /**
   * Upload media to Twitter
   */
  private async uploadMedia(twitterClient: TwitterApi, mediaUrl: string, mediaType?: string): Promise<string> {
    try {
      // Construct absolute URL for the media file
      const absoluteMediaUrl = mediaUrl.startsWith('http') 
        ? mediaUrl 
        : `${ORIGIN}${mediaUrl}`;

      // Download the media file
      const response = await fetch(absoluteMediaUrl);
      if (!response.ok) {
        throw new Error(`Failed to download media: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      
      // Determine media type for Twitter API v1.1
      let twitterMediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'video/mp4' = 'image/jpeg';
      if (mediaType === 'video') {
        twitterMediaType = 'video/mp4';
      } else if (mediaType === 'gif') {
        twitterMediaType = 'image/gif';
      } else if (mediaType === 'png') {
        twitterMediaType = 'image/png';
      }
      
      // Upload media using OAuth 1.0a client (v1.1 API)
      // Note: Twitter API v2 media upload requires OAuth 1.0a authentication
      const mediaId = await twitterClient.v1.uploadMedia(Buffer.from(buffer), { 
        mimeType: twitterMediaType 
      });
      
      log.info('Media uploaded successfully', {
        mediaId,
        mediaUrl,
        mediaType: twitterMediaType
      });
      
      return mediaId;
    } catch (error: any) {
      // Handle rate limiting specifically
      if (error?.code === 429) {
        log.error('Rate limit exceeded during media upload:', {
          mediaUrl,
          mediaType,
          error: error.message,
          rateLimit: error.rateLimit
        });
        throw new Error('Twitter API rate limit exceeded. Please try again in a few minutes.');
      }
      
      log.error('Failed to upload media:', {
        mediaUrl,
        mediaType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async processUserTweets(userId: string, tweets: Tweet[]): Promise<void> {
    log.info(`Processing ${tweets.length} tweets for user ${userId}`, { 
      userId,
      tweetCount: tweets.length 
    });
    try {
      const userAccounts = await this.dbClient.getUserAccounts(userId);
      if (userAccounts.length === 0) {
        await this.markTweetsAsFailed(tweets, `No accounts found for user ${userId}`, userId);
        return;
      }

      const twitterAccount = userAccounts.find((account: UserAccount) => account.provider === 'twitter');
      if (!twitterAccount) {
        await this.markTweetsAsFailed(tweets, `No Twitter account found for user ${userId}`, userId);
        return;
      }

      // Get OAuth 2.0 client for text tweets
      const twitterClient: TwitterApi = await this.tokenManager.getTwitterApiClient(twitterAccount as UserAccount);
      
      // Get OAuth 1.0a client for media uploads (if needed)
      let oauth1Client: TwitterApi | null = null;
      try {
        oauth1Client = await this.tokenManager.getOAuth1Client(twitterAccount as UserAccount);
        log.info('OAuth 1.0a client created successfully for media uploads', { userId });
      } catch (error) {
        log.warn('OAuth 1.0a client not available for media uploads', { 
          userId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }

      for (const tweet of tweets) {
        try {
          log.info(`Posting tweet for user ${userId}`, { 
            userId, 
            tweetId: tweet.id,
            scheduledDate: tweet.scheduledDate 
          });

          const tweetData: any = {
            text: tweet.content,
          };

          // Add media if present
          if (tweet.media && tweet.media.length > 0) {
            if (!oauth1Client) {
              log.error(`Cannot upload media for tweet ${tweet.id}: OAuth 1.0a credentials not configured`, { 
                userId, 
                tweetId: tweet.id 
              });
              // Continue without media rather than failing the entire tweet
            } else {
              const mediaIds = [];
              for (const media of tweet.media) {
                try {
                  const mediaId = await this.uploadMedia(oauth1Client, media.url, media.type);
                  mediaIds.push(mediaId);
                } catch (mediaError: any) {
                  // Handle rate limiting specifically
                  if (mediaError?.code === 429) {
                    log.error(`Rate limit exceeded during media upload for tweet ${tweet.id}:`, { 
                      userId, 
                      tweetId: tweet.id, 
                      mediaUrl: media.url, 
                      mediaType: media.type,
                      error: mediaError.message,
                      rateLimit: mediaError.rateLimit
                    });
                    // Continue without this media rather than failing the entire tweet
                  } else {
                    log.error(`Failed to upload media for tweet ${tweet.id}:`, { 
                      userId, 
                      tweetId: tweet.id, 
                      mediaUrl: media.url, 
                      mediaType: media.type,
                      error: mediaError 
                    });
                  }
                  // Continue without this media rather than failing the entire tweet
                }
              }
              
              if (mediaIds.length > 0) {
                tweetData.media = { media_ids: mediaIds };
              }
            }
          }

          // Post tweet using v2 API
          const postedTweet = await twitterClient.v2.tweet(tweetData);
          
          if (postedTweet.data) {
            await this.dbClient.updateTweetStatus(tweet.id!, TweetStatus.POSTED);
            await this.dbClient.updateTweetTwitterId(tweet.id!, postedTweet.data.id);
            log.info(`Successfully posted tweet for user ${userId}`, { 
              userId, 
              tweetId: tweet.id,
              twitterTweetId: postedTweet.data.id 
            });
          } else {
            throw new Error('No tweet data returned from Twitter API');
          }
        } catch (error: any) {
          // Handle rate limiting specifically
          if (error?.code === 429) {
            log.error(`Rate limit exceeded when posting tweet for user ${userId}:`, { 
              userId, 
              tweetId: tweet.id, 
              error: error.message,
              rateLimit: error.rateLimit
            });
            // Mark as failed due to rate limiting
            await this.dbClient.updateTweetStatus(tweet.id!, TweetStatus.FAILED);
          } else {
            const errorMessage = this.handleTwitterError(error);
            log.error(`Failed to post tweet for user ${userId}:`, { 
              userId, 
              tweetId: tweet.id, 
              error: errorMessage,
              originalError: error 
            });
            await this.dbClient.updateTweetStatus(tweet.id!, TweetStatus.FAILED);
          }
        }
      }
    } catch (error) {
      log.error(`Error processing tweets for user ${userId}:`, { userId, error });
      await this.markTweetsAsFailed(tweets, `Error processing tweets: ${error}`, userId);
    }
  }

  private async markTweetsAsFailed(tweets: Tweet[], reason: string, userId: string): Promise<void> {
    log.error(`Marking ${tweets.length} tweets as failed for user ${userId}: ${reason}`, { 
      userId, 
      tweetCount: tweets.length, 
      reason 
    });
    
    for (const tweet of tweets) {
      try {
        await this.dbClient.updateTweetStatus(tweet.id!, TweetStatus.FAILED);
      } catch (error) {
        log.error(`Failed to mark tweet ${tweet.id} as failed:`, { userId, tweetId: tweet.id, error });
      }
    }
  }
} 