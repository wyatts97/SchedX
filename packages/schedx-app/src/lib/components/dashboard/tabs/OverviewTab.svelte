<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { analytics, isLoading, error, lastUpdated, currentDateRange } from '$lib/stores/analyticsStore';
	import ActivitySummary from '../overview/ActivitySummary.svelte';
	import EngagementSnapshot from '../overview/EngagementSnapshot.svelte';
	import SmartInsights from '../overview/SmartInsights.svelte';
	import QuickActions from '../overview/QuickActions.svelte';
	import ContentMixChart from '../overview/ContentMixChart.svelte';
	import PerformanceTrends from '../overview/PerformanceTrends.svelte';
	import { RefreshCw, Loader2 } from 'lucide-svelte';
	import type { DateRange } from '$lib/types/analytics';

	// Fetch analytics on mount
	onMount(() => {
		analytics.fetch();
		analytics.startAutoRefresh();
	});

	// Cleanup on destroy
	onDestroy(() => {
		analytics.stopAutoRefresh();
	});

	// Handle date range change
	function handleDateRangeChange(range: DateRange) {
		analytics.setDateRange(range);
	}

	// Handle manual refresh
	function handleRefresh() {
		analytics.refresh();
	}

	// Format last updated time
	$: lastUpdatedText = $lastUpdated
		? `Last updated ${new Date($lastUpdated).toLocaleTimeString()}`
		: 'Never updated';

	// Handle insight dismissal
	async function handleDismissInsight(insightId: string) {
		await analytics.dismissInsight(insightId);
	}
</script>

<div class="space-y-6">
	<!-- Header with Date Range Selector and Refresh -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Overview</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{lastUpdatedText}</p>
		</div>

		<div class="flex items-center gap-3">
			<!-- Date Range Selector -->
			<select
				value={$currentDateRange}
				on:change={(e) => handleDateRangeChange(e.currentTarget.value as DateRange)}
				class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
			>
				<option value="7d">Last 7 days</option>
				<option value="30d">Last 30 days</option>
				<option value="90d">Last 90 days</option>
			</select>

			<!-- Refresh Button -->
			<button
				on:click={handleRefresh}
				disabled={$isLoading}
				class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				title="Refresh analytics"
			>
				{#if $isLoading}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<RefreshCw class="h-4 w-4" />
				{/if}
				<span class="hidden sm:inline">Refresh</span>
			</button>
		</div>
	</div>

	<!-- Error State -->
	{#if $error}
		<div
			class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
		>
			<p class="text-sm text-red-800 dark:text-red-200">
				{$error}
			</p>
		</div>
	{/if}

	<!-- Loading State -->
	{#if $isLoading && !$analytics.data}
		<div class="flex items-center justify-center py-12">
			<div class="flex flex-col items-center gap-3">
				<Loader2 class="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
				<p class="text-sm text-gray-600 dark:text-gray-400">Loading analytics...</p>
			</div>
		</div>
	{:else if $analytics.data}
		<!-- Activity Summary -->
		<ActivitySummary summary={$analytics.data.activitySummary} />

		<!-- Engagement Snapshot -->
		<EngagementSnapshot snapshot={$analytics.data.engagementSnapshot} />

		<!-- Quick Actions -->
		<QuickActions />

		<!-- Smart Insights -->
		<SmartInsights insights={$analytics.data.insights} onDismiss={handleDismissInsight} />

		<!-- Performance Trends -->
		<PerformanceTrends trends={$analytics.data.trends} />

		<!-- Content Mix Charts -->
		<ContentMixChart contentMix={$analytics.data.contentMix} />
	{:else}
		<!-- Empty State -->
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800/50">
			<p class="text-sm text-gray-600 dark:text-gray-400">
				No analytics data available. Click refresh to load.
			</p>
		</div>
	{/if}
</div>
