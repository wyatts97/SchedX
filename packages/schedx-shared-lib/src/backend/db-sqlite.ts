import { SqliteDatabase } from './sqlite-wrapper.js';
import { TweetStatus, Tweet, UserAccount, Notification } from '../types/types.js';
import { EncryptionService } from './encryption.js';
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
      const { readFileSync, readdirSync, existsSync } = require('fs');
      const { join } = require('path');
      
      // Create migrations tracking table if it doesn't exist
      this.db.execute(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at INTEGER NOT NULL
        )
      `);
      
      // Find migrations directory
      let migrationsDir: string;
      try {
        // Try multiple possible locations
        const possiblePaths = [
          join(__dirname, 'migrations'),
          join(__dirname, '..', 'src', 'backend', 'migrations'),
          // In production Docker, when bundled by SvelteKit
          join(process.cwd(), 'packages', 'schedx-shared-lib', 'dist', 'backend', 'migrations'),
          // Alternative production path
          '/app/packages/schedx-shared-lib/dist/backend/migrations'
        ];
        
        migrationsDir = possiblePaths.find(p => existsSync(p)) || '';
        
        if (!migrationsDir) {
          logger.warn({ attemptedPaths: possiblePaths }, 'Could not find migrations directory in any expected location');
          return;
        }
      } catch {
        logger.warn('Could not find migrations directory, assuming schema exists');
        return;
      }
      
      if (!existsSync(migrationsDir)) {
        logger.warn('Migrations directory not found, assuming schema exists');
        return;
      }
      
      // Get all migration files
      const migrationFiles = readdirSync(migrationsDir)
        .filter((f: string) => f.endsWith('.sql'))
        .sort();
      
      if (migrationFiles.length === 0) {
        logger.warn('No migration files found');
        return;
      }
      
      // Get already applied migrations
      const appliedMigrations = new Set(
        this.db.query<{ version: string }>('SELECT version FROM schema_migrations')
          .map(row => row.version)
      );
      
      // Run pending migrations
      const pendingMigrations = migrationFiles.filter((f: string) => !appliedMigrations.has(f));
      
      if (pendingMigrations.length === 0) {
        logger.debug('All migrations already applied');
        return;
      }
      
      logger.info({ count: pendingMigrations.length, migrations: pendingMigrations }, 'Running pending migrations');
      
      for (const migrationFile of pendingMigrations) {
        const migrationPath = join(migrationsDir, migrationFile);
        let sql = readFileSync(migrationPath, 'utf8');
        
        // Remove comment lines before splitting
        sql = sql
          .split('\n')
          .filter((line: string) => !line.trim().startsWith('--'))
          .join('\n');
        
        const statements = sql
          .split(';')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
        
        this.db.transaction(() => {
          for (const statement of statements) {
            try {
              this.db.execute(statement);
              logger.debug({ statement: statement.substring(0, 100) }, 'Statement executed successfully');
            } catch (err: any) {
              // Ignore errors for already-applied changes
              const ignorableErrors = [
                'duplicate column',
                'Cannot add a UNIQUE column',
                'already exists'
              ];
              const shouldIgnore = ignorableErrors.some(msg => err.message?.includes(msg));
              
              if (!shouldIgnore) {
                logger.error({ error: err, migration: migrationFile, statement }, 'Migration statement failed');
                throw err;
              } else {
                logger.debug({ error: err.message, statement: statement.substring(0, 100) }, 'Ignoring expected migration error');
              }
            }
          }
          
          // Mark migration as applied
          this.db.execute(
            'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
            [migrationFile, Date.now()]
          );
        });
        
        logger.info({ migration: migrationFile }, 'Migration applied successfully');
      }
      
      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error({ error, message: error instanceof Error ? error.message : 'Unknown error' }, 'Migration failed');
      // Don't throw - allow app to start even if migrations fail
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

  async createAdminUser(user: import('../types/types.js').AdminUser): Promise<string> {
    const id = this.db.generateId();
    const now = this.db.now();
    
    this.db.execute(
      `INSERT INTO users (id, username, email, password, displayName, role, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        user.username,
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

  async hasAdminUsers(): Promise<boolean> {
    const result = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      ['admin']
    );
    return result ? result.count > 0 : false;
  }

  async getFirstAdminUser(): Promise<{ id: string; username: string } | null> {
    const user = this.db.queryOne<{ id: string; username: string }>(
      'SELECT id, username FROM users WHERE role = ? LIMIT 1',
      ['admin']
    );
    return user || null;
  }

  async getAdminUserByUsername(username: string): Promise<import('../types/types.js').AdminUser | null> {
    // Look up user by username (added in migration 008)
    const user = this.db.queryOne<any>(
      'SELECT * FROM users WHERE username = ? AND role = ?',
      [username, 'admin']
    );
    
    if (!user) return null;
    
    return {
      id: user.id,
      username: user.username || user.displayName || user.email,
      passwordHash: user.password,
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar || '/avatar.png',
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
    
    // Check username uniqueness if changing
    if (updates.username !== undefined) {
      const existing = this.db.queryOne<{ id: string }>(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [updates.username, id]
      );
      if (existing) {
        throw new Error('Username already taken');
      }
      updateFields.push('username = ?');
      params.push(updates.username);
    }
    
    if (updates.email !== undefined) {
      updateFields.push('email = ?');
      params.push(updates.email);
    }
    if (updates.avatar !== undefined) {
      updateFields.push('avatar = ?');
      params.push(updates.avatar);
    }
    
    if (updateFields.length === 0) {
      return; // Nothing to update
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
          profileImage = ?, accessToken = ?, refreshToken = ?, expiresAt = ?, twitterAppId = ?, isDefault = ?, updatedAt = ?
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
          userAccount.twitterAppId || null,
          (userAccount as any).isDefault ? 1 : 0,
          now,
          existingAccount.id
        ]
      );
      
      return existingAccount.id;
    } else {
      // Insert new account
      const id = this.db.generateId();
      
      this.db.execute(
        `INSERT INTO accounts (id, userId, provider, providerAccountId, username, displayName, profileImage, accessToken, refreshToken, expiresAt, twitterAppId, isDefault, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          userAccount.twitterAppId || null,
          (userAccount as any).isDefault ? 1 : 0,
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
      expires_at: account.expiresAt,
      twitterAppId: account.twitterAppId,
      isDefault: account.isDefault === 1
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
      expires_at: account.expiresAt,
      twitterAppId: account.twitterAppId,
      isDefault: account.isDefault === 1
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
      expires_at: account.expiresAt,
      twitterAppId: account.twitterAppId,
      isDefault: account.isDefault === 1
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
      expires_at: account.expiresAt,
      twitterAppId: account.twitterAppId,
      isDefault: account.isDefault === 1
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
      expires_at: account.expiresAt,
      twitterAppId: account.twitterAppId,
      isDefault: account.isDefault === 1
    } as UserAccount));
  }

  async clearDefaultAccounts(): Promise<void> {
    const now = this.db.now();
    this.db.execute(
      'UPDATE accounts SET isDefault = 0, updatedAt = ? WHERE isDefault = 1',
      [now]
    );
  }

  async setDefaultAccount(accountId: string): Promise<void> {
    const now = this.db.now();
    this.db.execute(
      'UPDATE accounts SET isDefault = 1, updatedAt = ? WHERE id = ?',
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
      `INSERT INTO tweets (
        id, userId, twitterAccountId, content, scheduledDate, community, status, media,
        likeCount, retweetCount, replyCount, impressionCount,
        recurrenceType, recurrenceInterval, recurrenceEndDate,
        templateName, templateCategory, queuePosition,
        isThread, threadId, threadPosition, threadTotal,
        twitterTweetId, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tweet.userId,
        tweet.twitterAccountId,
        tweet.content,
        tweet.scheduledDate ? tweet.scheduledDate.getTime() : null,
        tweet.community || '',
        tweet.status || TweetStatus.SCHEDULED,
        this.db.stringifyJson(tweet.media || []),
        tweet.likeCount || 0,
        tweet.retweetCount || 0,
        tweet.replyCount || 0,
        tweet.impressionCount || 0,
        tweet.recurrenceType || null,
        tweet.recurrenceInterval || null,
        tweet.recurrenceEndDate ? tweet.recurrenceEndDate.getTime() : null,
        tweet.templateName || null,
        tweet.templateCategory || null,
        tweet.queuePosition || null,
        tweet.isThread ? 1 : 0,
        tweet.threadId || null,
        tweet.threadPosition || null,
        tweet.threadTotal || null,
        tweet.twitterTweetId || null,
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
      scheduledDate: tweet.scheduledDate ? new Date(tweet.scheduledDate) : new Date(),
      community: tweet.community || '',
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterAccountId: tweet.twitterAccountId,
      twitterTweetId: tweet.twitterTweetId,
      error: tweet.error,
      media: this.db.parseJson(tweet.media) || [],
      likeCount: tweet.likeCount || 0,
      retweetCount: tweet.retweetCount || 0,
      replyCount: tweet.replyCount || 0,
      impressionCount: tweet.impressionCount || 0,
      recurrenceType: tweet.recurrenceType || null,
      recurrenceInterval: tweet.recurrenceInterval || null,
      recurrenceEndDate: tweet.recurrenceEndDate ? new Date(tweet.recurrenceEndDate) : null,
      templateName: tweet.templateName || undefined,
      templateCategory: tweet.templateCategory || undefined,
      queuePosition: tweet.queuePosition || undefined,
      isThread: tweet.isThread === 1,
      threadId: tweet.threadId || undefined,
      threadPosition: tweet.threadPosition || undefined,
      threadTotal: tweet.threadTotal || undefined
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
      community: tweet.community || '',
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterAccountId: tweet.twitterAccountId,
      twitterTweetId: tweet.twitterTweetId,
      media: this.db.parseJson(tweet.media) || [],
      likeCount: tweet.likeCount || 0,
      retweetCount: tweet.retweetCount || 0,
      replyCount: tweet.replyCount || 0,
      impressionCount: tweet.impressionCount || 0,
      recurrenceType: tweet.recurrenceType || null,
      recurrenceInterval: tweet.recurrenceInterval || null,
      recurrenceEndDate: tweet.recurrenceEndDate ? new Date(tweet.recurrenceEndDate) : null,
      templateName: tweet.templateName || undefined,
      templateCategory: tweet.templateCategory || undefined,
      queuePosition: tweet.queuePosition || undefined,
      isThread: tweet.isThread === 1,
      threadId: tweet.threadId || undefined,
      threadPosition: tweet.threadPosition || undefined,
      threadTotal: tweet.threadTotal || undefined
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
    logger.info({ tweetId, twitterTweetId }, 'Updating tweet with Twitter Tweet ID');
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
    if (updates.community !== undefined) {
      updateFields.push('community = ?');
      params.push(updates.community);
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
    if (updates.templateName !== undefined) {
      updateFields.push('templateName = ?');
      params.push(updates.templateName);
    }
    if (updates.templateCategory !== undefined) {
      updateFields.push('templateCategory = ?');
      params.push(updates.templateCategory);
    }
    if (updates.queuePosition !== undefined) {
      updateFields.push('queuePosition = ?');
      params.push(updates.queuePosition);
    }
    if (updates.recurrenceType !== undefined) {
      updateFields.push('recurrenceType = ?');
      params.push(updates.recurrenceType);
    }
    if (updates.recurrenceInterval !== undefined) {
      updateFields.push('recurrenceInterval = ?');
      params.push(updates.recurrenceInterval);
    }
    if (updates.recurrenceEndDate !== undefined) {
      updateFields.push('recurrenceEndDate = ?');
      params.push(updates.recurrenceEndDate ? updates.recurrenceEndDate.getTime() : null);
    }
    if (updates.twitterTweetId !== undefined) {
      updateFields.push('twitterTweetId = ?');
      params.push(updates.twitterTweetId);
    }
    
    updateFields.push('updatedAt = ?');
    params.push(now, tweetId);
    
    this.db.execute(
      `UPDATE tweets SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );
  }

  async getAllTweets(userId: string): Promise<any[]> {
    const tweets = this.db.query<any>('SELECT * FROM tweets WHERE userId = ?', [userId]);
    
    return tweets.map((tweet: any) => ({
      id: tweet.id,
      userId: tweet.userId,
      content: tweet.content,
      scheduledDate: tweet.scheduledDate ? new Date(tweet.scheduledDate) : new Date(),
      community: tweet.community || '',
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterAccountId: tweet.twitterAccountId,
      twitterTweetId: tweet.twitterTweetId,
      error: tweet.error,
      media: this.db.parseJson(tweet.media) || [],
      likeCount: tweet.likeCount || 0,
      retweetCount: tweet.retweetCount || 0,
      replyCount: tweet.replyCount || 0,
      impressionCount: tweet.impressionCount || 0,
      recurrenceType: tweet.recurrenceType || null,
      recurrenceInterval: tweet.recurrenceInterval || null,
      recurrenceEndDate: tweet.recurrenceEndDate ? new Date(tweet.recurrenceEndDate) : null,
      templateName: tweet.templateName || undefined,
      templateCategory: tweet.templateCategory || undefined,
      queuePosition: tweet.queuePosition || undefined,
      isThread: tweet.isThread === 1,
      threadId: tweet.threadId || undefined,
      threadPosition: tweet.threadPosition || undefined,
      threadTotal: tweet.threadTotal || undefined
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
      community: tweet.community || '',
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterAccountId: tweet.twitterAccountId,
      twitterTweetId: tweet.twitterTweetId,
      media: this.db.parseJson(tweet.media) || [],
      likeCount: tweet.likeCount || 0,
      retweetCount: tweet.retweetCount || 0,
      replyCount: tweet.replyCount || 0,
      impressionCount: tweet.impressionCount || 0,
      recurrenceType: tweet.recurrenceType || null,
      recurrenceInterval: tweet.recurrenceInterval || null,
      recurrenceEndDate: tweet.recurrenceEndDate ? new Date(tweet.recurrenceEndDate) : null,
      templateName: tweet.templateName || undefined,
      templateCategory: tweet.templateCategory || undefined,
      queuePosition: tweet.queuePosition || undefined,
      isThread: tweet.isThread === 1,
      threadId: tweet.threadId || undefined,
      threadPosition: tweet.threadPosition || undefined,
      threadTotal: tweet.threadTotal || undefined
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
      scheduledDate: tweet.scheduledDate ? new Date(tweet.scheduledDate) : new Date(),
      community: tweet.community || '',
      status: tweet.status,
      createdAt: new Date(tweet.createdAt),
      updatedAt: tweet.updatedAt ? new Date(tweet.updatedAt) : undefined,
      twitterAccountId: tweet.twitterAccountId,
      twitterTweetId: tweet.twitterTweetId,
      media: this.db.parseJson(tweet.media) || [],
      likeCount: tweet.likeCount || 0,
      retweetCount: tweet.retweetCount || 0,
      replyCount: tweet.replyCount || 0,
      impressionCount: tweet.impressionCount || 0,
      recurrenceType: tweet.recurrenceType || null,
      recurrenceInterval: tweet.recurrenceInterval || null,
      recurrenceEndDate: tweet.recurrenceEndDate ? new Date(tweet.recurrenceEndDate) : null,
      templateName: tweet.templateName || undefined,
      templateCategory: tweet.templateCategory || undefined,
      queuePosition: tweet.queuePosition || undefined,
      isThread: tweet.isThread === 1,
      threadId: tweet.threadId || undefined,
      threadPosition: tweet.threadPosition || undefined,
      threadTotal: tweet.threadTotal || undefined
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

  async createTwitterApp(app: import('../types/types.js').TwitterApp, userId: string): Promise<string> {
    const id = this.db.generateId();
    const now = this.db.now();
    
    logger.debug({
      id,
      name: app.name,
      hasConsumerKey: !!app.consumerKey,
      hasClientId: !!app.clientId,
      clientIdPrefix: app.clientId?.substring(0, 15) + '...'
    }, 'Creating Twitter app');
    
    this.db.execute(
      `INSERT INTO twitter_apps (id, userId, name, apiKey, apiSecret, bearerToken, bearerTokenSecret, clientId, clientSecret, callbackUrl, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        app.name,
        app.consumerKey || '',  // OAuth 1.0a API Key (for media uploads)
        app.consumerSecret || '',  // OAuth 1.0a API Secret
        app.accessToken || '',  // OAuth 1.0a Access Token
        app.accessTokenSecret || '',  // OAuth 1.0a Access Token Secret
        app.clientId || '',  // OAuth 2.0 Client ID (for user auth)
        app.clientSecret || '',  // OAuth 2.0 Client Secret
        app.callbackUrl || '',
        1,
        now,
        now
      ]
    );
    
    logger.debug({ id, name: app.name }, 'Twitter app created successfully');
    
    return id;
  }

  async updateTwitterApp(id: string, updates: Partial<import('../types/types.js').TwitterApp>): Promise<void> {
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
    if (updates.accessTokenSecret !== undefined) {
      updateFields.push('bearerTokenSecret = ?');
      params.push(updates.accessTokenSecret);
    }
    if (updates.clientId !== undefined) {
      updateFields.push('clientId = ?');
      params.push(updates.clientId);
    }
    if (updates.clientSecret !== undefined) {
      updateFields.push('clientSecret = ?');
      params.push(updates.clientSecret);
    }
    if (updates.callbackUrl !== undefined) {
      updateFields.push('callbackUrl = ?');
      params.push(updates.callbackUrl);
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

  async getTwitterApp(id: string): Promise<import('../types/types.js').TwitterApp | null> {
    logger.debug({ requestedId: id }, 'Getting Twitter app from database');
    const app = this.db.queryOne<any>('SELECT * FROM twitter_apps WHERE id = ?', [id]);
    
    if (!app) {
      logger.debug({ requestedId: id }, 'Twitter app not found in database');
      return null;
    }
    
    const result = {
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
    
    logger.debug({
      requestedId: id,
      returnedId: result.id,
      name: result.name,
      clientIdPrefix: result.clientId?.substring(0, 15) + '...',
      idsMatch: id === result.id
    }, 'Twitter app retrieved from database');
    
    return result;
  }

  async listTwitterApps(): Promise<import('../types/types.js').TwitterApp[]> {
    const apps = this.db.query<any>('SELECT * FROM twitter_apps');
    
    logger.debug({ count: apps.length }, 'Listing Twitter apps from database');
    
    const result = apps.map((app: any) => ({
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
    
    logger.info({
      apps: result.map(app => ({ 
        id: app.id, 
        name: app.name, 
        clientId: app.clientId, // Log FULL client ID to verify they're different
        callbackUrl: app.callbackUrl
      }))
    }, 'Twitter apps listed - FULL CLIENT IDS');
    
    return result;
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
      enabled: settings.enabled === 1,
      postingTimes: JSON.parse(settings.postingTimes),
      timezone: settings.timezone,
      minInterval: settings.minInterval,
      maxPostsPerDay: settings.maxPostsPerDay,
      skipWeekends: settings.skipWeekends === 1,
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
        `UPDATE queue_settings SET enabled = ?, postingTimes = ?, timezone = ?, minInterval = ?, maxPostsPerDay = ?, skipWeekends = ?, updatedAt = ?
         WHERE userId = ?`,
        [
          settings.enabled ? 1 : 0,
          JSON.stringify(settings.postingTimes || []),
          settings.timezone || 'UTC',
          settings.minInterval || 60,
          settings.maxPostsPerDay || 10,
          settings.skipWeekends ? 1 : 0,
          now,
          settings.userId
        ]
      );
      return existing.id;
    } else {
      // Create new settings
      const id = this.db.generateId();
      this.db.execute(
        `INSERT INTO queue_settings (id, userId, enabled, postingTimes, timezone, minInterval, maxPostsPerDay, skipWeekends, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          settings.userId,
          settings.enabled ? 1 : 0,
          JSON.stringify(settings.postingTimes || []),
          settings.timezone || 'UTC',
          settings.minInterval || 60,
          settings.maxPostsPerDay || 10,
          settings.skipWeekends ? 1 : 0,
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

  // Resend Settings Methods
  async getResendSettings(userId: string): Promise<{
    id: string;
    userId: string;
    apiKey: string;
    fromEmail: string;
    fromName: string;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    const settings = this.db.queryOne<any>(
      'SELECT * FROM resend_settings WHERE userId = ?',
      [userId]
    );
    
    if (!settings) {
      return null;
    }
    
    // Decrypt API key
    const decryptedApiKey = this.encryptionService.decrypt(settings.apiKey);
    
    return {
      id: settings.id,
      userId: settings.userId,
      apiKey: decryptedApiKey,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      enabled: Boolean(settings.enabled),
      createdAt: new Date(settings.createdAt),
      updatedAt: new Date(settings.updatedAt)
    };
  }

  async saveResendSettings(data: {
    userId: string;
    apiKey: string;
    fromEmail?: string;
    fromName?: string;
    enabled?: boolean;
  }): Promise<void> {
    const existing = await this.getResendSettings(data.userId);
    const now = Date.now();
    
    // Encrypt API key
    const encryptedApiKey = this.encryptionService.encrypt(data.apiKey);
    
    if (existing) {
      // Update existing settings
      this.db.execute(
        `UPDATE resend_settings 
         SET apiKey = ?, fromEmail = ?, fromName = ?, enabled = ?, updatedAt = ?
         WHERE userId = ?`,
        [
          encryptedApiKey,
          data.fromEmail || existing.fromEmail,
          data.fromName || existing.fromName,
          data.enabled !== undefined ? (data.enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
          now,
          data.userId
        ]
      );
    } else {
      // Insert new settings
      const id = crypto.randomUUID();
      this.db.execute(
        `INSERT INTO resend_settings (id, userId, apiKey, fromEmail, fromName, enabled, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.userId,
          encryptedApiKey,
          data.fromEmail || 'noreply@schedx.app',
          data.fromName || 'SchedX',
          data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
          now,
          now
        ]
      );
    }
    
    logger.info({ userId: data.userId }, 'Resend settings saved');
  }

  async deleteResendSettings(userId: string): Promise<void> {
    this.db.execute('DELETE FROM resend_settings WHERE userId = ?', [userId]);
    logger.info({ userId }, 'Resend settings deleted');
  }

  // OpenRouter Settings Methods
  async getOpenRouterSettings(userId: string): Promise<{
    id: string;
    userId: string;
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    const settings = this.db.queryOne<any>(
      'SELECT * FROM openrouter_settings WHERE userId = ?',
      [userId]
    );
    
    if (!settings) {
      return null;
    }
    
    // Decrypt API key
    const decryptedApiKey = this.encryptionService.decrypt(settings.apiKey);
    
    return {
      id: settings.id,
      userId: settings.userId,
      apiKey: decryptedApiKey,
      model: settings.model || settings.defaultModel || 'openai/gpt-3.5-turbo',
      temperature: settings.temperature ?? 0.8,
      maxTokens: settings.maxTokens ?? 150,
      enabled: Boolean(settings.enabled),
      createdAt: new Date(settings.createdAt),
      updatedAt: new Date(settings.updatedAt)
    };
  }

  async saveOpenRouterSettings(data: {
    userId: string;
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    enabled?: boolean;
  }): Promise<void> {
    const existing = await this.getOpenRouterSettings(data.userId);
    const now = Date.now();
    
    // Encrypt API key
    const encryptedApiKey = this.encryptionService.encrypt(data.apiKey);
    
    if (existing) {
      // Update existing settings
      this.db.execute(
        `UPDATE openrouter_settings 
         SET apiKey = ?, model = ?, temperature = ?, maxTokens = ?, enabled = ?, updatedAt = ?
         WHERE userId = ?`,
        [
          encryptedApiKey,
          data.model || existing.model,
          data.temperature !== undefined ? data.temperature : existing.temperature,
          data.maxTokens !== undefined ? data.maxTokens : existing.maxTokens,
          data.enabled !== undefined ? (data.enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
          now,
          data.userId
        ]
      );
    } else {
      // Insert new settings
      const id = crypto.randomUUID();
      this.db.execute(
        `INSERT INTO openrouter_settings (id, userId, apiKey, model, temperature, maxTokens, enabled, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.userId,
          encryptedApiKey,
          data.model || 'openai/gpt-3.5-turbo',
          data.temperature !== undefined ? data.temperature : 0.8,
          data.maxTokens !== undefined ? data.maxTokens : 150,
          data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
          now,
          now
        ]
      );
    }
    
    logger.info({ userId: data.userId }, 'OpenRouter settings saved');
  }

  async deleteOpenRouterSettings(userId: string): Promise<void> {
    this.db.execute('DELETE FROM openrouter_settings WHERE userId = ?', [userId]);
    logger.info({ userId }, 'OpenRouter settings deleted');
  }

  // ============================================
  // PROMPT MANAGEMENT METHODS
  // ============================================

  getSavedPrompts(userId: string) {
    return this.db.query(
      `SELECT id, prompt, tone, length, usageCount, createdAt, updatedAt
       FROM saved_prompts
       WHERE userId = ?
       ORDER BY createdAt DESC`,
      [userId]
    );
  }

  getPromptHistory(userId: string, limit: number = 10) {
    return this.db.query(
      `SELECT id, prompt, tone, length, createdAt
       FROM prompt_history
       WHERE userId = ?
       ORDER BY createdAt DESC
       LIMIT ?`,
      [userId, limit]
    );
  }

  addPromptHistory(id: string, userId: string, prompt: string, tone: string | null, length: string | null, createdAt: number) {
    this.db.execute(
      `INSERT INTO prompt_history (id, userId, prompt, tone, length, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, prompt, tone, length, createdAt]
    );
  }

  deleteOldPromptHistory(userId: string, keepCount: number) {
    const allHistory = this.db.query<{ id: string }>(
      `SELECT id FROM prompt_history WHERE userId = ? ORDER BY createdAt DESC`,
      [userId]
    );
    
    if (allHistory.length > keepCount) {
      const toDelete = allHistory.slice(keepCount).map(h => h.id);
      const placeholders = toDelete.map(() => '?').join(',');
      this.db.execute(
        `DELETE FROM prompt_history WHERE id IN (${placeholders})`,
        toDelete
      );
    }
  }

  getSavedPromptsCount(userId: string): number {
    const result = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM saved_prompts WHERE userId = ?',
      [userId]
    );
    return result?.count || 0;
  }

  findSavedPrompt(userId: string, prompt: string, tone: string | null, length: string | null) {
    return this.db.queryOne(
      `SELECT id FROM saved_prompts
       WHERE userId = ? AND prompt = ? AND tone = ? AND length = ?`,
      [userId, prompt, tone, length]
    );
  }

  saveSavedPrompt(id: string, userId: string, prompt: string, tone: string | null, length: string | null, now: number) {
    this.db.execute(
      `INSERT INTO saved_prompts (id, userId, prompt, tone, length, usageCount, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, userId, prompt, tone, length, now, now]
    );
  }

  deleteSavedPrompt(id: string, userId: string) {
    this.db.execute(
      'DELETE FROM saved_prompts WHERE id = ? AND userId = ?',
      [id, userId]
    );
  }
}
