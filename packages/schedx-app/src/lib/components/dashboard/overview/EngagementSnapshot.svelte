<!--
  @component EngagementSnapshot
  
  Displays engagement metrics with trend comparison.
  Shows current vs previous engagement rate, most engaged post, and top account.
  
  @prop {EngagementSnapshotData} snapshot - Engagement data from API
  
  @example
  <EngagementSnapshot {snapshot} />
-->

<script lang="ts">
	import { TrendingUp, TrendingDown, Minus, Heart, Award, User } from 'lucide-svelte';
	import type { EngagementSnapshotData } from '$lib/types/analytics';

	export let snapshot: EngagementSnapshotData;

	// Determine trend icon and color
	$: trendIcon = snapshot.trend === 'up' ? TrendingUp : snapshot.trend === 'down' ? TrendingDown : Minus;
	$: trendColor =
		snapshot.trend === 'up'
			? 'text-green-600 dark:text-green-400'
			: snapshot.trend === 'down'
				? 'text-red-600 dark:text-red-400'
				: 'text-gray-600 dark:text-gray-400';
	$: trendBg =
		snapshot.trend === 'up'
			? 'bg-green-50 dark:bg-green-900/20'
			: snapshot.trend === 'down'
				? 'bg-red-50 dark:bg-red-900/20'
				: 'bg-gray-50 dark:bg-gray-800';
</script>

<div class="mb-6">
	<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Engagement Overview</h2>

	<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
		<!-- Current Engagement Rate Card -->
		<div
			class="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"
					>
						<Heart class="h-5 w-5 text-blue-600 dark:text-blue-400" />
					</div>
					<h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">
						Engagement Rate
					</h3>
				</div>
			</div>

			<div class="flex items-end justify-between">
				<div>
					<p class="text-3xl font-bold text-gray-900 dark:text-white">
						{snapshot.currentEngagementRate.toFixed(2)}%
					</p>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						vs {snapshot.previousEngagementRate.toFixed(2)}% previous period
					</p>
				</div>

				<!-- Trend Indicator -->
				<div class="flex items-center gap-1 rounded-lg px-2 py-1 {trendBg}">
					<svelte:component this={trendIcon} class="h-4 w-4 {trendColor}" />
					<span class="text-sm font-semibold {trendColor}">
						{Math.abs(snapshot.changePercent).toFixed(1)}%
					</span>
				</div>
			</div>
		</div>

		<!-- Most Engaged Post Card -->
		<div
			class="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="mb-3 flex items-center gap-2">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30"
				>
					<Award class="h-5 w-5 text-purple-600 dark:text-purple-400" />
				</div>
				<h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">
					Most Engaged Post
				</h3>
			</div>

			{#if snapshot.mostEngagedPost}
				<div class="flex-1">
					<p class="mb-2 line-clamp-2 text-sm text-gray-700 dark:text-gray-300">
						{snapshot.mostEngagedPost.content}
					</p>
					<div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
						<span>❤️ {snapshot.mostEngagedPost.likeCount}</span>
						<span>🔁 {snapshot.mostEngagedPost.retweetCount}</span>
						<span>💬 {snapshot.mostEngagedPost.replyCount}</span>
					</div>
					<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
						@{snapshot.mostEngagedPost.accountUsername}
					</p>
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center">
					<p class="text-sm text-gray-500 dark:text-gray-400">No posts yet</p>
				</div>
			{/if}
		</div>

		<!-- Top Performing Account Card -->
		<div
			class="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="mb-3 flex items-center gap-2">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30"
				>
					<User class="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
				</div>
				<h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">
					Top Account
				</h3>
			</div>

			{#if snapshot.topPerformingAccount}
				<div class="flex-1">
					<p class="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
						{snapshot.topPerformingAccount.displayName}
					</p>
					<p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
						@{snapshot.topPerformingAccount.username}
					</p>
					<div class="flex items-center justify-between">
						<span class="text-xs text-gray-500 dark:text-gray-400">Engagement Rate</span>
						<span class="text-lg font-bold text-indigo-600 dark:text-indigo-400">
							{snapshot.topPerformingAccount.engagementRate.toFixed(2)}%
						</span>
					</div>
					<div class="mt-2 flex items-center justify-between">
						<span class="text-xs text-gray-500 dark:text-gray-400">Posts</span>
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
							{snapshot.topPerformingAccount.postsCount}
						</span>
					</div>
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center">
					<p class="text-sm text-gray-500 dark:text-gray-400">No data available</p>
				</div>
			{/if}
		</div>
	</div>
</div>
