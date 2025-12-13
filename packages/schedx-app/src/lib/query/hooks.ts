/**
 * TanStack Query Hooks
 * Reusable query hooks for common data fetching operations
 * 
 * Usage: Call these hooks in Svelte components, access results via query.data, query.isLoading, etc.
 * The options must be wrapped in a function to preserve Svelte reactivity.
 */

import { createQuery, createMutation, type CreateQueryResult, type CreateMutationResult } from '@tanstack/svelte-query';
import { queryKeys, invalidateQueries } from './queryClient';

// API fetch helper with error handling
async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		credentials: 'same-origin',
		...options,
	});
	
	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: response.statusText }));
		throw new Error(error.error || `HTTP ${response.status}`);
	}
	
	return response.json();
}

// Dashboard queries
export function useDashboardQuery() {
	return createQuery(() => ({
		queryKey: queryKeys.dashboard,
		queryFn: () => fetchApi<any>('/api/dashboard'),
		staleTime: 60 * 1000,
	}));
}

// Account queries
export function useAccountsQuery() {
	return createQuery(() => ({
		queryKey: queryKeys.accounts,
		queryFn: () => fetchApi<{ accounts: any[] }>('/api/accounts'),
		staleTime: 5 * 60 * 1000,
	}));
}

export function useAccountStatsQuery() {
	return createQuery(() => ({
		queryKey: queryKeys.accountStats,
		queryFn: () => fetchApi<any>('/api/analytics/account-stats'),
		staleTime: 60 * 1000,
	}));
}

// Tweet queries
export function useQueuedTweetsQuery(accountId?: string) {
	return createQuery(() => ({
		queryKey: accountId ? [...queryKeys.queuedTweets, accountId] : queryKeys.queuedTweets,
		queryFn: () => {
			const url = accountId && accountId !== 'all' 
				? `/api/queue?accountId=${accountId}` 
				: '/api/queue';
			return fetchApi<{ tweets: any[] }>(url);
		},
	}));
}

export function useScheduledTweetsQuery() {
	return createQuery(() => ({
		queryKey: queryKeys.scheduledTweets,
		queryFn: () => fetchApi<{ tweets: any[] }>('/api/tweets?status=scheduled'),
	}));
}

// Media queries
export function useMediaQuery(accountId?: string) {
	return createQuery(() => ({
		queryKey: accountId ? queryKeys.mediaByAccount(accountId) : queryKeys.media,
		queryFn: () => {
			const url = accountId && accountId !== 'all'
				? `/api/media?accountId=${accountId}`
				: '/api/media';
			return fetchApi<{ media: any[] }>(url);
		},
		staleTime: 2 * 60 * 1000,
	}));
}

// Queue settings query
export function useQueueSettingsQuery() {
	return createQuery(() => ({
		queryKey: queryKeys.queueSettings,
		queryFn: () => fetchApi<any>('/api/queue/settings'),
		staleTime: 5 * 60 * 1000,
	}));
}

// Mutations
export function useDeleteTweetMutation() {
	return createMutation(() => ({
		mutationFn: (tweetId: string) => 
			fetchApi(`/api/tweets/${tweetId}`, { method: 'DELETE' }),
		onSuccess: () => {
			invalidateQueries.tweets();
			invalidateQueries.queue();
		},
	}));
}

export function useShuffleQueueMutation() {
	return createMutation(() => ({
		mutationFn: (accountId?: string) => 
			fetchApi('/api/queue/shuffle', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ twitterAccountId: accountId }),
			}),
		onSuccess: () => {
			invalidateQueries.queue();
		},
	}));
}

export function useReorderQueueMutation() {
	return createMutation(() => ({
		mutationFn: (tweetIds: string[]) => 
			fetchApi('/api/queue/reorder', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tweetIds }),
			}),
		onError: () => {
			invalidateQueries.queue();
		},
	}));
}

export function useProcessQueueMutation() {
	return createMutation(() => ({
		mutationFn: () => 
			fetchApi('/api/queue/process', { method: 'POST' }),
		onSuccess: () => {
			invalidateQueries.queue();
			invalidateQueries.tweets();
		},
	}));
}

export function useUploadMediaMutation() {
	return createMutation(() => ({
		mutationFn: async ({ file, accountId }: { file: File; accountId?: string }) => {
			const formData = new FormData();
			formData.append('file', file);
			if (accountId) formData.append('accountId', accountId);
			
			return fetchApi<{ url: string; type: string }>('/api/media/upload', {
				method: 'POST',
				body: formData,
			});
		},
		onSuccess: () => {
			invalidateQueries.media();
		},
	}));
}

export function useDeleteMediaMutation() {
	return createMutation(() => ({
		mutationFn: (mediaId: string) => 
			fetchApi(`/api/media/${mediaId}`, { method: 'DELETE' }),
		onSuccess: () => {
			invalidateQueries.media();
		},
	}));
}

export function useSyncEngagementMutation() {
	return createMutation(() => ({
		mutationFn: () => 
			fetchApi('/api/analytics/sync-engagement', { method: 'POST' }),
		onSuccess: () => {
			invalidateQueries.analytics();
			invalidateQueries.dashboard();
			invalidateQueries.accounts();
		},
	}));
}
