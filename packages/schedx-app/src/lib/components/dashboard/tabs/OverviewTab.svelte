<script lang="ts">
	import { onMount } from 'svelte';
	import { analytics, isLoading, error, lastUpdated, currentDateRange } from '$lib/stores/analyticsStore';
	import ActivitySummary from '../overview/ActivitySummary.svelte';
	import EngagementSnapshot from '../overview/EngagementSnapshot.svelte';
	import SmartInsights from '../overview/SmartInsights.svelte';
	import QuickActions from '../overview/QuickActions.svelte';
	import ContentMixChart from '../overview/ContentMixChart.svelte';
	import PerformanceTrends from '../overview/PerformanceTrends.svelte';
	import { Loader2, Download } from 'lucide-svelte';
	import type { DateRange } from '$lib/types/analytics';
	
	let syncing = false;
	let syncMessage = '';

	// Fetch analytics on mount
	onMount(() => {
		analytics.fetch();
	});

	// No cleanup needed

	// Handle date range change
	function handleDateRangeChange(range: DateRange) {
		analytics.setDateRange(range);
	}


	// Handle engagement sync
	async function handleSyncEngagement() {
		syncing = true;
		syncMessage = '';
		
		const result = await analytics.syncEngagement();
		
		syncing = false;
		syncMessage = result.message;
		
		// Clear message after 5 seconds
		setTimeout(() => {
			syncMessage = '';
		}, 5000);
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

			<!-- Sync Engagement Button -->
			<button
				on:click={handleSyncEngagement}
				disabled={syncing || $isLoading}
				class="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
				title="Sync engagement metrics from Twitter API"
			>
				{#if syncing}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<Download class="h-4 w-4" />
				{/if}
				<span class="hidden sm:inline">Sync Engagement</span>
			</button>
		</div>
	</div>

	<!-- API Warning Message -->
	<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
		<p class="text-xs text-amber-800 dark:text-amber-200">
			<strong>⚠️ Rate Limit Warning:</strong> Syncing engagement data uses Twitter API calls. 
			Use sparingly to avoid exceeding your rate limits. The system automatically syncs once daily at 3 AM.
		</p>
		{#if syncMessage}
			<p class="mt-1 text-xs font-medium text-amber-900 dark:text-amber-100">
				{syncMessage}
			</p>
		{/if}
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
