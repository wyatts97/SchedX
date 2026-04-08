export enum TweetStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  POSTED = 'posted',
  FAILED = 'failed'
}

export interface UserAccount {
  id?: string;
  userId: string;
  username: string;
  displayName?: string;
  profileImage?: string;
  provider: string;
  providerAccountId: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
  scope: string;
  createdAt: Date;
  updatedAt?: Date;
  twitterAppId: string; // Reference to TwitterApp
  isDefault?: boolean; // Whether this is the default account
  // Extended properties for database rows
  accessToken?: string; // Encrypted in DB
  refreshToken?: string; // Encrypted in DB
  expiresAt?: number;
  followerCount?: number;
}

// ============================================================================
// Raw Database Row Types
// These interfaces define the exact shape of SQLite query results
// ============================================================================

/** Raw user row from database */
export interface UserRow {
  id: string;
  username: string;
  email?: string;
  password: string;
  displayName?: string;
  avatar?: string;
  role?: string;
  createdAt: number;
  updatedAt: number;
  emailOnSuccess?: number;
  emailOnFailure?: number;
  timezone?: string;
  passwordChangedAt?: number;
}

/** Raw account row from database */
export interface AccountRow {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  username: string;
  displayName?: string;
  profileImage?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  twitterAppId?: string;
  isDefault?: number;
  createdAt: number;
  updatedAt: number;
  followerCount?: number;
}

/** Raw tweet row from database */
export interface TweetRow {
  id: string;
  userId: string;
  twitterAccountId: string;
  content: string;
  scheduledDate: number;
  community?: string;
  status: string;
  media?: string;
  createdAt: number;
  updatedAt?: number;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  impressionCount?: number;
  bookmarkCount?: number;
  twitterTweetId?: string;
  error?: string;
  recurrenceType?: string;
  recurrenceInterval?: number;
  recurrenceEndDate?: number;
  templateName?: string;
  templateCategory?: string;
  queuePosition?: number;
  isThread?: number;
  threadId?: string;
  threadPosition?: number;
  threadTotal?: number;
}

/** Raw notification row from database */
export interface NotificationRow {
  id: string;
  userId: string;
  type: string;
  message: string;
  read?: number;
  metadata?: string;
  createdAt: number;
}

/** Raw queue settings row from database */
export interface QueueSettingsRow {
  id: string;
  userId: string;
  twitterAccountId?: string;
  enabled?: number;
  postingTimes: string;
  timezone?: string;
  minInterval?: number;
  maxPostsPerDay?: number;
  skipWeekends?: number;
  createdAt: number;
  updatedAt?: number;
}

/** Raw Twitter app row from database */
export interface TwitterAppRow {
  id: string;
  name: string;
  apiKey?: string;
  apiSecret?: string;
  bearerToken?: string;
  bearerTokenSecret?: string;
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
  isActive?: number;
  createdAt: number;
  updatedAt: number;
}

/** Raw thread row from database */
export interface ThreadRow {
  id: string;
  userId: string;
  twitterAccountId: string;
  title?: string;
  tweets: string; // JSON string
  status: string;
  scheduledDate?: number;
  twitterThreadId?: string;
  error?: string;
  partialProgress?: string; // JSON string
  createdAt: number;
  updatedAt?: number;
}

/** Raw Resend settings row from database */
export interface ResendSettingsRow {
  id: string;
  userId: string;
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
  enabled?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Tweet {
  id?: string;
  userId: string;
  content: string;
  scheduledDate: Date;
  community: string;
  status: TweetStatus;
  createdAt: Date;
  updatedAt?: Date;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  impressionCount?: number;
  bookmarkCount?: number;
  twitterTweetId?: string;
  twitterAccountId?: string;
  recurrenceType?: 'daily' | 'weekly' | 'monthly' | null;
  recurrenceInterval?: number | null;
  recurrenceEndDate?: Date | null;
  templateName?: string;
  templateCategory?: string;
  media?: { url: string; type: 'photo' | 'gif' | 'video' }[];
  queuePosition?: number; // Position in queue (for QUEUED status)
  // Retry support for failed tweets
  retryCount?: number; // Number of retry attempts made
  maxRetries?: number; // Maximum retry attempts (default 3)
  lastError?: string; // Last error message for debugging
  nextRetryAt?: Date; // Next retry time (for exponential backoff)
  // Thread support
  isThread?: boolean; // Whether this is part of a thread
  threadId?: string; // ID of the parent thread
  threadPosition?: number; // Position in thread (1, 2, 3, etc.)
  threadTotal?: number; // Total tweets in thread
  error?: string; // Error message if tweet failed
}

export interface Thread {
  id?: string;
  userId: string;
  title?: string; // Optional thread title for organization
  twitterAccountId: string;
  scheduledDate: Date | null;
  status: TweetStatus | string;
  tweets: ThreadTweet[]; // Array of tweets in the thread
  createdAt: Date;
  updatedAt?: Date | null;
  twitterThreadId?: string; // ID of first tweet in posted thread
  error?: string; // Error message if thread failed
  partialProgress?: {
    postedTweetIds: string[];
    lastSuccessIndex: number;
    failedAtIndex: number;
    error: string;
    failedAt: string;
  } | null;
}

export interface ThreadTweet {
  content: string;
  media?: { url: string; type: 'photo' | 'gif' | 'video' }[];
  position: number; // 1, 2, 3, etc.
  twitterTweetId?: string; // ID after posting
}

export interface QueueSettings {
  id?: string;
  userId: string;
  twitterAccountId?: string; // Optional: if set, settings apply to specific account only
  enabled: boolean;
  postingTimes: string[]; // Array of times like ["09:00", "13:00", "17:00"]
  timezone: string;
  minInterval: number; // Minimum minutes between posts
  maxPostsPerDay: number;
  skipWeekends: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Notification {
  id?: string;
  userId: string;
  type: 'tweet_posted' | 'tweet_failed' | 'tweet_scheduled' | 'tweet_deleted' | 'tweet_rescheduled';
  message: string;
  tweetId?: string;
  status: 'unread' | 'read';
  createdAt: Date;
  readAt?: Date;
  extra?: Record<string, any>;
}

export interface TwitterApp {
  id?: string;
  name: string;
  clientId: string;           // OAuth 2.0
  clientSecret: string;       // OAuth 2.0
  consumerKey: string;        // OAuth 1.0a (same as clientId for most apps)
  consumerSecret: string;     // OAuth 1.0a (same as clientSecret for most apps)
  accessToken: string;        // OAuth 1.0a access token
  accessTokenSecret: string;  // OAuth 1.0a access token secret
  callbackUrl: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface AdminUser {
  id?: string;
  username: string;
  passwordHash: string;
  displayName?: string;
  email?: string;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================================================
// Settings Interfaces
// ============================================================================

/** Resend email settings */
export interface ResendSettings {
  id?: string;
  userId: string;
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** OpenRouter AI settings */
export interface OpenRouterSettings {
  id?: string;
  userId: string;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Session data structure */
export interface SessionData {
  user?: {
    id: string;
    name?: string;
    email?: string;
    image?: string;
  };
  [key: string]: unknown;
}