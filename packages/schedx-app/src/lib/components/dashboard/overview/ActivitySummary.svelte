<!--
  @component ActivitySummary
  
  Displays high-level activity metrics for the dashboard overview.
  Uses Preline UI card components with animated counters.
  
  @prop {ActivitySummary} summary - Activity summary data from API
  
  @example
  <ActivitySummary {summary} />
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import { CheckCircle, Calendar, XCircle, Users, TrendingUp, Clock } from 'lucide-svelte';
	import type { ActivitySummary as ActivitySummaryType } from '$lib/types/analytics';

	export let summary: ActivitySummaryType;

	// Animated counter state
	let animatedPublished = 0;
	let animatedScheduled = 0;
	let animatedFailed = 0;
	let animatedAccounts = 0;

	/**
	 * Animates a counter from 0 to target value
	 */
	function animateCounter(target: number, setter: (val: number) => void, duration = 1000) {
		const start = 0;
		const increment = target / (duration / 16); // 60fps
		let current = start;

		const timer = setInterval(() => {
			current += increment;
			if (current >= target) {
				setter(target);
				clearInterval(timer);
			} else {
				setter(Math.floor(current));
			}
		}, 16);
	}

	// Animate counters when summary changes
	$: if (summary) {
		animateCounter(summary.totalPublished ?? 0, (val) => (animatedPublished = val));
		animateCounter(summary.totalScheduled ?? 0, (val) => (animatedScheduled = val));
		animateCounter(summary.totalFailed ?? 0, (val) => (animatedFailed = val));
		animateCounter(summary.connectedAccounts ?? 0, (val) => (animatedAccounts = val));
	}

	// Format queue health status color
	$: queueStatusColor =
		summary?.queueHealth?.status === 'healthy'
			? 'text-green-600 dark:text-green-400'
			: summary?.queueHealth?.status === 'warning'
				? 'text-yellow-600 dark:text-yellow-400'
				: 'text-red-600 dark:text-red-400';

	$: queueBgColor =
		summary?.queueHealth?.status === 'healthy'
			? 'bg-green-50 dark:bg-green-900/20'
			: summary?.queueHealth?.status === 'warning'
				? 'bg-yellow-50 dark:bg-yellow-900/20'
				: 'bg-red-50 dark:bg-red-900/20';
</script>

<!-- Activity Summary Cards Grid -->
<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<!-- Published Tweets Card -->
	<div
		class="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="flex items-center gap-x-4">
			<div
				class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30"
			>
				<CheckCircle class="h-6 w-6 text-green-600 dark:text-green-400" />
			</div>
			<div class="flex-1">
				<h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Published</h3>
				<p class="text-2xl font-semibold text-gray-900 dark:text-white">
					{animatedPublished}
				</p>
			</div>
		</div>
	</div>

	<!-- Scheduled Tweets Card -->
	<div
		class="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="flex items-center gap-x-4">
			<div
				class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"
			>
				<Calendar class="h-6 w-6 text-blue-600 dark:text-blue-400" />
			</div>
			<div class="flex-1">
				<h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Scheduled</h3>
				<p class="text-2xl font-semibold text-gray-900 dark:text-white">
					{animatedScheduled}
				</p>
			</div>
		</div>
		{#if summary.upcomingIn24h > 0}
			<div class="mt-3 text-xs text-gray-600 dark:text-gray-400">
				{summary.upcomingIn24h} in next 24h • {summary.upcomingIn7d} in next 7d
			</div>
		{/if}
	</div>

	<!-- Failed Tweets Card -->
	<div
		class="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="flex items-center gap-x-4">
			<div
				class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30"
			>
				<XCircle class="h-6 w-6 text-red-600 dark:text-red-400" />
			</div>
			<div class="flex-1">
				<h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Failed</h3>
				<p class="text-2xl font-semibold text-gray-900 dark:text-white">
					{animatedFailed}
				</p>
			</div>
		</div>
	</div>

	<!-- Connected Accounts Card -->
	<div
		class="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="flex items-center gap-x-4">
			<div
				class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30"
			>
				<Users class="h-6 w-6 text-purple-600 dark:text-purple-400" />
			</div>
			<div class="flex-1">
				<h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Accounts</h3>
				<p class="text-2xl font-semibold text-gray-900 dark:text-white">
					{animatedAccounts}
				</p>
			</div>
		</div>
	</div>
</div>

<!-- Additional Metrics Row -->
<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
	<!-- Average Posting Frequency -->
	<div
		class="flex items-center gap-x-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
	>
		<div
			class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30"
		>
			<TrendingUp class="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
		</div>
		<div>
			<p class="text-xs font-medium text-gray-500 dark:text-gray-400">Avg Posts/Day</p>
			<p class="text-lg font-semibold text-gray-900 dark:text-white">
				{(summary?.avgPostsPerDay ?? 0).toFixed(1)}
			</p>
		</div>
	</div>

	<!-- Last Post Time -->
	<div
		class="flex items-center gap-x-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
	>
		<div
			class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700"
		>
			<Clock class="h-5 w-5 text-gray-600 dark:text-gray-400" />
		</div>
		<div>
			<p class="text-xs font-medium text-gray-500 dark:text-gray-400">Last Post</p>
			<p class="text-sm font-medium text-gray-900 dark:text-white">
				{#if summary.lastPostTime}
					{new Date(summary.lastPostTime).toLocaleDateString()}
				{:else}
					Never
				{/if}
			</p>
		</div>
	</div>

	<!-- Queue Health -->
	<div
		class="flex items-center gap-x-4 rounded-xl border border-gray-200 p-4 shadow-sm {queueBgColor} dark:border-gray-700"
	>
		<div class="flex-1">
			<p class="text-xs font-medium {queueStatusColor}">Queue Status</p>
			<p class="text-sm font-semibold text-gray-900 dark:text-white">
				{summary?.queueHealth?.message ?? 'Unknown'}
			</p>
		</div>
	</div>
</div>
