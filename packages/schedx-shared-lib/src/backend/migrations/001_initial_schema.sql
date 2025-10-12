-- SchedX SQLite Schema
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
