import { SqliteDatabase } from './sqlite-wrapper';
import { TweetStatus, Tweet, UserAccount, Notification } from '../types/types';
import { EncryptionService } from './encryption';
import pino from 'pino';

// Create logger for database operations
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime
});

export class DatabaseClient {
  private static instance: DatabaseClient;
  private db: SqliteDatabase;
  private encryptionService: EncryptionService;

  private constructor(dbPath: string, encryptionKey: string, authSecret: string) {
    if (!authSecret) {
      throw new Error("Auth Secret is required for DatabaseClient initialization");
    }
    
    this.db = new SqliteDatabase({
      path: dbPath,
      encryptionKey: encryptionKey,
      verbose: process.env.LOG_LEVEL === 'debug'
    });
    
    this.encryptionService = new EncryptionService(authSecret);
    
    // Connect and ensure database is initialized
    this.db.connect();
    
    // Run migrations automatically on first connection
    this.runMigrationsSync();
    
    logger.info({ path: dbPath }, 'Connected to SQLite database');
  }

  private runMigrationsSync(): void {
    try {
      // Import and run migrations synchronously
      const { readFileSync } = require('fs');
      const { join, dirname } = require('path');
      const { fileURLToPath } = require('url');
      
      // Try to load schema from multiple possible locations
      let schemaPath: string;
      try {
        // In production (compiled)
        schemaPath = join(__dirname, 'migrations', '001_initial_schema.sql');
        readFileSync(schemaPath, 'utf8');
      } catch {
        try {
          // In development (ts-node)
          schemaPath = join(__dirname, '..', 'src', 'backend', 'migrations', '001_initial_schema.sql');
          readFileSync(schemaPath, 'utf8');
        } catch {
          // Fallback - schema might already exist
          logger.warn('Could not find migration files, assuming schema exists');
          return;
        }
      }
      
      const schema = readFileSync(schemaPath, 'utf8');
      const statements = schema
        .split(';')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      this.db.transaction(() => {
        for (const statement of statements) {
          this.db.execute(statement + ';');
        }
      });
      
      logger.info('Database migrations completed');
    } catch (error) {
      logger.error({ error }, 'Migration failed - database may already be initialized');
      // Don't throw - database might already exist
    }
  }

  public static getInstance(dbPath?: string, encryptionKey?: string, authSecret?: string): DatabaseClient {
    if (!DatabaseClient.instance) {
      if (!dbPath) {
        throw new Error("Database path is required for the first instantiation of DatabaseClient");
      }
      if (!authSecret) {
        throw new Error("Auth Secret is required for the first instantiation of DatabaseClient");
      }
      DatabaseClient.instance = new DatabaseClient(dbPath, encryptionKey || '', authSecret);
    }
    return DatabaseClient.instance;
  }

  async connect() {
    // SQLite is already connected in constructor
    return this.db;
  }

  async close() {
    this.db.close();
    logger.info({}, 'Disconnected from SQLite database');
  }

  // ============================================
  // USER & ADMIN METHODS
  // ============================================

  async createAdminUser(user: import('../types/types').AdminUser): Promise<string> {
    const id = this.db.generateId();
    const now = this.db.now();
    
    this.db.execute(
      `INSERT INTO users (id, email, password, displayName, role, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        user.email || user.username,
        user.passwordHash,
        user.displayName || user.username,
        'admin',
        now,
        now
      ]
    );
    
    return id;
  }

  async getAdminUserByUsername(username: string): Promise<import('../types/types').AdminUser | null> {
    const user = this.db.queryOne<any>(
      'SELECT * FROM users WHERE email = ? OR displayName = ?',
      [username, username]
    );
    
    if (!user) return null;
    
    return {
      id: user.id,
      username: user.displayName || user.email,
      passwordHash: user.password,
      displayName: user.displayName,
      email: user.email,
      avatar: '',
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt)
    };
  }

  async updateAdminUserPassword(id: string, passwordHash: string): Promise<void> {
    const now = this.db.now();
    this.db.execute(
      'UPDATE users SET password = ?, updatedAt = ? WHERE id = ?',
      [passwordHash, now, id]
    );
  }

  async updateAdminUserProfile(id: string, updates: any): Promise<void> {
    const now = this.db.now();
    const updateFields: string[] = [];
    const params: any[] = [];
    
    if (updates.displayName !== undefined) {
      updateFields.push('displayName = ?');
      params.push(updates.displayName);
    }
    if (updates.email !== undefined) {
      updateFields.push('email = ?');
      params.push(updates.email);
    }
    
    updateFields.push('updatedAt = ?');
    params.push(now, id);
    
    this.db.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );
  }

  async getEmailNotificationPreferences(userId: string): Promise<{
    enabled: boolean;
    email: string | null;
    onSuccess: boolean;
    onFailure: boolean;
  } | null> {
    // For now, return null - email preferences need schema update
    return null;
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
    // For now, no-op - email preferences need schema update
  }

  // ============================================
  // ACCOUNT METHODS (OAuth Connections)
  // ============================================

  async saveUserAccount(userAccount: UserAccount): Promise<string> {
    // Encrypt sensitive data
    const encryptedAccessToken = this.encryptionService.encrypt(userAccount.access_token);
    const encryptedRefreshToken = this.encryptionService.encrypt(userAccount.refresh_token);
    const now = this.db.now();
    
    // Check if user account already exists by providerAccountId
    const existingAccount = this.db.queryOne<{ id: string }>(
      'SELECT id FROM accounts WHERE providerAccountId = ?',
      [userAccount.providerAccountId]
    );
    
    if (existingAccount) {
      // Update existing account
      this.db.execute(
        `UPDATE accounts SET
          userId = ?, provider = ?, username = ?, displayName = ?,
          profileImage = ?, accessToken = ?, refreshToken = ?, expiresAt = ?, updatedAt = ?
         WHERE id = ?`,
        [
          userAccount.userId,
          userAccount.provider,
          userAccount.username,
          userAccount.displayName,
          userAccount.profileImage,
          encryptedAccessToken,
          encryptedRefreshToken,
          userAccount.expires_at || null,
          now,
          existingAccount.id
        ]
      );
      
      return existingAccount.id;
    } else {
      // Insert new account
      const id = this.db.generateId();
      
      this.db.execute(
        `INSERT INTO accounts (id, userId, provider, providerAccountId, username, displayName, profileImage, accessToken, refreshToken, expiresAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userAccount.userId,
          userAccount.provider,
          userAccount.providerAccountId,
          userAccount.username,
          userAccount.displayName,
          userAccount.profileImage,
          encryptedAccessToken,
          encryptedRefreshToken,
          userAccount.expires_at || null,
          now,
          now
        ]
      );
      
      return id;
    }
  }

  async getUserAccount(userId: string, provider: string): Promise<UserAccount | null> {
    const account = this.db.queryOne<any>(
      'SELECT * FROM accounts WHERE userId = ? AND provider = ?',
      [userId, provider]
    );
    
    if (!account) return null;
    
    return {
      id: account.id,
      userId: account.userId,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      username: account.username,
      displayName: account.displayName,
      profileImage: account.profileImage,
      access_token: this.encryptionService.decrypt(account.accessToken),
      refresh_token: this.encryptionService.decrypt(account.refreshToken),
      expires_at: account.expiresAt
    } as UserAccount;
  }

  async getUserAccountByProviderId(providerAccountId: string): Promise<UserAccount | null> {
    const account = this.db.queryOne<any>(
      'SELECT * FROM accounts WHERE providerAccountId = ?',
      [providerAccountId]
    );
    
    if (!account) return null;
    
    return {
      id: account.id,
      userId: account.userId,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      username: account.username,
      displayName: account.displayName,
      profileImage: account.profileImage,
      access_token: this.encryptionService.decrypt(account.accessToken),
      refresh_token: this.encryptionService.decrypt(account.refreshToken),
      expires_at: account.expiresAt
    } as UserAccount;
  }

  async verifyAccountExists(providerAccountId: string, maxRetries: number = 3): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      const account = this.db.queryOne(
        'SELECT id FROM accounts WHERE providerAccountId = ?',
        [providerAccountId]
      );
      
      if (account) {
        return true;
      }
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 500));
      }
    }
    
    return false;
  }

  async getUserAccountById(accountId: string): Promise<UserAccount | null> {
    const account = this.db.queryOne<any>(
      'SELECT * FROM accounts WHERE id = ?',
      [accountId]
    );
    
    if (!account) return null;
    
    return {
      id: account.id,
      userId: account.userId,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      username: account.username,
      displayName: account.displayName,
      profileImage: account.profileImage,
      access_token: this.encryptionService.decrypt(account.accessToken),
      refresh_token: this.encryptionService.decrypt(account.refreshToken),
      expires_at: account.expiresAt
    } as UserAccount;
  }

  async getUserAccounts(userId: string): Promise<UserAccount[]> {
    const accounts = this.db.query<any>(
      'SELECT * FROM accounts WHERE userId = ?',
      [userId]
    );
    
    return accounts.map((account: any) => ({
      id: account.id,
      userId: account.userId,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      username: account.username,
      displayName: account.displayName,
      profileImage: account.profileImage,
      access_token: this.encryptionService.decrypt(account.accessToken),
      refresh_token: this.encryptionService.decrypt(account.refreshToken),
      expires_at: account.expiresAt
    } as UserAccount));
  }

  async getAllUserAccounts(): Promise<UserAccount[]> {
    const accounts = this.db.query<any>('SELECT * FROM accounts');
    
    return accounts.map((account: any) => ({
      id: account.id,
      userId: account.userId,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      username: account.username,
      displayName: account.displayName,
      profileImage: account.profileImage,
      access_token: this.encryptionService.decrypt(account.accessToken),
      refresh_token: this.encryptionService.decrypt(account.refreshToken),
      expires_at: account.expiresAt
    } as UserAccount));
  }

  async clearDefaultAccounts(): Promise<void> {
    const now = this.db.now();
    this.db.execute(
      'UPDATE accounts SET updatedAt = ? WHERE 1=1',
      [now]
    );
  }

  async setDefaultAccount(accountId: string): Promise<void> {
    const now = this.db.now();
    this.db.execute(
      'UPDATE accounts SET updatedAt = ? WHERE id = ?',
      [now, accountId]
    );
  }

  async deleteUserAccount(accountId: string): Promise<void> {
    this.db.execute('DELETE FROM accounts WHERE id = ?', [accountId]);
  }

  async deleteAllUserAccounts(userId: string): Promise<void> {
    this.db.transaction(() => {
      this.db.execute('DELETE FROM accounts WHERE userId = ?', [userId]);
      this.db.execute('DELETE FROM tweets WHERE userId = ?', [userId]);
      this.db.execute('DELETE FROM notifications WHERE userId = ?', [userId]);
    });
  }

  // ============================================
  // TWEET METHODS (Core Operations)
  // ============================================

  async saveTweet(tweet: Tweet) {
    if (!tweet.twitterAccountId) {
      throw new Error('twitterAccountId is required for multi-account support');
    }
    
    const id = this.db.generateId();
    const now = this.db.now();
    
    this.db.execute(
      `INSERT INTO tweets (id, userId, twitterAccountId, content, scheduledDate, status, media, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tweet.userId,
        tweet.twitterAccountId,
        tweet.content,
        tweet.scheduledDate ? tweet.scheduledDate.getTime() : null,
        tweet.status || TweetStatus.SCHEDULED,
        this.db.stringifyJson(tweet.media || []),
        now
      ]
    );
    
    return id;
  }

  async getTweets(
    userId: string,
    page: number,
    limit: number,
    status: TweetStatus | TweetStatus[] = TweetStatus.SCHEDULED,
    sortDirection: 1 | -1 = 1,
    twitterAccountId?: string
  ) {
    const skip = (page - 1) * limit;
    const sortOrder = sortDirection === 1 ? 'ASC' : 'DESC';
    
    let sql = `
      SELECT * FROM tweets
      WHERE userId = ?
      AND status ${Array.isArray(status) ? `IN (${status.map(() => '?').join(',')})` : '= ?'}
    `;
    
    const params: any[] = [userId];
    
    if (Array.isArray(status)) {
      params.push(...status);
    } else {
      params.push(status);
    }
    
    if (twitterAccountId) {
      sql += ' AND twitterAccountId = ?';
      params.push(twitterAccountId);
    }
    
    sql += ` ORDER BY scheduledDate ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(limit, skip);
    
    const tweets = this.db.query(sql, params);
    
    return tweets.map((tweet: any) => ({
      id: tweet.id,
      userId: tweet.userId,
      content: tweet.content,
      scheduledDate: tweet.scheduledDate ? new Date(tweet.scheduledDate) : null,
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterAccountId: tweet.twitterAccountId,
      twitterTweetId: tweet.twitterTweetId,
      error: tweet.error,
      media: this.db.parseJson(tweet.media) || []
    }));
  }

  async getScheduledTweets(userId: string, page: number, limit: number, twitterAccountId?: string) {
    return this.getTweets(userId, page, limit, TweetStatus.SCHEDULED, 1, twitterAccountId);
  }

  async getHistoryTweets(userId: string, page: number, limit: number, twitterAccountId?: string) {
    return this.getTweets(userId, page, limit, [TweetStatus.POSTED, TweetStatus.FAILED], -1, twitterAccountId);
  }

  async countTweets(userId: string, status: TweetStatus | TweetStatus[] = TweetStatus.SCHEDULED, twitterAccountId?: string) {
    let sql = `
      SELECT COUNT(*) as count FROM tweets
      WHERE userId = ?
      AND status ${Array.isArray(status) ? `IN (${status.map(() => '?').join(',')})` : '= ?'}
    `;
    
    const params: any[] = [userId];
    
    if (Array.isArray(status)) {
      params.push(...status);
    } else {
      params.push(status);
    }
    
    if (twitterAccountId) {
      sql += ' AND twitterAccountId = ?';
      params.push(twitterAccountId);
    }
    
    const result = this.db.queryOne<{ count: number }>(sql, params);
    return result?.count || 0;
  }

  async countScheduledTweets(userId: string, twitterAccountId?: string) {
    return this.countTweets(userId, TweetStatus.SCHEDULED, twitterAccountId);
  }

  async countHistoryTweets(userId: string, twitterAccountId?: string) {
    return this.countTweets(userId, [TweetStatus.POSTED, TweetStatus.FAILED], twitterAccountId);
  }

  async deleteTweet(tweetId: string, userId: string, twitterAccountId?: string) {
    try {
      let sql = 'DELETE FROM tweets WHERE id = ? AND userId = ?';
      const params: any[] = [tweetId, userId];
      
      if (twitterAccountId) {
        sql += ' AND twitterAccountId = ?';
        params.push(twitterAccountId);
      }
      
      const result = this.db.execute(sql, params);
      
      return {
        success: result.changes > 0,
        deletedCount: result.changes
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error', tweetId }, 'Error deleting tweet');
      throw error;
    }
  }

  async findDueTweets(): Promise<Tweet[]> {
    const now = this.db.now();
    const tweets = this.db.query<any>(
      'SELECT * FROM tweets WHERE status = ? AND scheduledDate <= ?',
      [TweetStatus.SCHEDULED, now]
    );
    
    return tweets.map((tweet: any) => ({
      id: tweet.id,
      userId: tweet.userId,
      content: tweet.content,
      scheduledDate: new Date(tweet.scheduledDate),
      community: '',
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterAccountId: tweet.twitterAccountId,
      media: this.db.parseJson(tweet.media) || []
    }));
  }

  async updateTweetStatus(tweetId: string, status: TweetStatus): Promise<void> {
    const now = this.db.now();
    this.db.execute(
      'UPDATE tweets SET status = ?, updatedAt = ? WHERE id = ?',
      [status, now, tweetId]
    );
  }

  async updateTweetTwitterId(tweetId: string, twitterTweetId: string): Promise<void> {
    const now = this.db.now();
    this.db.execute(
      'UPDATE tweets SET twitterTweetId = ?, updatedAt = ? WHERE id = ?',
      [twitterTweetId, now, tweetId]
    );
  }

  async updateTweet(tweetId: string, updates: Partial<any>): Promise<void> {
    const now = this.db.now();
    const updateFields: string[] = [];
    const params: any[] = [];
    
    if (updates.content !== undefined) {
      updateFields.push('content = ?');
      params.push(updates.content);
    }
    if (updates.scheduledDate !== undefined) {
      updateFields.push('scheduledDate = ?');
      params.push(updates.scheduledDate ? updates.scheduledDate.getTime() : null);
    }
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.error !== undefined) {
      updateFields.push('error = ?');
      params.push(updates.error);
    }
    if (updates.media !== undefined) {
      updateFields.push('media = ?');
      params.push(this.db.stringifyJson(updates.media));
    }
    
    updateFields.push('updatedAt = ?');
    params.push(now, tweetId);
    
    this.db.execute(
      `UPDATE tweets SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );
  }

  async getAllTweets(): Promise<any[]> {
    const tweets = this.db.query<any>('SELECT * FROM tweets');
    
    return tweets.map((tweet: any) => ({
      id: tweet.id,
      userId: tweet.userId,
      content: tweet.content,
      scheduledDate: tweet.scheduledDate ? new Date(tweet.scheduledDate) : null,
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterAccountId: tweet.twitterAccountId,
      twitterTweetId: tweet.twitterTweetId,
      error: tweet.error,
      media: this.db.parseJson(tweet.media) || []
    }));
  }

  async deleteTweets(tweetIds: string[]): Promise<any> {
    const placeholders = tweetIds.map(() => '?').join(',');
    const result = this.db.execute(
      `DELETE FROM tweets WHERE id IN (${placeholders})`,
      tweetIds
    );
    return { deletedCount: result.changes };
  }

  async updateTweetsStatus(tweetIds: string[], status: string): Promise<any> {
    const now = this.db.now();
    const placeholders = tweetIds.map(() => '?').join(',');
    const result = this.db.execute(
      `UPDATE tweets SET status = ?, updatedAt = ? WHERE id IN (${placeholders})`,
      [status, now, ...tweetIds]
    );
    return { modifiedCount: result.changes };
  }

  async duplicateTweets(tweetIds: string[]): Promise<any> {
    const placeholders = tweetIds.map(() => '?').join(',');
    const tweets = this.db.query<any>(
      `SELECT * FROM tweets WHERE id IN (${placeholders})`,
      tweetIds
    );
    
    let insertedCount = 0;
    
    this.db.transaction(() => {
      for (const tweet of tweets) {
        const newId = this.db.generateId();
        const now = this.db.now();
        const tomorrow = now + (24 * 60 * 60 * 1000);
        
        this.db.execute(
          `INSERT INTO tweets (id, userId, twitterAccountId, content, scheduledDate, status, media, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId,
            tweet.userId,
            tweet.twitterAccountId,
            `${tweet.content} (Copy)`,
            tomorrow,
            'SCHEDULED',
            tweet.media,
            now,
            now
          ]
        );
        insertedCount++;
      }
    });
    
    return { insertedCount };
  }

  async getAllUserIds(): Promise<string[]> {
    const results = this.db.query<{ userId: string }>('SELECT DISTINCT userId FROM tweets');
    return results.map((r: any) => r.userId);
  }

  async getPostedTweetsWithTwitterId(userId: string): Promise<Tweet[]> {
    const tweets = this.db.query<any>(
      'SELECT * FROM tweets WHERE userId = ? AND status = ? AND twitterTweetId IS NOT NULL',
      [userId, TweetStatus.POSTED]
    );
    
    return tweets.map((tweet: any) => ({
      id: tweet.id,
      userId: tweet.userId,
      content: tweet.content,
      scheduledDate: new Date(tweet.scheduledDate),
      community: '',
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterTweetId: tweet.twitterTweetId
    }));
  }

  async getTweetsByStatus(userId: string, status: TweetStatus | TweetStatus[]): Promise<any[]> {
    let sql = 'SELECT * FROM tweets WHERE userId = ?';
    const params: any[] = [userId];
    
    if (Array.isArray(status)) {
      sql += ` AND status IN (${status.map(() => '?').join(',')})`;
      params.push(...status);
    } else {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY createdAt ASC';
    
    const tweets = this.db.query<any>(sql, params);
    
    return tweets.map((tweet: any) => ({
      ...tweet,
      scheduledDate: tweet.scheduledDate ? new Date(tweet.scheduledDate) : null,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      media: this.db.parseJson(tweet.media) || []
    }));
  }

  // ============================================
  // DRAFT & TEMPLATE METHODS
  // ============================================

  async saveDraft(tweet: Tweet): Promise<string> {
    if (!tweet.twitterAccountId) {
      throw new Error('twitterAccountId is required for multi-account support');
    }
    
    const id = this.db.generateId();
    const now = this.db.now();
    
    this.db.execute(
      `INSERT INTO tweets (id, userId, twitterAccountId, content, scheduledDate, status, media, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tweet.userId,
        tweet.twitterAccountId,
        tweet.content,
        tweet.scheduledDate ? tweet.scheduledDate.getTime() : null,
        TweetStatus.DRAFT,
        this.db.stringifyJson(tweet.media || []),
        now
      ]
    );
    
    return id;
  }

  async getDrafts(userId: string, twitterAccountId?: string): Promise<Tweet[]> {
    let sql = 'SELECT * FROM tweets WHERE userId = ? AND status = ?';
    const params: any[] = [userId, TweetStatus.DRAFT];
    
    if (twitterAccountId) {
      sql += ' AND twitterAccountId = ?';
      params.push(twitterAccountId);
    }
    
    const drafts = this.db.query<any>(sql, params);
    
    return drafts.map((tweet: any) => ({
      id: tweet.id,
      userId: tweet.userId,
      content: tweet.content,
      scheduledDate: tweet.scheduledDate ? new Date(tweet.scheduledDate) : null,
      community: '',
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterAccountId: tweet.twitterAccountId,
      media: this.db.parseJson(tweet.media) || []
    }) as Tweet);
  }

  async updateDraft(tweetId: string, userId: string, updates: Partial<Tweet>, twitterAccountId?: string): Promise<void> {
    const now = this.db.now();
    const updateFields: string[] = [];
    const params: any[] = [];
    
    if (updates.content !== undefined) {
      updateFields.push('content = ?');
      params.push(updates.content);
    }
    if (updates.scheduledDate !== undefined) {
      updateFields.push('scheduledDate = ?');
      params.push(updates.scheduledDate ? updates.scheduledDate.getTime() : null);
    }
    if (updates.media !== undefined) {
      updateFields.push('media = ?');
      params.push(this.db.stringifyJson(updates.media));
    }
    
    updateFields.push('updatedAt = ?');
    params.push(now);
    
    let sql = `UPDATE tweets SET ${updateFields.join(', ')} WHERE id = ? AND userId = ? AND status = ?`;
    params.push(tweetId, userId, TweetStatus.DRAFT);
    
    if (twitterAccountId) {
      sql += ' AND twitterAccountId = ?';
      params.push(twitterAccountId);
    }
    
    this.db.execute(sql, params);
  }

  async deleteDraft(tweetId: string, userId: string, twitterAccountId?: string): Promise<void> {
    let sql = 'DELETE FROM tweets WHERE id = ? AND userId = ? AND status = ?';
    const params: any[] = [tweetId, userId, TweetStatus.DRAFT];
    
    if (twitterAccountId) {
      sql += ' AND twitterAccountId = ?';
      params.push(twitterAccountId);
    }
    
    this.db.execute(sql, params);
  }

  async getTemplates(userId: string, twitterAccountId?: string): Promise<Tweet[]> {
    // Templates need schema update - return empty for now
    return [];
  }

  // ============================================
  // NOTIFICATION METHODS
  // ============================================

  async createNotification(notification: Notification): Promise<string> {
    const id = this.db.generateId();
    const now = this.db.now();
    
    this.db.execute(
      `INSERT INTO notifications (id, userId, type, title, message, read, metadata, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        notification.userId,
        notification.type,
        '',
        notification.message,
        notification.status === 'read' ? 1 : 0,
        this.db.stringifyJson(notification.extra || {}),
        now
      ]
    );
    
    return id;
  }

  async getNotifications(userId: string, status?: 'unread' | 'read'): Promise<Notification[]> {
    let sql = 'SELECT * FROM notifications WHERE userId = ?';
    const params: any[] = [userId];
    
    if (status) {
      sql += ' AND read = ?';
      params.push(status === 'read' ? 1 : 0);
    }
    
    sql += ' ORDER BY createdAt DESC';
    
    const notifications = this.db.query<any>(sql, params);
    
    return notifications.map((n: any) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      message: n.message,
      status: this.db.toBool(n.read) ? 'read' as const : 'unread' as const,
      createdAt: new Date(n.createdAt),
      extra: this.db.parseJson(n.metadata) || undefined
    }));
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    this.db.execute(
      'UPDATE notifications SET read = 1 WHERE id = ? AND userId = ?',
      [notificationId, userId]
    );
  }

  // ============================================
  // TWITTER APPS MANAGEMENT
  // ============================================

  async createTwitterApp(app: import('../types/types').TwitterApp): Promise<string> {
    const id = this.db.generateId();
    const now = this.db.now();
    
    this.db.execute(
      `INSERT INTO twitter_apps (id, userId, name, apiKey, apiSecret, bearerToken, clientId, clientSecret, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        '',  // userId not in TwitterApp type
        app.name,
        app.consumerKey || app.clientId || '',
        app.consumerSecret || app.clientSecret || '',
        app.accessToken || '',
        app.clientId || '',
        app.clientSecret || '',
        1,
        now,
        now
      ]
    );
    
    return id;
  }

  async updateTwitterApp(id: string, updates: Partial<import('../types/types').TwitterApp>): Promise<void> {
    const now = this.db.now();
    const updateFields: string[] = [];
    const params: any[] = [];
    
    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.consumerKey !== undefined) {
      updateFields.push('apiKey = ?');
      params.push(updates.consumerKey);
    }
    if (updates.consumerSecret !== undefined) {
      updateFields.push('apiSecret = ?');
      params.push(updates.consumerSecret);
    }
    if (updates.accessToken !== undefined) {
      updateFields.push('bearerToken = ?');
      params.push(updates.accessToken);
    }
    if (updates.clientId !== undefined) {
      updateFields.push('clientId = ?');
      params.push(updates.clientId);
    }
    if (updates.clientSecret !== undefined) {
      updateFields.push('clientSecret = ?');
      params.push(updates.clientSecret);
    }
    
    updateFields.push('updatedAt = ?');
    params.push(now, id);
    
    logger.debug({ id, updateFields: Object.keys(updates) }, 'Updating Twitter app');
    
    this.db.execute(
      `UPDATE twitter_apps SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );
    
    logger.debug({ id }, 'Twitter app updated successfully');
  }

  async getTwitterApp(id: string): Promise<import('../types/types').TwitterApp | null> {
    const app = this.db.queryOne<any>('SELECT * FROM twitter_apps WHERE id = ?', [id]);
    
    if (!app) return null;
    
    return {
      id: app.id,
      name: app.name,
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      consumerKey: app.apiKey,
      consumerSecret: app.apiSecret,
      accessToken: app.bearerToken,
      accessTokenSecret: '',
      callbackUrl: '',
      createdAt: new Date(app.createdAt),
      updatedAt: new Date(app.updatedAt)
    };
  }

  async listTwitterApps(): Promise<import('../types/types').TwitterApp[]> {
    const apps = this.db.query<any>('SELECT * FROM twitter_apps');
    
    return apps.map((app: any) => ({
      id: app.id,
      name: app.name,
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      consumerKey: app.apiKey,
      consumerSecret: app.apiSecret,
      accessToken: app.bearerToken,
      accessTokenSecret: '',
      callbackUrl: '',
      createdAt: new Date(app.createdAt),
      updatedAt: new Date(app.updatedAt)
    }));
  }

  async deleteTwitterApp(id: string): Promise<void> {
    this.db.execute('DELETE FROM twitter_apps WHERE id = ?', [id]);
  }

  // ============================================
  // STUB METHODS (Not implemented yet)
  // ============================================

  async updateTweetAnalytics(tweetId: string, analytics: any): Promise<void> {
    // Analytics columns need to be added to schema
  }

  async getQueueSettings(userId: string): Promise<any | null> {
    // Queue settings need separate table
    return null;
  }

  async saveQueueSettings(settings: any): Promise<string> {
    // Queue settings need separate table
    return '';
  }

  async saveThread(thread: any): Promise<string> {
    // Threads need separate table
    return '';
  }

  async getThread(threadId: string): Promise<any | null> {
    // Threads need separate table
    return null;
  }

  async getThreads(userId: string, status?: any): Promise<any[]> {
    // Threads need separate table
    return [];
  }

  async deleteThread(threadId: string): Promise<void> {
    // Threads need separate table
  }

  async updateThreadStatus(threadId: string, status: any, twitterThreadId?: string): Promise<void> {
    // Threads need separate table
  }

  async getApiUsage(userId: string): Promise<{ posts: number; reads: number; month: string }> {
    // API usage needs separate table
    const currentMonth = new Date().toISOString().slice(0, 7);
    return { posts: 0, reads: 0, month: currentMonth };
  }

  async incrementApiUsage(userId: string, endpoint: string): Promise<void> {
    // API usage needs separate table
  }

  async checkApiLimits(userId: string, plan: string = 'free'): Promise<{ allowed: boolean; reason?: string }> {
    // API usage needs separate table
    return { allowed: true };
  }

  async saveSession(sessionId: string, sessionData: any, expiresAt: Date): Promise<void> {
    // Sessions need separate table
  }

  async getSession(sessionId: string): Promise<any | null> {
    // Sessions need separate table
    return null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Sessions need separate table
  }

  async cleanupExpiredSessions(): Promise<void> {
    // Sessions need separate table
  }
}
