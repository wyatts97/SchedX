import { SqliteDatabase } from '../sqlite-wrapper.js';

// Embedded SQL schema - this ensures it works in bundled environments
const INITIAL_SCHEMA = `-- SchedX SQLite Schema
-- Migration 001: Initial schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    displayName TEXT,
    role TEXT DEFAULT 'user',
    emailOnSuccess INTEGER DEFAULT 1,
    emailOnFailure INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    lastLogin INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Accounts table (OAuth connections)
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    provider TEXT NOT NULL,
    providerAccountId TEXT NOT NULL,
    username TEXT,
    displayName TEXT,
    profileImage TEXT,
    accessToken TEXT,
    refreshToken TEXT,
    expiresAt INTEGER,
    isDefault INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, providerAccountId)
);
CREATE INDEX IF NOT EXISTS idx_accounts_userId ON accounts(userId);
CREATE INDEX IF NOT EXISTS idx_accounts_provider ON accounts(provider, providerAccountId);

-- Tweets table
CREATE TABLE IF NOT EXISTS tweets (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    twitterAccountId TEXT NOT NULL,
    content TEXT NOT NULL,
    scheduledDate INTEGER,
    community TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    twitterTweetId TEXT,
    error TEXT,
    media TEXT,
    likeCount INTEGER DEFAULT 0,
    retweetCount INTEGER DEFAULT 0,
    replyCount INTEGER DEFAULT 0,
    impressionCount INTEGER DEFAULT 0,
    recurrenceType TEXT,
    recurrenceInterval INTEGER,
    recurrenceEndDate INTEGER,
    templateName TEXT,
    templateCategory TEXT,
    queuePosition INTEGER,
    isThread INTEGER DEFAULT 0,
    threadId TEXT,
    threadPosition INTEGER,
    threadTotal INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tweets_userId ON tweets(userId);
CREATE INDEX IF NOT EXISTS idx_tweets_status ON tweets(status);
CREATE INDEX IF NOT EXISTS idx_tweets_scheduledDate ON tweets(scheduledDate);
CREATE INDEX IF NOT EXISTS idx_tweets_twitterAccountId ON tweets(twitterAccountId);

-- Twitter Apps table
CREATE TABLE IF NOT EXISTS twitter_apps (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    apiKey TEXT NOT NULL,
    apiSecret TEXT NOT NULL,
    bearerToken TEXT,
    bearerTokenSecret TEXT,
    clientId TEXT,
    clientSecret TEXT,
    callbackUrl TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_twitter_apps_userId ON twitter_apps(userId);
CREATE INDEX IF NOT EXISTS idx_twitter_apps_isActive ON twitter_apps(isActive);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    metadata TEXT,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_createdAt ON notifications(createdAt);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);

-- Threads table (for tweet threads)
CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    twitterAccountId TEXT NOT NULL,
    title TEXT,
    tweets TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    scheduledDate INTEGER,
    twitterThreadId TEXT,
    error TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_threads_userId ON threads(userId);
CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_scheduledDate ON threads(scheduledDate);
CREATE INDEX IF NOT EXISTS idx_threads_twitterAccountId ON threads(twitterAccountId);

-- Queue settings table (user scheduling preferences)
CREATE TABLE IF NOT EXISTS queue_settings (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL UNIQUE,
    enabled INTEGER DEFAULT 1,
    postingTimes TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    minInterval INTEGER DEFAULT 60,
    maxPostsPerDay INTEGER DEFAULT 10,
    skipWeekends INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_queue_settings_userId ON queue_settings(userId);

-- API usage tracking table
CREATE TABLE IF NOT EXISTS api_usage (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    month TEXT NOT NULL,
    posts INTEGER DEFAULT 0,
    reads INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(userId, month)
);
CREATE INDEX IF NOT EXISTS idx_api_usage_userId ON api_usage(userId);
CREATE INDEX IF NOT EXISTS idx_api_usage_month ON api_usage(month);

-- OpenRouter settings table (AI configuration)
CREATE TABLE IF NOT EXISTS openrouter_settings (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL UNIQUE,
    apiKey TEXT NOT NULL,
    model TEXT DEFAULT 'openai/gpt-3.5-turbo',
    temperature REAL DEFAULT 0.8,
    maxTokens INTEGER DEFAULT 150,
    enabled INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_openrouter_settings_userId ON openrouter_settings(userId);
CREATE INDEX IF NOT EXISTS idx_openrouter_settings_enabled ON openrouter_settings(enabled);`;

// Migration 002: Analytics Tables
const ANALYTICS_SCHEMA = `-- Daily engagement snapshots per account
CREATE TABLE IF NOT EXISTS daily_stats (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  date TEXT NOT NULL,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_retweets INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0,
  top_tweet_id TEXT,
  posts_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_stats_account_date ON daily_stats(account_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

-- Content analytics per tweet
CREATE TABLE IF NOT EXISTS content_analytics (
  id TEXT PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  has_image INTEGER DEFAULT 0,
  has_video INTEGER DEFAULT 0,
  has_gif INTEGER DEFAULT 0,
  has_link INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  hashtag_count INTEGER DEFAULT 0,
  hashtags TEXT,
  mention_count INTEGER DEFAULT 0,
  char_count INTEGER DEFAULT 0,
  post_hour INTEGER,
  post_day INTEGER,
  post_timestamp INTEGER NOT NULL,
  engagement_score REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tweet_id) REFERENCES tweets(id) ON DELETE CASCADE,
  UNIQUE(tweet_id)
);
CREATE INDEX IF NOT EXISTS idx_content_analytics_tweet ON content_analytics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_content_analytics_post_time ON content_analytics(post_hour, post_day);
CREATE INDEX IF NOT EXISTS idx_content_analytics_engagement ON content_analytics(engagement_score DESC);

-- Smart insights cache
CREATE TABLE IF NOT EXISTS insights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  data TEXT,
  generated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  dismissed INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_insights_user_expires ON insights(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON insights(priority DESC, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_dismissed ON insights(dismissed, expires_at);

-- Tweet engagement history
CREATE TABLE IF NOT EXISTS engagement_snapshots (
  id TEXT PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  retweet_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  impression_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tweet_id) REFERENCES tweets(id) ON DELETE CASCADE,
  UNIQUE(tweet_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_tweet_date ON engagement_snapshots(tweet_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_date ON engagement_snapshots(snapshot_date);`;

/**
 * Run database migrations
 */
export async function runMigrations(db: SqliteDatabase): Promise<void> {
  console.log('Running database migrations...');

  // Migration 001: Initial Schema
  const initialStatements = INITIAL_SCHEMA
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  db.transaction(() => {
    for (const statement of initialStatements) {
      if (statement.trim()) {
        db.execute(statement + ';');
      }
    }
  });

  // Migration 002: Analytics Tables
  const analyticsStatements = ANALYTICS_SCHEMA
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  db.transaction(() => {
    for (const statement of analyticsStatements) {
      if (statement.trim()) {
        db.execute(statement + ';');
      }
    }
  });

  // Migration 003: Add unique index on twitterTweetId to prevent double posting
  try {
    db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tweets_twitter_tweet_id_unique 
                ON tweets(twitterTweetId) WHERE twitterTweetId IS NOT NULL`);
    db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_twitter_thread_id_unique 
                ON threads(twitterThreadId) WHERE twitterThreadId IS NOT NULL`);
  } catch (error) {
    // Index may already exist, ignore error
    console.log('Note: Unique indexes may already exist');
  }

  // Migration 004: Push notification subscriptions table
  db.execute(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(userId, endpoint)
  )`);
  db.execute(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_userId ON push_subscriptions(userId)`);
  db.execute(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint)`);

  console.log('✅ Database migrations completed');
}

/**
 * Seed default admin user
 */
export async function seedDefaultAdmin(
  db: SqliteDatabase,
  email: string,
  password: string
): Promise<void> {
  // Check if admin already exists
  const existing = db.queryOne(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );

  if (existing) {
    console.log('✅ Default admin user already exists');
    return;
  }

  // Create admin user
  const id = db.generateId();
  const now = db.now();

  db.execute(
    `INSERT INTO users (id, email, password, displayName, role, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, email, password, 'Admin', 'admin', now]
  );

  console.log('✅ Default admin user created');
}
