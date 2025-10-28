// Import and re-export shared types
import type {
	TwitterApp,
	Tweet,
	UserAccount,
	AdminUser,
	Notification,
	TweetStatus
} from '@schedx/shared-lib/types/types';
export type {
	TwitterApp,
	Tweet,
	UserAccount,
	AdminUser,
	Notification,
	TweetStatus
} from '@schedx/shared-lib/types/types';

// App-specific types
export interface DashboardAnalytics {
	totalTweets: number;
	scheduledTweets: number;
	postedTweets: number;
	failedTweets: number;
	draftTweets: number;
	totalAccounts: number;
	activeApps: number;
	recentActivity: ActivityItem[];
}

export interface ActivityItem {
	id: string;
	type: 'tweet_posted' | 'tweet_scheduled' | 'tweet_failed' | 'app_created' | 'account_connected';
	message: string;
	timestamp: Date;
	metadata?: Record<string, any>;
}

export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
		hasNext: boolean;
		hasPrev: boolean;
	};
}

export interface LoadingState {
	isLoading: boolean;
	error: string | null;
	lastUpdated?: Date;
}

export interface FormState<T = any> {
	data: T;
	errors: Record<string, string>;
	isSubmitting: boolean;
	isDirty: boolean;
}

export interface ComponentProps {
	class?: string;
	'data-testid'?: string;
}

// Database connection optimization types
export interface ConnectionPoolConfig {
	maxPoolSize: number;
	minPoolSize: number;
	maxIdleTimeMS: number;
	waitQueueTimeoutMS: number;
}

export interface QueryOptions {
	timeout?: number;
	retries?: number;
	cache?: boolean;
	cacheTTL?: number;
}

// Enhanced error types
export interface AppError extends Error {
	code?: string;
	statusCode?: number;
	context?: Record<string, any>;
	timestamp?: Date;
	userId?: string;
}

export interface ValidationError {
	field: string;
	message: string;
	code: string;
}

// Component-specific types
export interface TableColumn<T = any> {
	key: keyof T;
	label: string;
	sortable?: boolean;
	width?: string;
	align?: 'left' | 'center' | 'right';
	render?: (value: any, row: T) => string;
}

export interface TableAction<T = any> {
	label: string;
	icon?: any;
	variant?: 'primary' | 'secondary' | 'danger';
	disabled?: (row: T) => boolean;
	onClick: (row: T) => void | Promise<void>;
}

export interface ModalProps extends ComponentProps {
	isOpen: boolean;
	title?: string;
	size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
	closable?: boolean;
	onClose?: () => void;
}

export interface ButtonProps extends ComponentProps {
	variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
	size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
	disabled?: boolean;
	loading?: boolean;
	type?: 'button' | 'submit' | 'reset';
	href?: string;
	target?: string;
}

// Store types
export interface StoreState<T = any> extends LoadingState {
	data: T;
}

export interface DashboardState extends StoreState {
	data: {
		apps: TwitterApp[];
		analytics: DashboardAnalytics;
		tweets: Tweet[];
		accounts: UserAccount[];
	};
	ui: {
		showAppForm: boolean;
		editingApp: TwitterApp | null;
		selectedTab: string;
		filters: Record<string, any>;
	};
}

// API types
export interface ApiEndpoints {
	readonly TWITTER_APPS: string;
	readonly TWITTER_APP_BY_ID: (id: string) => string;
	readonly TEST_TWITTER_APP_CONNECTION: string;
	readonly ADMIN_ANALYTICS: string;
	readonly ADMIN_TWEETS: string;
	readonly ACCOUNTS: string;
	readonly DRAFTS: string;
	readonly TEMPLATES: string;
	readonly NOTIFICATIONS: string;
}

// Configuration types
export interface AppConfig {
	api: {
		baseUrl: string;
		timeout: number;
		retries: number;
	};
	database: {
		connectionString: string;
		poolConfig: ConnectionPoolConfig;
	};
	cache: {
		defaultTTL: number;
		maxSize: number;
	};
	logging: {
		level: 'debug' | 'info' | 'warn' | 'error';
		enableConsole: boolean;
		enableFile: boolean;
	};
}

// Utility types
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type EventHandler<T = Event> = (event: T) => void | Promise<void>;

export type AsyncFunction<T = any, R = any> = (...args: T[]) => Promise<R>;
