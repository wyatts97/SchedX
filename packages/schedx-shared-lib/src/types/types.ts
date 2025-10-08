export enum TweetStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
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
  twitterTweetId?: string;
  twitterAccountId?: string;
  recurrenceType?: 'daily' | 'weekly' | 'monthly' | null;
  recurrenceInterval?: number | null;
  recurrenceEndDate?: Date | null;
  templateName?: string;
  templateCategory?: string;
  media?: { url: string; type: 'photo' | 'gif' | 'video' }[];
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