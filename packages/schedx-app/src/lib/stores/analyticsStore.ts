/**
 * Analytics Store
 * 
 * Manages analytics data state for the Overview Tab.
 * Handles fetching, caching, and auto-refresh of analytics data.
 */

import { writable, derived } from 'svelte/store';
import type { OverviewAnalytics, DateRange } from '$lib/types/analytics';
import logger from '$lib/logger';

interface AnalyticsState {
	data: OverviewAnalytics | null;
	loading: boolean;
	error: string | null;
	lastUpdated: Date | null;
	dateRange: DateRange;
}

const initialState: AnalyticsState = {
	data: null,
	loading: false,
	error: null,
	lastUpdated: null,
	dateRange: '7d'
};

// Create the writable store
const analyticsStore = writable<AnalyticsState>(initialState);

// Auto-refresh disabled - data only updates at 3AM UTC via cron or manual sync button
let refreshInterval: NodeJS.Timeout | null = null;

/**
 * Fetch analytics data from API
 */
async function fetchAnalytics(dateRange: DateRange = '7d'): Promise<void> {
	analyticsStore.update(state => ({ ...state, loading: true, error: null }));

	try {
		const response = await fetch(`/api/analytics/overview?dateRange=${dateRange}`);
		
		if (!response.ok) {
			throw new Error(`Failed to fetch analytics: ${response.statusText}`);
		}

		const data: OverviewAnalytics = await response.json();

		analyticsStore.update(state => ({
			...state,
			data,
			loading: false,
			error: null,
			lastUpdated: new Date(),
			dateRange
		}));

		logger.info('Analytics data fetched successfully', { dateRange });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to fetch analytics';
		
		analyticsStore.update(state => ({
			...state,
			loading: false,
			error: errorMessage
		}));

		logger.error('Failed to fetch analytics', { error, dateRange });
	}
}

/**
 * Initialize auto-refresh (DISABLED - data only updates at 3AM UTC or via manual sync)
 */
function startAutoRefresh(): void {
	// Auto-refresh disabled - engagement data updates only via:
	// 1. Daily cron at 3AM UTC
	// 2. Manual sync button click
	// This prevents unnecessary API calls and ensures data freshness is controlled
	if (refreshInterval) {
		clearInterval(refreshInterval);
		refreshInterval = null;
	}
}

/**
 * Stop auto-refresh
 */
function stopAutoRefresh(): void {
	if (refreshInterval) {
		clearInterval(refreshInterval);
		refreshInterval = null;
	}
}

/**
 * Change date range and refetch data
 */
function setDateRange(dateRange: DateRange): void {
	fetchAnalytics(dateRange);
}

/**
 * Manual refresh
 */
function refresh(): void {
	analyticsStore.update(state => {
		fetchAnalytics(state.dateRange);
		return state;
	});
}

/**
 * Sync engagement data from Twitter API
 * This uses API calls and should be used sparingly
 */
async function syncEngagement(): Promise<{ success: boolean; message: string }> {
	try {
		const response = await fetch('/api/analytics/sync-engagement', {
			method: 'POST'
		});

		if (!response.ok) {
			throw new Error(`Failed to sync engagement: ${response.statusText}`);
		}

		const result = await response.json();
		
		logger.info('Engagement synced successfully', result);
		
		// Refresh analytics data after sync
		analyticsStore.update(state => {
			fetchAnalytics(state.dateRange);
			return state;
		});

		return {
			success: true,
			message: result.message || 'Engagement data synced successfully'
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to sync engagement';
		logger.error('Failed to sync engagement', { error });
		return {
			success: false,
			message: errorMessage
		};
	}
}

/**
 * Dismiss an insight
 */
async function dismissInsight(insightId: string): Promise<void> {
	try {
		const response = await fetch('/api/analytics/insights', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ insightId })
		});

		if (!response.ok) {
			throw new Error('Failed to dismiss insight');
		}

		// Remove insight from local state
		analyticsStore.update(state => {
			if (state.data) {
				return {
					...state,
					data: {
						...state.data,
						insights: state.data.insights.filter(i => i.id !== insightId)
					}
				};
			}
			return state;
		});

		logger.info('Insight dismissed', { insightId });
	} catch (error) {
		logger.error('Failed to dismiss insight', { error, insightId });
		throw error;
	}
}

// Derived stores for easy access
export const analytics = {
	subscribe: analyticsStore.subscribe,
	fetch: fetchAnalytics,
	refresh,
	syncEngagement,
	setDateRange,
	dismissInsight,
	startAutoRefresh,
	stopAutoRefresh
};

// Derived store for loading state
export const isLoading = derived(analyticsStore, $store => $store.loading);

// Derived store for error state
export const error = derived(analyticsStore, $store => $store.error);

// Derived store for last updated time
export const lastUpdated = derived(analyticsStore, $store => $store.lastUpdated);

// Derived store for current date range
export const currentDateRange = derived(analyticsStore, $store => $store.dateRange);
