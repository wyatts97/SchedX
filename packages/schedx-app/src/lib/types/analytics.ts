/**
 * Analytics Types for Overview Tab
 * 
 * These types correspond to the database schema in migration 002_analytics_tables.sql
 */

// ============================================================================
// Database Models
// ============================================================================

export interface DailyStats {
	id: string;
	accountId: string;
	date: string; // YYYY-MM-DD format
	followers: number;
	following: number;
	totalLikes: number;
	totalReplies: number;
	totalRetweets: number;
	engagementRate: number; // Percentage (0-100)
	topTweetId: string | null;
	postsCount: number;
	createdAt: Date;
}

export interface ContentAnalytics {
	id: string;
	tweetId: string;
	hasImage: boolean;
	hasVideo: boolean;
	hasGif: boolean;
	hasLink: boolean;
	mediaCount: number;
	hashtagCount: number;
	hashtags: string[]; // Parsed from JSON
	mentionCount: number;
	charCount: number;
	postHour: number; // 0-23
	postDay: number; // 0-6 (Sunday=0)
	postTimestamp: Date;
	engagementScore: number;
	createdAt: Date;
}

export interface Insight {
	id: string;
	userId: string;
	insightType: InsightType;
	title: string;
	message: string;
	priority: InsightPriority;
	data: Record<string, any> | null; // JSON metadata
	generatedAt: Date;
	expiresAt: Date;
	dismissed: boolean;
}

export interface EngagementSnapshot {
	id: string;
	tweetId: string;
	snapshotDate: string; // YYYY-MM-DD
	likeCount: number;
	retweetCount: number;
	replyCount: number;
	createdAt: Date;
}

// ============================================================================
// Enums
// ============================================================================

export type InsightType =
	| 'best_time'
	| 'content_type'
	| 'inactive_account'
	| 'top_hashtag'
	| 'engagement_drop'
	| 'follower_milestone';

export type InsightPriority = 0 | 1 | 2; // 0=low, 1=medium, 2=high

export type DateRange = '7d' | '30d' | '90d' | 'all';

export type ContentType = 'text' | 'image' | 'video' | 'gif' | 'link';

// ============================================================================
// API Response Types
// ============================================================================

export interface OverviewAnalytics {
	activitySummary: ActivitySummary;
	engagementSnapshot: EngagementSnapshotData;
	contentMix: ContentMixData;
	trends: TrendData;
	insights: Insight[];
	systemStatus: SystemStatus;
}

export interface ActivitySummary {
	connectedAccounts: number;
	totalPublished: number;
	totalScheduled: number;
	totalFailed: number;
	upcomingIn24h: number;
	upcomingIn7d: number;
	avgPostsPerDay: number;
	lastPostTime: Date | null;
	nextScheduledPost: Date | null;
	queueHealth: QueueHealth;
}

export interface QueueHealth {
	status: 'healthy' | 'warning' | 'critical';
	message: string;
	scheduledThrough: Date | null;
}

export interface EngagementSnapshotData {
	currentEngagementRate: number;
	previousEngagementRate: number;
	changePercent: number;
	trend: 'up' | 'down' | 'stable';
	mostEngagedPost: TopPost | null;
	topPerformingAccount: TopAccount | null;
}

export interface TopPost {
	id: string;
	content: string;
	engagementScore: number;
	likeCount: number;
	retweetCount: number;
	replyCount: number;
	postedAt: Date;
	accountUsername: string;
	accountProfileImage?: string;
}

export interface TopAccount {
	id: string;
	username: string;
	displayName: string;
	engagementRate: number;
	postsCount: number;
}

export interface ContentMixData {
	postTypeDistribution: PostTypeDistribution;
	topHashtags: HashtagFrequency[];
	postingTimeHeatmap: PostingTimeHeatmap;
}

export interface PostTypeDistribution {
	text: number;
	image: number;
	video: number;
	gif: number;
	link: number;
}

export interface HashtagFrequency {
	hashtag: string;
	count: number;
	avgEngagement: number;
}

export interface PostingTimeHeatmap {
	data: number[][]; // 7 days x 24 hours matrix
	maxValue: number;
	bestTime: {
		day: number; // 0-6
		hour: number; // 0-23
		avgEngagement: number;
	};
}

export interface TrendData {
	followerGrowth: AccountFollowerTrend[];
	engagementTrend: TrendPoint[];
	postsPerDay: TrendPoint[];
}

export interface TrendPoint {
	date: string; // YYYY-MM-DD
	value: number;
}

export interface AccountFollowerTrend {
	accountId: string;
	username: string;
	profileImage?: string;
	data: TrendPoint[];
}

export interface SystemStatus {
	accounts: AccountStatus[];
	pendingDrafts: number;
	automationEnabled: boolean;
	lastSyncTime: Date | null;
}

export interface AccountStatus {
	id: string;
	username: string;
	connectionStatus: 'active' | 'expired' | 'error';
	tokenExpiresAt: Date | null;
	lastPostTime: Date | null;
	daysInactive: number;
}

// ============================================================================
// Chart Data Types
// ============================================================================

export interface ChartDataset {
	label: string;
	data: number[];
	backgroundColor?: string | string[];
	borderColor?: string;
	borderWidth?: number;
}

export interface ChartData {
	labels: string[];
	datasets: ChartDataset[];
}

// ============================================================================
// Utility Types
// ============================================================================

export interface DateRangeFilter {
	startDate: string; // YYYY-MM-DD
	endDate: string; // YYYY-MM-DD
}

export interface AnalyticsFilters {
	dateRange: DateRange;
	accountId?: string;
	includeInsights?: boolean;
}

// ============================================================================
// Insight Generation Types
// ============================================================================

export interface InsightGeneratorResult {
	insights: Insight[];
	errors: string[];
}

export interface BestTimeInsightData {
	day: number;
	dayName: string;
	hour: number;
	avgEngagement: number;
	sampleSize: number;
}

export interface ContentTypeInsightData {
	bestType: ContentType;
	engagementMultiplier: number;
	sampleSize: number;
}

export interface InactiveAccountInsightData {
	accountId: string;
	username: string;
	daysSinceLastPost: number;
	lastPostDate: Date | null;
}

export interface TopHashtagInsightData {
	hashtag: string;
	useCount: number;
	avgEngagement: number;
}
