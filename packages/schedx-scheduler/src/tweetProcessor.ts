import { Tweet, TweetStatus, UserAccount } from '@schedx/shared-lib';
import { DatabaseClient, EmailService } from '@schedx/shared-lib/backend';
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
   * Get email service for a user based on their Resend settings
   */
  private async getEmailServiceForUser(userId: string): Promise<EmailService | null> {
    try {
      // Get user's Resend settings from database
      const resendSettings = await (this.dbClient as any).getResendSettings(userId);
      
      if (!resendSettings || !resendSettings.enabled || !resendSettings.apiKey) {
        return null;
      }

      // Create and return email service instance
      return new EmailService({
        enabled: true,
        provider: 'resend',
        apiKey: resendSettings.apiKey,
        fromEmail: resendSettings.fromEmail || 'noreply@schedx.app',
        fromName: resendSettings.fromName || 'SchedX'
      });
    } catch (error) {
      log.error('Error getting email service for user', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
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

      // Get OAuth 1.0a client for posting tweets and media uploads
      // Note: Twitter API v2 requires OAuth 1.0a for write operations (posting tweets)
      let oauth1Client: TwitterApi | null = null;
      try {
        oauth1Client = await this.tokenManager.getOAuth1Client(twitterAccount as UserAccount);
        log.info('OAuth 1.0a client created successfully for posting tweets', { userId });
      } catch (error) {
        const errorMsg = `OAuth 1.0a credentials not configured. Cannot post tweets without OAuth 1.0a authentication.`;
        log.error(errorMsg, { 
          userId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        await this.markTweetsAsFailed(tweets, errorMsg, userId);
        return;
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
            log.info(`Tweet has ${tweet.media.length} media items to upload`, {
              userId,
              tweetId: tweet.id,
              mediaCount: tweet.media.length,
              mediaUrls: tweet.media.map(m => m.url)
            });
            
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
                  log.info(`Uploading media: ${media.url}`, {
                    userId,
                    tweetId: tweet.id,
                    mediaUrl: media.url,
                    mediaType: media.type
                  });
                  const mediaId = await this.uploadMedia(oauth1Client, media.url, media.type);
                  mediaIds.push(mediaId);
                  log.info(`Media uploaded successfully: ${mediaId}`, {
                    userId,
                    tweetId: tweet.id,
                    mediaId
                  });
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

          // Post tweet using v2 API with OAuth 1.0a authentication
          log.info('Attempting to post tweet', {
            userId,
            tweetId: tweet.id,
            hasMedia: !!tweetData.media,
            mediaCount: tweetData.media?.media_ids?.length || 0,
            contentLength: tweetData.text?.length || 0
          });
          
          const postedTweet = await oauth1Client.v2.tweet(tweetData);
          
          if (postedTweet.data) {
            await this.dbClient.updateTweetStatus(tweet.id!, TweetStatus.POSTED);
            await this.dbClient.updateTweetTwitterId(tweet.id!, postedTweet.data.id);
            log.info(`Successfully posted tweet for user ${userId}`, { 
              userId, 
              tweetId: tweet.id,
              twitterTweetId: postedTweet.data.id 
            });
            
            // Send success email notification
            await this.sendSuccessNotification(userId, tweet, twitterAccount, postedTweet.data.id);
          } else {
            throw new Error('No tweet data returned from Twitter API');
          }
        } catch (error: any) {
          // Handle rate limiting specifically
          if (error?.code === 429) {
            const errorMessage = 'Twitter API rate limit exceeded. Please try again in a few minutes.';
            log.error(`Rate limit exceeded when posting tweet for user ${userId}:`, { 
              userId, 
              tweetId: tweet.id, 
              error: error.message,
              rateLimit: error.rateLimit
            });
            // Mark as failed due to rate limiting
            await this.dbClient.updateTweetStatus(tweet.id!, TweetStatus.FAILED);
            // Send failure notification
            await this.sendFailureNotification(userId, tweet, twitterAccount, errorMessage);
          } else {
            const errorMessage = this.handleTwitterError(error);
            log.error(`Failed to post tweet for user ${userId}:`, { 
              userId, 
              tweetId: tweet.id, 
              error: errorMessage,
              originalError: error 
            });
            await this.dbClient.updateTweetStatus(tweet.id!, TweetStatus.FAILED);
            // Send failure notification
            await this.sendFailureNotification(userId, tweet, twitterAccount, errorMessage);
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log.error(`Error processing tweets for user ${userId}:`, { 
        userId, 
        error: errorMessage,
        stack: errorStack,
        fullError: error
      });
      await this.markTweetsAsFailed(tweets, `Error processing tweets: ${errorMessage}`, userId);
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

  /**
   * Send success email notification
   */
  private async sendSuccessNotification(
    userId: string,
    tweet: Tweet,
    account: UserAccount,
    twitterTweetId: string
  ): Promise<void> {
    try {
      // Get user email preferences
      const preferences = await this.dbClient.getEmailNotificationPreferences(userId);
      
      if (!preferences || !preferences.enabled || !preferences.onSuccess || !preferences.email) {
        log.debug('Email notifications not enabled for user', { userId });
        return;
      }

      // Get email service for this user
      const emailService = await this.getEmailServiceForUser(userId);
      if (!emailService || !emailService.isEnabled()) {
        log.debug('Email service not configured for user', { userId });
        return;
      }

      // Construct tweet URL
      const tweetUrl = `https://twitter.com/${account.username}/status/${twitterTweetId}`;

      // Send email
      const result = await emailService.sendTweetSuccessNotification(preferences.email, {
        tweetContent: tweet.content,
        tweetUrl,
        accountUsername: account.username,
        accountDisplayName: account.displayName || account.username,
        scheduledDate: tweet.scheduledDate,
        postedDate: new Date(),
        hasMedia: !!(tweet.media && tweet.media.length > 0),
        mediaCount: tweet.media?.length || 0
      });

      if (result.success) {
        log.info('Success email notification sent', { 
          userId, 
          tweetId: tweet.id,
          email: preferences.email,
          messageId: result.messageId 
        });
      } else {
        log.error('Failed to send success email notification', { 
          userId, 
          tweetId: tweet.id,
          error: result.error 
        });
      }
    } catch (error) {
      log.error('Error sending success email notification', { 
        userId, 
        tweetId: tweet.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send failure email notification
   */
  private async sendFailureNotification(
    userId: string,
    tweet: Tweet,
    account: UserAccount,
    errorMessage: string
  ): Promise<void> {
    try {
      // Get user email preferences
      const preferences = await this.dbClient.getEmailNotificationPreferences(userId);
      
      if (!preferences || !preferences.enabled || !preferences.onFailure || !preferences.email) {
        log.debug('Email notifications not enabled for user', { userId });
        return;
      }

      // Get email service for this user
      const emailService = await this.getEmailServiceForUser(userId);
      if (!emailService || !emailService.isEnabled()) {
        log.debug('Email service not configured for user', { userId });
        return;
      }

      // Send email
      const result = await emailService.sendTweetFailureNotification(preferences.email, {
        tweetContent: tweet.content,
        accountUsername: account.username,
        accountDisplayName: account.displayName || account.username,
        scheduledDate: tweet.scheduledDate,
        postedDate: new Date(),
        hasMedia: !!(tweet.media && tweet.media.length > 0),
        mediaCount: tweet.media?.length || 0,
        errorMessage
      });

      if (result.success) {
        log.info('Failure email notification sent', { 
          userId, 
          tweetId: tweet.id,
          email: preferences.email,
          messageId: result.messageId 
        });
      } else {
        log.error('Failed to send failure email notification', { 
          userId, 
          tweetId: tweet.id,
          error: result.error 
        });
      }
    } catch (error) {
      log.error('Error sending failure email notification', { 
        userId, 
        tweetId: tweet.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
} 