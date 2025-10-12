import { MongoClient, ObjectId } from 'mongodb';
import { TweetStatus, Tweet, UserAccount, Notification } from '../types/types.js';
import { EncryptionService } from './encryption.js';
import pino from 'pino';

const DB_NAME = 'schedx';

// Create logger for database operations
const logger = pino({
	level: process.env.LOG_LEVEL || 'info',
	timestamp: pino.stdTimeFunctions.isoTime
});

export class DatabaseClient {
  private static instance: DatabaseClient;
  private client: MongoClient;
  private connected = false;
  private mongoDbUri: string;
  private encryptionService: EncryptionService;

  private constructor(mongoDbUri: string, authSecret: string) {
    this.mongoDbUri = mongoDbUri;
    this.client = new MongoClient(this.mongoDbUri);
    if (!authSecret) {
        throw new Error("Auth Secret is required for DatabaseClient initialization");
    }
    this.encryptionService = new EncryptionService(authSecret);
  }

  public static getInstance(mongoDbUri?: string, authSecret?: string): DatabaseClient {
    if (!DatabaseClient.instance) {
      if (!mongoDbUri) {
        throw new Error("MongoDB URI is required for the first instantiation of DatabaseClient");
      }
      if (!authSecret) {
        throw new Error("Auth Secret is required for the first instantiation of DatabaseClient");
      }
      DatabaseClient.instance = new DatabaseClient(mongoDbUri, authSecret);
    }
    return DatabaseClient.instance;
  }

  async connect() {
    if (!this.connected) {
      try {
        await this.client.connect();
        this.connected = true;
        logger.info({ uri: this.mongoDbUri.replace(/\/\/[^@]+@/, '//***@') }, 'Connected to MongoDB');
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'MongoDB connection failed');
        throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    return this.client.db(DB_NAME);
  }

  // Save a tweet with required twitterAccountId
  async saveTweet(tweet: Tweet) {
    if (!tweet.twitterAccountId) {
      throw new Error('twitterAccountId is required for multi-account support');
    }
    const db = await this.connect();
    const result = await db.collection('tweets').insertOne(tweet);
    return result.insertedId;
  }

  // Get tweets by userId and optional twitterAccountId
  async getTweets(
    userId: string, 
    page: number, 
    limit: number, 
    status: TweetStatus | TweetStatus[] = TweetStatus.SCHEDULED,
    sortDirection: 1 | -1 = 1, // 1 for ascending (default for scheduled), -1 for descending (for history)
    twitterAccountId?: string
  ) {
    const db = await this.connect();
    const skip = (page - 1) * limit;
    const query: any = {
      userId,
      status: Array.isArray(status) ? { $in: status } : status
    };
    if (twitterAccountId) {
      query.twitterAccountId = twitterAccountId;
    }
    const tweetsFromDb = await db.collection('tweets')
      .find(query)
      .sort({ scheduledDate: sortDirection })
      .skip(skip)
      .limit(limit)
      .toArray();
    return tweetsFromDb.map(tweet => ({
      id: tweet._id.toString(),
      userId: tweet.userId,
      content: tweet.content,
      scheduledDate: new Date(tweet.scheduledDate),
      community: tweet.community,
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterAccountId: tweet.twitterAccountId,
      twitterTweetId: tweet.twitterTweetId,
      media: tweet.media || []
    }));
  }
  
  // Legacy method for backward compatibility
  async getScheduledTweets(userId: string, page: number, limit: number, twitterAccountId?: string) {
    return this.getTweets(userId, page, limit, TweetStatus.SCHEDULED, 1, twitterAccountId);
  }
  
  // Legacy method for backward compatibility
  async getHistoryTweets(userId: string, page: number, limit: number, twitterAccountId?: string) {
    return this.getTweets(userId, page, limit, [TweetStatus.POSTED, TweetStatus.FAILED], -1, twitterAccountId);
  }
  
  async countTweets(userId: string, status: TweetStatus | TweetStatus[] = TweetStatus.SCHEDULED, twitterAccountId?: string) {
    const db = await this.connect();
    const query: any = {
      userId,
      status: Array.isArray(status) ? { $in: status } : status
    };
    if (twitterAccountId) {
      query.twitterAccountId = twitterAccountId;
    }
    return db.collection('tweets').countDocuments(query);
  }
  
  // Legacy method for backward compatibility
  async countScheduledTweets(userId: string, twitterAccountId?: string) {
    return this.countTweets(userId, TweetStatus.SCHEDULED, twitterAccountId);
  }
  
  // Legacy method for backward compatibility
  async countHistoryTweets(userId: string, twitterAccountId?: string) {
    return this.countTweets(userId, [TweetStatus.POSTED, TweetStatus.FAILED], twitterAccountId);
  }
  
  async deleteTweet(tweetId: string, userId: string, twitterAccountId?: string) {
    const db = await this.connect();
    try {
      const objectId = new ObjectId(tweetId);
      const query: any = {
        _id: objectId,
        userId: userId
      };
      if (twitterAccountId) {
        query.twitterAccountId = twitterAccountId;
      }
      const result = await db.collection('tweets').deleteOne(query);
      return {
        success: result.deletedCount > 0,
        deletedCount: result.deletedCount
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error', tweetId }, 'Error deleting tweet');
      throw error;
    }
  }

  async close() {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
      logger.info({}, 'Disconnected from MongoDB');
    }
  }

  // Create or update a user account
  async saveUserAccount(userAccount: UserAccount): Promise<string> {
    const db = await this.connect();
    
    // Encrypt sensitive data
    const encryptedAccount = {
      ...userAccount,
      access_token: this.encryptionService.encrypt(userAccount.access_token),
      refresh_token: this.encryptionService.encrypt(userAccount.refresh_token),
      updatedAt: new Date()
    };
    
    // Check if user account already exists by providerAccountId (more specific)
    const existingAccount = await db.collection('accounts').findOne({
      providerAccountId: userAccount.providerAccountId
    });
    
    if (existingAccount) {
      // Update existing account
      await db.collection('accounts').updateOne(
        { _id: existingAccount._id },
        { $set: encryptedAccount }
      );
      
      // Wait for write to be acknowledged
      await db.collection('accounts').findOne({ _id: existingAccount._id });
      
      return existingAccount._id.toString();
    } else {
      // Insert new account with creation time
      const result = await db.collection('accounts').insertOne({
        ...encryptedAccount,
        createdAt: new Date()
      });
      
      // Wait for write to be acknowledged and verify it was saved
      const savedAccount = await db.collection('accounts').findOne({ _id: result.insertedId });
      if (!savedAccount) {
        throw new Error('Failed to save user account - write not acknowledged');
      }
      
      return result.insertedId.toString();
    }
  }

  // Get user account with decrypted tokens
  async getUserAccount(userId: string, provider: string): Promise<UserAccount | null> {
    const db = await this.connect();
    
    const account = await db.collection('accounts').findOne({
      userId,
      provider
    });
    
    if (!account) return null;
    
    // Decrypt sensitive data and remove MongoDB _id
    const { _id, ...accountData } = account;
    return {
      ...accountData,
      access_token: this.encryptionService.decrypt(account.access_token),
      refresh_token: this.encryptionService.decrypt(account.refresh_token)
    } as UserAccount;
  }

  // Get user account by providerAccountId (for admin operations)
  async getUserAccountByProviderId(providerAccountId: string): Promise<UserAccount | null> {
    const db = await this.connect();
    
    const account = await db.collection('accounts').findOne({
      providerAccountId
    });
    
    if (!account) return null;
    
    // Decrypt sensitive data and remove MongoDB _id
    const { _id, ...accountData } = account;
    return {
      id: _id.toString(),
      ...accountData,
      access_token: this.encryptionService.decrypt(account.access_token),
      refresh_token: this.encryptionService.decrypt(account.refresh_token)
    } as UserAccount;
  }

  // Verify account exists with retry logic
  async verifyAccountExists(providerAccountId: string, maxRetries: number = 3): Promise<boolean> {
    const db = await this.connect();
    
    for (let i = 0; i < maxRetries; i++) {
      const account = await db.collection('accounts').findOne({
        providerAccountId
      });
      
      if (account) {
        return true;
      }
      
      // Wait before retry (exponential backoff)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 500));
      }
    }
    
    return false;
  }

  // Get user account by database ID (for API operations)
  async getUserAccountById(accountId: string): Promise<UserAccount | null> {
    const db = await this.connect();
    
    const account = await db.collection('accounts').findOne({
      _id: new ObjectId(accountId)
    });
    
    if (!account) return null;
    
    // Decrypt sensitive data and remove MongoDB _id
    const { _id, ...accountData } = account;
    return {
      id: _id.toString(),
      ...accountData,
      access_token: this.encryptionService.decrypt(account.access_token),
      refresh_token: this.encryptionService.decrypt(account.refresh_token)
    } as UserAccount;
  }

  // Get all user accounts for a user
  async getUserAccounts(userId: string): Promise<UserAccount[]> {
    const db = await this.connect();
    
    const accounts = await db.collection('accounts').find({
      userId
    }).toArray();
    
    // Decrypt sensitive data for all accounts
    return accounts.map(account => {
      const { _id, ...accountData } = account;
      return {
        ...accountData,
        access_token: this.encryptionService.decrypt(account.access_token),
        refresh_token: this.encryptionService.decrypt(account.refresh_token)
      } as UserAccount;
    });
  }

  // Get all user accounts (for admin management)
  async getAllUserAccounts(): Promise<UserAccount[]> {
    const db = await this.connect();
    
    const accounts = await db.collection('accounts').find({}).toArray();
    
    // Decrypt sensitive data for all accounts
    return accounts.map(account => {
      const { _id, ...accountData } = account;
      return {
        id: _id.toString(),
        ...accountData,
        access_token: this.encryptionService.decrypt(account.access_token),
        refresh_token: this.encryptionService.decrypt(account.refresh_token)
      } as UserAccount;
    });
  }

  // Clear all default account flags
  async clearDefaultAccounts(): Promise<void> {
    const db = await this.connect();
    await db.collection('accounts').updateMany(
      { isDefault: true },
      { $set: { isDefault: false, updatedAt: new Date() } }
    );
  }

  // Set a specific account as default
  async setDefaultAccount(accountId: string): Promise<void> {
    const db = await this.connect();
    await db.collection('accounts').updateOne(
      { _id: new ObjectId(accountId) },
      { $set: { isDefault: true, updatedAt: new Date() } }
    );
  }

  // Delete a specific user account by ID
  async deleteUserAccount(accountId: string): Promise<void> {
    const db = await this.connect();
    await db.collection('accounts').deleteOne({ _id: new ObjectId(accountId) });
  }

  // Delete all user accounts for a user (legacy method)
  async deleteAllUserAccounts(userId: string): Promise<void> {
    const db = await this.connect();
    // Delete user accounts
    await db.collection('accounts').deleteMany({ userId });
    // Delete all tweets (scheduled, posted, drafts, templates)
    await db.collection('tweets').deleteMany({ userId });
    // Delete all notifications
    await db.collection('notifications').deleteMany({ userId });
  }

  // Find all tweets that are scheduled and due to be posted (for all accounts)
  async findDueTweets(): Promise<Tweet[]> {
    const db = await this.connect();
    const now = new Date();
    const tweets = await db.collection('tweets').find({
      status: TweetStatus.SCHEDULED,
      scheduledDate: { $lte: now }
    }).toArray();
    return tweets.map(tweet => ({
      id: tweet._id.toString(),
      userId: tweet.userId,
      content: tweet.content,
      scheduledDate: new Date(tweet.scheduledDate),
      community: tweet.community,
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterAccountId: tweet.twitterAccountId,
      media: tweet.media || []
    }));
  }

  // Update the status of a tweet
  async updateTweetStatus(tweetId: string, status: TweetStatus): Promise<void> {
    const db = await this.connect();
    await db.collection('tweets').updateOne(
      { _id: new ObjectId(tweetId) },
      { 
        $set: { 
          status,
          updatedAt: new Date()
        } 
      }
    );
  }

  async updateTweetTwitterId(tweetId: string, twitterTweetId: string): Promise<void> {
    const db = await this.connect();
    await db.collection('tweets').updateOne(
      { _id: new ObjectId(tweetId) },
      { $set: { twitterTweetId, updatedAt: new Date() } }
    );
  }

  async updateTweetAnalytics(tweetId: string, analytics: { likeCount?: number; retweetCount?: number; replyCount?: number; impressionCount?: number }): Promise<void> {
    const db = await this.connect();
    await db.collection('tweets').updateOne(
      { _id: new ObjectId(tweetId) },
      { $set: { ...analytics, updatedAt: new Date() } }
    );
  }

  async getPostedTweetsWithTwitterId(userId: string): Promise<Tweet[]> {
    const db = await this.connect();
    const tweets = await db.collection('tweets').find({
      userId,
      status: TweetStatus.POSTED,
      twitterTweetId: { $exists: true, $ne: null }
    }).toArray();
    return tweets.map(tweet => ({
      id: tweet._id.toString(),
      userId: tweet.userId,
      content: tweet.content,
      scheduledDate: new Date(tweet.scheduledDate),
      community: tweet.community,
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterTweetId: tweet.twitterTweetId
    }));
  }

  async getAllUserIds(): Promise<string[]> {
    const db = await this.connect();
    const users = await db.collection('tweets').distinct('userId');
    return users as string[];
  }

  async saveDraft(tweet: Tweet): Promise<string> {
    if (!tweet.twitterAccountId) {
      throw new Error('twitterAccountId is required for multi-account support');
    }
    const db = await this.connect();
    const result = await db.collection('tweets').insertOne({ ...tweet, status: TweetStatus.DRAFT });
    return result.insertedId.toString();
  }

  async getDrafts(userId: string, twitterAccountId?: string): Promise<Tweet[]> {
    const db = await this.connect();
    const query: any = { userId, status: TweetStatus.DRAFT };
    if (twitterAccountId) {
      query.twitterAccountId = twitterAccountId;
    }
    const drafts = await db.collection('tweets').find(query).toArray();
    return drafts.map(tweet => ({
      id: tweet._id.toString(),
      userId: tweet.userId,
      content: tweet.content,
      scheduledDate: tweet.scheduledDate ? new Date(tweet.scheduledDate) : null,
      community: tweet.community,
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      recurrenceType: tweet.recurrenceType,
      recurrenceInterval: tweet.recurrenceInterval,
      recurrenceEndDate: tweet.recurrenceEndDate ? new Date(tweet.recurrenceEndDate) : null,
      templateName: tweet.templateName,
      templateCategory: tweet.templateCategory,
      twitterAccountId: tweet.twitterAccountId,
      media: tweet.media || []
    }) as Tweet);
  }

  async updateDraft(tweetId: string, userId: string, updates: Partial<Tweet>, twitterAccountId?: string): Promise<void> {
    const db = await this.connect();
    const query: any = { _id: new ObjectId(tweetId), userId, status: TweetStatus.DRAFT };
    if (twitterAccountId) {
      query.twitterAccountId = twitterAccountId;
    }
    await db.collection('tweets').updateOne(
      query,
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async deleteDraft(tweetId: string, userId: string, twitterAccountId?: string): Promise<void> {
    const db = await this.connect();
    const query: any = { _id: new ObjectId(tweetId), userId, status: TweetStatus.DRAFT };
    if (twitterAccountId) {
      query.twitterAccountId = twitterAccountId;
    }
    await db.collection('tweets').deleteOne(query);
  }

  async getTemplates(userId: string, twitterAccountId?: string): Promise<Tweet[]> {
    const db = await this.connect();
    const query: any = { userId, templateName: { $exists: true, $ne: null } };
    if (twitterAccountId) {
      query.twitterAccountId = twitterAccountId;
    }
    const templates = await db.collection('tweets').find(query).toArray();
    return templates.map(tweet => ({
      id: tweet._id.toString(),
      userId: tweet.userId,
      content: tweet.content,
      scheduledDate: tweet.scheduledDate ? new Date(tweet.scheduledDate) : null,
      community: tweet.community,
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      recurrenceType: tweet.recurrenceType,
      recurrenceInterval: tweet.recurrenceInterval,
      recurrenceEndDate: tweet.recurrenceEndDate ? new Date(tweet.recurrenceEndDate) : null,
      templateName: tweet.templateName,
      templateCategory: tweet.templateCategory,
      twitterAccountId: tweet.twitterAccountId,
      media: tweet.media || []
    }) as Tweet);
  }

  // Create a notification
  async createNotification(notification: Notification): Promise<string> {
    const db = await this.connect();
    const result = await db.collection('notifications').insertOne({
      ...notification,
      createdAt: new Date(),
      status: 'unread'
    });
    return result.insertedId.toString();
  }

  // Get notifications for a user (optionally filter by status)
  async getNotifications(userId: string, status?: 'unread' | 'read'): Promise<Notification[]> {
    const db = await this.connect();
    const query: any = { userId };
    if (status) query.status = status;
    const notifications = await db.collection('notifications').find(query).sort({ createdAt: -1 }).toArray();
    return notifications.map(n => ({
      id: n._id.toString(),
      userId: n.userId,
      type: n.type,
      message: n.message,
      tweetId: n.tweetId,
      status: n.status,
      createdAt: n.createdAt,
      readAt: n.readAt,
      extra: n.extra
    }));
  }

  // Mark a notification as read
  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    const db = await this.connect();
    await db.collection('notifications').updateOne(
      { _id: new ObjectId(notificationId), userId },
      { $set: { status: 'read', readAt: new Date() } }
    );
  }

  // --- Twitter Apps Management ---
  async createTwitterApp(app: import('../types/types.js').TwitterApp): Promise<string> {
    const db = await this.connect();
    const result = await db.collection('twitter_apps').insertOne({
      ...app,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return result.insertedId.toString();
  }

  async updateTwitterApp(id: string, updates: Partial<import('../types/types.js').TwitterApp>): Promise<void> {
    const db = await this.connect();
    logger.debug({ id, updateFields: Object.keys(updates) }, 'Updating Twitter app');
    await db.collection('twitter_apps').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } }
    );
    logger.debug({ id }, 'Twitter app updated successfully');
  }

  async getTwitterApp(id: string): Promise<import('../types/types.js').TwitterApp | null> {
    const db = await this.connect();
    const app = await db.collection('twitter_apps').findOne({ _id: new ObjectId(id) });
    if (!app) return null;
    return {
      id: app._id.toString(),
      name: app.name,
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      consumerKey: app.consumerKey || '', // Don't fallback to clientId - keep separate
      consumerSecret: app.consumerSecret || '', // Don't fallback to clientSecret - keep separate
      accessToken: app.accessToken || '',
      accessTokenSecret: app.accessTokenSecret || '',
      callbackUrl: app.callbackUrl,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  }

  /**
   * List all Twitter apps in the database.
   * @returns {Promise<import('../types/types.js').TwitterApp[]>}
   */
  async listTwitterApps(): Promise<import('../types/types.js').TwitterApp[]> {
    const db = await this.connect();
    const apps = await db.collection('twitter_apps').find({}).toArray();
    return apps.map(app => ({
      id: app._id.toString(),
      name: app.name,
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      consumerKey: app.consumerKey || '', // Don't fallback - keep separate
      consumerSecret: app.consumerSecret || '', // Don't fallback - keep separate
      accessToken: app.accessToken || '',
      accessTokenSecret: app.accessTokenSecret || '',
      callbackUrl: app.callbackUrl,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    }));
  }

  /**
   * Delete a Twitter app from the database.
   * @param {string} id - The app ID to delete
   */
  async deleteTwitterApp(id: string): Promise<void> {
    const db = await this.connect();
    await db.collection('twitter_apps').deleteOne({ _id: new ObjectId(id) });
  }

  // --- Admin User Management ---
  async createAdminUser(user: import('../types/types.js').AdminUser): Promise<string> {
    const db = await this.connect();
    const result = await db.collection('users').insertOne({
      ...user,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return result.insertedId.toString();
  }

  async getAdminUserByUsername(username: string): Promise<import('../types/types.js').AdminUser | null> {
    const db = await this.connect();
    const user = await db.collection('users').findOne({ username });
    if (!user) return null;
    return {
      id: user._id.toString(),
      username: user.username,
      passwordHash: user.passwordHash,
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateAdminUserPassword(id: string, passwordHash: string): Promise<void> {
    const db = await this.connect();
    await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: { passwordHash, updatedAt: new Date() } }
    );
  }

  // Admin analytics and management methods
  async getAllTweets(): Promise<any[]> {
    const db = await this.connect();
    const tweets = await db.collection('tweets').find({}).toArray();
    return tweets.map(tweet => ({
      id: tweet._id.toString(),
      userId: tweet.userId,
      content: tweet.content,
      scheduledDate: tweet.scheduledDate ? new Date(tweet.scheduledDate) : null,
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterAccountId: tweet.twitterAccountId,
      twitterTweetId: tweet.twitterTweetId,
      error: tweet.error,
      media: tweet.media || []
    }));
  }

  async updateAdminUserProfile(id: string, updates: any): Promise<void> {
    const db = await this.connect();
    await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async deleteTweets(tweetIds: string[]): Promise<any> {
    const db = await this.connect();
    const objectIds = tweetIds.map(id => new ObjectId(id));
    return await db.collection('tweets').deleteMany({ _id: { $in: objectIds } });
  }

  async updateTweetsStatus(tweetIds: string[], status: string): Promise<any> {
    const db = await this.connect();
    const objectIds = tweetIds.map(id => new ObjectId(id));
    return await db.collection('tweets').updateMany(
      { _id: { $in: objectIds } },
      { $set: { status, updatedAt: new Date() } }
    );
  }

  async duplicateTweets(tweetIds: string[]): Promise<any> {
    const db = await this.connect();
    const objectIds = tweetIds.map(id => new ObjectId(id));
    const tweets = await db.collection('tweets').find({ _id: { $in: objectIds } }).toArray();
    
    const duplicates = tweets.map(tweet => ({
      ...tweet,
      _id: undefined,
      content: `${tweet.content} (Copy)`,
      scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Schedule for tomorrow
      status: 'SCHEDULED',
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    if (duplicates.length > 0) {
      return await db.collection('tweets').insertMany(duplicates);
    }
    return { insertedCount: 0 };
  }

  // Queue Management Methods
  async getTweetsByStatus(userId: string, status: TweetStatus | TweetStatus[]): Promise<any[]> {
    const db = await this.connect();
    const statusFilter = Array.isArray(status) ? { $in: status } : status;
    const tweets = await db.collection('tweets')
      .find({ userId, status: statusFilter })
      .sort({ queuePosition: 1, createdAt: 1 })
      .toArray();
    
    return tweets.map(tweet => ({
      ...tweet,
      id: tweet._id.toString(),
      _id: undefined
    }));
  }

  async updateTweet(tweetId: string, updates: Partial<any>): Promise<void> {
    const db = await this.connect();
    await db.collection('tweets').updateOne(
      { _id: new ObjectId(tweetId) },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async getQueueSettings(userId: string): Promise<any | null> {
    const db = await this.connect();
    const settings = await db.collection('queue_settings').findOne({ userId });
    if (!settings) return null;
    
    return {
      ...settings,
      id: settings._id.toString(),
      _id: undefined
    };
  }

  async saveQueueSettings(settings: any): Promise<string> {
    const db = await this.connect();
    const { id, ...settingsData } = settings;
    
    if (id) {
      await db.collection('queue_settings').updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...settingsData, updatedAt: new Date() } }
      );
      return id;
    } else {
      const result = await db.collection('queue_settings').insertOne({
        ...settingsData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return result.insertedId.toString();
    }
  }


  // Thread Management Methods
  async saveThread(thread: any): Promise<string> {
    const db = await this.connect();
    const { id, ...threadData } = thread;
    
    if (id) {
      await db.collection('threads').updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...threadData, updatedAt: new Date() } }
      );
      return id;
    } else {
      const result = await db.collection('threads').insertOne({
        ...threadData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return result.insertedId.toString();
    }
  }

  async getThread(threadId: string): Promise<any | null> {
    const db = await this.connect();
    const thread = await db.collection('threads').findOne({ _id: new ObjectId(threadId) });
    if (!thread) return null;
    
    return {
      ...thread,
      id: thread._id.toString(),
      _id: undefined
    };
  }

  async getThreads(userId: string, status?: any): Promise<any[]> {
    const db = await this.connect();
    const query: any = { userId };
    if (status) {
      query.status = Array.isArray(status) ? { $in: status } : status;
    }
    
    const threads = await db.collection('threads')
      .find(query)
      .sort({ scheduledDate: -1 })
      .toArray();
    
    return threads.map(thread => ({
      ...thread,
      id: thread._id.toString(),
      _id: undefined
    }));
  }

  async deleteThread(threadId: string): Promise<void> {
    const db = await this.connect();
    await db.collection('threads').deleteOne({ _id: new ObjectId(threadId) });
  }

  async updateThreadStatus(threadId: string, status: any, twitterThreadId?: string): Promise<void> {
    const db = await this.connect();
    const update: any = { status, updatedAt: new Date() };
    if (twitterThreadId) {
      update.twitterThreadId = twitterThreadId;
    }
    await db.collection('threads').updateOne(
      { _id: new ObjectId(threadId) },
      { $set: update }
    );
  }  
  
  // API Usage Tracking for X API compliance
  async getApiUsage(userId: string): Promise<{ posts: number; reads: number; month: string }> {
    const db = await this.connect();
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    const usage = await db.collection('api_usage').findOne({ userId, month: currentMonth });
    if (usage) {
      return {
        posts: usage.posts || 0,
        reads: usage.reads || 0,
        month: usage.month || currentMonth
      };
    }
    return { posts: 0, reads: 0, month: currentMonth };
  }

  async incrementApiUsage(userId: string, endpoint: string): Promise<void> {
    const db = await this.connect();
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const updateField = endpoint.includes('tweet') ? 'posts' : 'reads';
    
    await db.collection('api_usage').updateOne(
      { userId, month: currentMonth },
      { 
        $inc: { [updateField]: 1 },
        $setOnInsert: { 
          posts: updateField === 'posts' ? 1 : 0,
          reads: updateField === 'reads' ? 1 : 0,
          month: currentMonth,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  // Session management methods
  async saveSession(sessionId: string, sessionData: any, expiresAt: Date): Promise<void> {
    const db = await this.connect();
    await db.collection('sessions').updateOne(
      { sessionId },
      { 
        $set: {
          sessionId,
          data: sessionData,
          expiresAt,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  async getSession(sessionId: string): Promise<any | null> {
    const db = await this.connect();
    const session = await db.collection('sessions').findOne({ 
      sessionId,
      expiresAt: { $gt: new Date() } // Only return non-expired sessions
    });
    
    if (!session) return null;
    
    return {
      sessionId: session.sessionId,
      data: session.data,
      expiresAt: new Date(session.expiresAt),
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt)
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    const db = await this.connect();
    await db.collection('sessions').deleteOne({ sessionId });
  }

  async cleanupExpiredSessions(): Promise<void> {
    const db = await this.connect();
    await db.collection('sessions').deleteMany({
      expiresAt: { $lt: new Date() }
    });
  }

  async checkApiLimits(userId: string, plan: string = 'free'): Promise<{ allowed: boolean; reason?: string }> {
    const usage = await this.getApiUsage(userId);
    const limits = {
      free: { posts: 500, reads: 100 },
      basic: { posts: 3000, reads: 50000 },
      pro: { posts: 300000, reads: 1000000 }
    };
    
    const limit = limits[plan as keyof typeof limits] || limits.free;
    
    if (usage.posts >= limit.posts) {
      return { allowed: false, reason: `Monthly posting limit (${limit.posts}) exceeded` };
    }
    
    if (usage.reads >= limit.reads) {
      return { allowed: false, reason: `Monthly reading limit (${limit.reads}) exceeded` };
    }
    
    return { allowed: true };
  }

  // --- Email Notification Preferences ---
  async getEmailNotificationPreferences(userId: string): Promise<{
    enabled: boolean;
    email: string | null;
    onSuccess: boolean;
    onFailure: boolean;
  } | null> {
    const db = await this.connect();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { emailNotifications: 1 } }
    );
    
    if (!user || !user.emailNotifications) {
      return null;
    }
    
    return user.emailNotifications;
  }

  async updateEmailNotificationPreferences(
    userId: string,
    preferences: {
      enabled?: boolean;
      email?: string;
      onSuccess?: boolean;
      onFailure?: boolean;
    }
  ): Promise<void> {
    const db = await this.connect();
    const updateFields: any = {};
    
    if (preferences.enabled !== undefined) {
      updateFields['emailNotifications.enabled'] = preferences.enabled;
    }
    if (preferences.email !== undefined) {
      updateFields['emailNotifications.email'] = preferences.email;
    }
    if (preferences.onSuccess !== undefined) {
      updateFields['emailNotifications.onSuccess'] = preferences.onSuccess;
    }
    if (preferences.onFailure !== undefined) {
      updateFields['emailNotifications.onFailure'] = preferences.onFailure;
    }
    
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          ...updateFields,
          updatedAt: new Date() 
        } 
      }
    );
  }
}