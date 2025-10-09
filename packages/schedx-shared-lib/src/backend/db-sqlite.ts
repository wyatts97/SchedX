import { SqliteDatabase } from './sqlite-wrapper';
import { TweetStatus, Tweet, UserAccount, Notification } from '../types/types';
import { EncryptionService } from './encryption';
import pino from 'pino';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

// Create require function for ES modules
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = require('path').dirname(__filename);

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
      const { join } = require('path');
      
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

      logger.info({ statementCount: statements.length }, 'Running database migrations');

      this.db.transaction(() => {
        for (const statement of statements) {
          try {
            this.db.execute(statement);
          } catch (err) {
            logger.error({ error: err, statement: statement.substring(0, 100) }, 'Failed to execute migration statement');
            throw err;
          }
        }
      });
      
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error({ error, message: error instanceof Error ? error.message : 'Unknown error' }, 'Migration failed - database may already be initialized');
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
    const user = this.db.queryOne<{ email: string; emailOnSuccess: number; emailOnFailure: number }>(
      'SELECT email, emailOnSuccess, emailOnFailure FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      return null;
    }
    
    return {
      enabled: true,
      email: user.email,
      onSuccess: user.emailOnSuccess === 1,
      onFailure: user.emailOnFailure === 1
    };
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
    const updates: string[] = [];
    const params: any[] = [];
    
    if (preferences.email !== undefined) {
      updates.push('email = ?');
      params.push(preferences.email);
    }
    
    if (preferences.onSuccess !== undefined) {
      updates.push('emailOnSuccess = ?');
      params.push(preferences.onSuccess ? 1 : 0);
    }
    
    if (preferences.onFailure !== undefined) {
      updates.push('emailOnFailure = ?');
      params.push(preferences.onFailure ? 1 : 0);
    }
    
    if (updates.length > 0) {
      updates.push('updatedAt = ?');
      params.push(Date.now());
      params.push(userId);
      
      this.db.execute(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }
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
    // Templates are just tweets with status 'template'
    const query = twitterAccountId
      ? 'SELECT * FROM tweets WHERE userId = ? AND twitterAccountId = ? AND status = ? ORDER BY createdAt DESC'
      : 'SELECT * FROM tweets WHERE userId = ? AND status = ? ORDER BY createdAt DESC';
    
    const params = twitterAccountId
      ? [userId, twitterAccountId, 'template']
      : [userId, 'template'];
    
    const templates = this.db.query<any>(query, params);
    
    return templates.map((t: any) => ({
      id: t.id,
      userId: t.userId,
      twitterAccountId: t.twitterAccountId,
      content: t.content,
      scheduledDate: t.scheduledDate ? new Date(t.scheduledDate) : new Date(),
      community: '',
      status: t.status as TweetStatus,
      twitterTweetId: t.twitterTweetId,
      error: t.error,
      media: t.media ? JSON.parse(t.media) : undefined,
      createdAt: new Date(t.createdAt),
      updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined
    }));
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
      `INSERT INTO twitter_apps (id, userId, name, apiKey, apiSecret, bearerToken, bearerTokenSecret, clientId, clientSecret, callbackUrl, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        '',  // userId not in TwitterApp type
        app.name,
        app.consumerKey || app.clientId || '',
        app.consumerSecret || app.clientSecret || '',
        app.accessToken || '',
        app.accessTokenSecret || '',
        app.clientId || '',
        app.clientSecret || '',
        app.callbackUrl || '',
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
      accessTokenSecret: app.bearerTokenSecret || '',
      callbackUrl: app.callbackUrl || '',
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
      accessTokenSecret: app.bearerTokenSecret || '',
      callbackUrl: app.callbackUrl || '',
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
    const settings = this.db.queryOne<any>(
      'SELECT * FROM queue_settings WHERE userId = ?',
      [userId]
    );
    
    if (!settings) {
      return null;
    }
    
    return {
      id: settings.id,
      userId: settings.userId,
      timeSlots: JSON.parse(settings.timeSlots),
      timezone: settings.timezone,
      enabled: settings.enabled === 1,
      createdAt: new Date(settings.createdAt),
      updatedAt: settings.updatedAt ? new Date(settings.updatedAt) : null
    };
  }

  async saveQueueSettings(settings: any): Promise<string> {
    const now = Date.now();
    
    // Check if settings already exist
    const existing = this.db.queryOne<{ id: string }>(
      'SELECT id FROM queue_settings WHERE userId = ?',
      [settings.userId]
    );
    
    if (existing) {
      // Update existing settings
      this.db.execute(
        `UPDATE queue_settings SET timeSlots = ?, timezone = ?, enabled = ?, updatedAt = ?
         WHERE userId = ?`,
        [
          JSON.stringify(settings.timeSlots),
          settings.timezone || 'UTC',
          settings.enabled ? 1 : 0,
          now,
          settings.userId
        ]
      );
      return existing.id;
    } else {
      // Create new settings
      const id = this.db.generateId();
      this.db.execute(
        `INSERT INTO queue_settings (id, userId, timeSlots, timezone, enabled, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          settings.userId,
          JSON.stringify(settings.timeSlots),
          settings.timezone || 'UTC',
          settings.enabled ? 1 : 0,
          now,
          now
        ]
      );
      return id;
    }
  }

  async saveThread(thread: any): Promise<string> {
    const now = Date.now();
    
    if (thread.id) {
      // Update existing thread
      this.db.execute(
        `UPDATE threads SET title = ?, tweets = ?, status = ?, scheduledDate = ?, error = ?, updatedAt = ?
         WHERE id = ?`,
        [
          thread.title || null,
          JSON.stringify(thread.tweets),
          thread.status || 'draft',
          thread.scheduledDate ? new Date(thread.scheduledDate).getTime() : null,
          thread.error || null,
          now,
          thread.id
        ]
      );
      return thread.id;
    } else {
      // Create new thread
      const id = this.db.generateId();
      this.db.execute(
        `INSERT INTO threads (id, userId, twitterAccountId, title, tweets, status, scheduledDate, error, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          thread.userId,
          thread.twitterAccountId,
          thread.title || null,
          JSON.stringify(thread.tweets),
          thread.status || 'draft',
          thread.scheduledDate ? new Date(thread.scheduledDate).getTime() : null,
          thread.error || null,
          now,
          now
        ]
      );
      return id;
    }
  }

  async getThread(threadId: string): Promise<any | null> {
    const thread = this.db.queryOne<any>(
      'SELECT * FROM threads WHERE id = ?',
      [threadId]
    );
    
    if (!thread) {
      return null;
    }
    
    return {
      id: thread.id,
      userId: thread.userId,
      twitterAccountId: thread.twitterAccountId,
      title: thread.title,
      tweets: JSON.parse(thread.tweets),
      status: thread.status,
      scheduledDate: thread.scheduledDate ? new Date(thread.scheduledDate) : null,
      twitterThreadId: thread.twitterThreadId,
      error: thread.error,
      createdAt: new Date(thread.createdAt),
      updatedAt: thread.updatedAt ? new Date(thread.updatedAt) : null
    };
  }

  async getThreads(userId: string, status?: any): Promise<any[]> {
    const query = status
      ? 'SELECT * FROM threads WHERE userId = ? AND status = ? ORDER BY createdAt DESC'
      : 'SELECT * FROM threads WHERE userId = ? ORDER BY createdAt DESC';
    
    const params = status ? [userId, status] : [userId];
    const threads = this.db.query<any>(query, params);
    
    return threads.map((thread: any) => ({
      id: thread.id,
      userId: thread.userId,
      twitterAccountId: thread.twitterAccountId,
      title: thread.title,
      tweets: JSON.parse(thread.tweets),
      status: thread.status,
      scheduledDate: thread.scheduledDate ? new Date(thread.scheduledDate) : null,
      twitterThreadId: thread.twitterThreadId,
      error: thread.error,
      createdAt: new Date(thread.createdAt),
      updatedAt: thread.updatedAt ? new Date(thread.updatedAt) : null
    }));
  }

  async deleteThread(threadId: string): Promise<void> {
    this.db.execute('DELETE FROM threads WHERE id = ?', [threadId]);
  }

  async updateThreadStatus(threadId: string, status: any, twitterThreadId?: string): Promise<void> {
    const now = Date.now();
    
    if (twitterThreadId) {
      this.db.execute(
        'UPDATE threads SET status = ?, twitterThreadId = ?, updatedAt = ? WHERE id = ?',
        [status, twitterThreadId, now, threadId]
      );
    } else {
      this.db.execute(
        'UPDATE threads SET status = ?, updatedAt = ? WHERE id = ?',
        [status, now, threadId]
      );
    }
  }

  async getApiUsage(userId: string): Promise<{ posts: number; reads: number; month: string }> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const usage = this.db.queryOne<{ posts: number; reads: number }>(
      'SELECT posts, reads FROM api_usage WHERE userId = ? AND month = ?',
      [userId, currentMonth]
    );
    
    if (!usage) {
      return { posts: 0, reads: 0, month: currentMonth };
    }
    
    return {
      posts: usage.posts,
      reads: usage.reads,
      month: currentMonth
    };
  }

  async incrementApiUsage(userId: string, endpoint: string): Promise<void> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const now = Date.now();
    
    // Check if usage record exists
    const existing = this.db.queryOne<{ id: string; posts: number; reads: number }>(
      'SELECT id, posts, reads FROM api_usage WHERE userId = ? AND month = ?',
      [userId, currentMonth]
    );
    
    if (existing) {
      // Update existing record
      const isPost = endpoint.includes('POST') || endpoint.includes('tweet') || endpoint.includes('thread');
      
      if (isPost) {
        this.db.execute(
          'UPDATE api_usage SET posts = posts + 1, updatedAt = ? WHERE id = ?',
          [now, existing.id]
        );
      } else {
        this.db.execute(
          'UPDATE api_usage SET reads = reads + 1, updatedAt = ? WHERE id = ?',
          [now, existing.id]
        );
      }
    } else {
      // Create new record
      const id = this.db.generateId();
      const isPost = endpoint.includes('POST') || endpoint.includes('tweet') || endpoint.includes('thread');
      
      this.db.execute(
        `INSERT INTO api_usage (id, userId, month, posts, reads, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          currentMonth,
          isPost ? 1 : 0,
          isPost ? 0 : 1,
          now,
          now
        ]
      );
    }
  }

  async checkApiLimits(userId: string, plan: string = 'free'): Promise<{ allowed: boolean; reason?: string }> {
    // API usage needs separate table
    return { allowed: true };
  }

  async saveSession(sessionId: string, sessionData: any, expiresAt: Date): Promise<void> {
    const now = Date.now();
    const expiresAtMs = expiresAt.getTime();
    
    this.db.execute(
      `INSERT OR REPLACE INTO sessions (id, data, expiresAt, createdAt) VALUES (?, ?, ?, ?)`,
      [sessionId, JSON.stringify(sessionData), expiresAtMs, now]
    );
  }

  async getSession(sessionId: string): Promise<any | null> {
    const now = Date.now();
    
    const session = this.db.queryOne<{ id: string; data: string; expiresAt: number }>(
      `SELECT id, data, expiresAt FROM sessions WHERE id = ? AND expiresAt > ?`,
      [sessionId, now]
    );
    
    if (!session) {
      return null;
    }
    
    return {
      id: session.id,
      data: JSON.parse(session.data),
      expiresAt: new Date(session.expiresAt)
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.db.execute(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    this.db.execute(`DELETE FROM sessions WHERE expiresAt <= ?`, [now]);
  }
}
