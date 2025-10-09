import { UserAccount } from '@schedx/shared-lib';
import { DatabaseClient } from '@schedx/shared-lib/backend';
import { log } from './logger.js';
import { TwitterApi } from 'twitter-api-v2';

export class TokenManager {
  private dbClient: DatabaseClient;

  constructor(dbClient: DatabaseClient) {
    this.dbClient = dbClient;
  }

  /**
   * Creates a Twitter API client with automatic token refreshing.
   * The UserAccount object will be updated in the database whenever the token is refreshed.
   */
  public async getTwitterApiClient(account: UserAccount): Promise<TwitterApi> {
    // Get the Twitter app configuration from the database
    const twitterApp = await this.dbClient.getTwitterApp(account.twitterAppId);
    if (!twitterApp) {
      throw new Error(`Twitter app not found for account ${account.userId}`);
    }

    // Create OAuth2 client for token refresh operations
    const oauthClient = new TwitterApi({
      clientId: twitterApp.clientId,
      clientSecret: twitterApp.clientSecret,
    });

    // Create authenticated client for v2 API calls
    const client = new TwitterApi(account.access_token);

    // Check if token needs refresh
    const now = Math.floor(Date.now() / 1000);
    if (account.expires_at && now >= account.expires_at - 300) { // Refresh 5 minutes before expiry
      try {
        log.info('Refreshing access token for account', { userId: account.userId });
        
        const {
          accessToken,
          refreshToken,
          expiresIn,
        } = await oauthClient.refreshOAuth2Token(account.refresh_token);

        // Update the account in the database
        const updatedAccount = {
          ...account,
          access_token: accessToken,
          refresh_token: refreshToken || account.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + expiresIn,
          expires_in: expiresIn,
          updatedAt: new Date(),
        };

        await this.dbClient.saveUserAccount(updatedAccount);
        log.info('Successfully refreshed access token', { userId: account.userId });

        // Return a new client with the refreshed access token
        return new TwitterApi(accessToken);
      } catch (error) {
        log.error('Failed to refresh access token', { 
          userId: account.userId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        throw new Error(`Failed to refresh access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return client;
  }

  /**
   * Creates an OAuth1.0a client for v1.1 API media uploads.
   * Twitter API v1.1 media uploads require OAuth1.0a authentication.
   */
  public async getOAuth1Client(account: UserAccount): Promise<TwitterApi> {
    // Get the Twitter app configuration from the database
    const twitterApp = await this.dbClient.getTwitterApp(account.twitterAppId);
    if (!twitterApp) {
      throw new Error(`Twitter app not found for account ${account.userId}`);
    }

    // Check if OAuth 1.0a credentials are available
    const missingCreds = [];
    if (!twitterApp.consumerKey) missingCreds.push('consumerKey');
    if (!twitterApp.consumerSecret) missingCreds.push('consumerSecret');
    if (!twitterApp.accessToken) missingCreds.push('accessToken');
    if (!twitterApp.accessTokenSecret) missingCreds.push('accessTokenSecret');
    
    if (missingCreds.length > 0) {
      throw new Error(`OAuth 1.0a credentials not configured for Twitter app ${twitterApp.id}. Missing: ${missingCreds.join(', ')}. All OAuth 1.0a credentials are required for posting tweets.`);
    }

    log.info('Creating OAuth 1.0a client', {
      userId: account.userId,
      twitterAppId: twitterApp.id,
      hasConsumerKey: !!twitterApp.consumerKey,
      hasConsumerSecret: !!twitterApp.consumerSecret,
      hasAccessToken: !!twitterApp.accessToken,
      hasAccessTokenSecret: !!twitterApp.accessTokenSecret
    });

    // Create OAuth1.0a client for v1.1 API media uploads
    return new TwitterApi({
      appKey: twitterApp.consumerKey,
      appSecret: twitterApp.consumerSecret,
      accessToken: twitterApp.accessToken,
      accessSecret: twitterApp.accessTokenSecret,
    });
  }
} 