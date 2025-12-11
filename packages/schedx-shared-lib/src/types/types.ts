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
  // Thread support
  isThread?: boolean; // Whether this is part of a thread
  threadId?: string; // ID of the parent thread
  threadPosition?: number; // Position in thread (1, 2, 3, etc.)
  threadTotal?: number; // Total tweets in thread
}

export interface Thread {
  id?: string;
  userId: string;
  title?: string; // Optional thread title for organization
  twitterAccountId: string;
  scheduledDate: Date;
  status: TweetStatus;
  tweets: ThreadTweet[]; // Array of tweets in the thread
  createdAt: Date;
  updatedAt?: Date;
  twitterThreadId?: string; // ID of first tweet in posted thread
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