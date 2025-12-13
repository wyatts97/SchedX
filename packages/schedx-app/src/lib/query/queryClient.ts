/**
 * TanStack Query Client Configuration
 * Provides smart caching, background refetching, and optimistic updates
 */

import { QueryClient } from '@tanstack/svelte-query';

// Create a singleton QueryClient with optimized defaults
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Keep data fresh for 30 seconds
			staleTime: 30 * 1000,
			// Cache data for 5 minutes
			gcTime: 5 * 60 * 1000,
			// Retry failed requests up to 2 times
			retry: 2,
			// Refetch on window focus (good for dashboards)
			refetchOnWindowFocus: true,
			// Don't refetch on reconnect by default
			refetchOnReconnect: false,
		},
		mutations: {
			// Retry mutations once
			retry: 1,
		},
	},
});

// Query keys for consistent caching
export const queryKeys = {
	// Dashboard
	dashboard: ['dashboard'] as const,
	dashboardStats: ['dashboard', 'stats'] as const,
	
	// Tweets
	tweets: ['tweets'] as const,
	tweetById: (id: string) => ['tweets', id] as const,
	scheduledTweets: ['tweets', 'scheduled'] as const,
	publishedTweets: ['tweets', 'published'] as const,
	draftTweets: ['tweets', 'drafts'] as const,
	queuedTweets: ['tweets', 'queued'] as const,
	
	// Accounts
	accounts: ['accounts'] as const,
	accountById: (id: string) => ['accounts', id] as const,
	accountStats: ['accounts', 'stats'] as const,
	
	// Analytics
	analytics: ['analytics'] as const,
	analyticsOverview: ['analytics', 'overview'] as const,
	
	// Media
	media: ['media'] as const,
	mediaByAccount: (accountId: string) => ['media', accountId] as const,
	
	// Queue
	queue: ['queue'] as const,
	queueSettings: ['queue', 'settings'] as const,
};

// Invalidation helpers
export const invalidateQueries = {
	dashboard: () => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
	tweets: () => queryClient.invalidateQueries({ queryKey: queryKeys.tweets }),
	accounts: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
	analytics: () => queryClient.invalidateQueries({ queryKey: queryKeys.analytics }),
	media: () => queryClient.invalidateQueries({ queryKey: queryKeys.media }),
	queue: () => queryClient.invalidateQueries({ queryKey: queryKeys.queue }),
	all: () => queryClient.invalidateQueries(),
};
