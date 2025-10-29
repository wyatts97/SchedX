<!--
  @component PerformanceTrends
  
  Displays performance trends using ApexCharts sparklines and line charts.
  Shows follower growth, engagement trends, and posting frequency.
  
  @prop {TrendData} trends - Trend data from API
  
  @example
  <PerformanceTrends {trends} />
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { TrendData } from '$lib/types/analytics';
	import { TrendingUp, Heart, Calendar } from 'lucide-svelte';

	export let trends: TrendData;

	let followerChartEl: HTMLElement;
	let engagementChartEl: HTMLElement;
	let postsChartEl: HTMLElement;
	let followerChart: any;
	let engagementChart: any;
	let postsChart: any;

	// Calculate trend direction
	function getTrendDirection(data: { value: number }[]): 'up' | 'down' | 'stable' {
		if (data.length < 2) return 'stable';
		const first = data[0].value;
		const last = data[data.length - 1].value;
		const change = ((last - first) / first) * 100;
		if (change > 5) return 'up';
		if (change < -5) return 'down';
		return 'stable';
	}

	$: followerTrend = getTrendDirection(trends.followerGrowth);
	$: engagementTrend = getTrendDirection(trends.engagementTrend);
	$: postsTrend = getTrendDirection(trends.postsPerDay);

	onMount(() => {
		if (!browser) return;

		let observer: MutationObserver;

		// Use IIFE to handle async import
		(async () => {
			const ApexCharts = (await import('apexcharts')).default;
			const isDark = document.documentElement.classList.contains('dark');

			// Common sparkline options
			const sparklineOptions = {
			chart: {
				type: 'area',
				height: 80,
				sparkline: { enabled: true },
				fontFamily: 'Inter, ui-sans-serif'
			},
			stroke: { curve: 'smooth', width: 2 },
			fill: {
				type: 'gradient',
				gradient: {
					shadeIntensity: 1,
					opacityFrom: 0.4,
					opacityTo: 0.1,
					stops: [0, 90, 100]
				}
			},
			tooltip: {
				enabled: true,
				x: { show: false },
				y: {
					title: {
						formatter: function () {
							return '';
						}
					}
				}
			},
			theme: { mode: isDark ? 'dark' : 'light' }
		};

			// Follower Growth Sparkline
			followerChart = new ApexCharts(followerChartEl, {
			...sparklineOptions,
			series: [
				{
					name: 'Followers',
					data: trends.followerGrowth.map(t => t.value)
				}
			],
			colors: ['#8b5cf6']
		});
			followerChart.render();

			// Engagement Trend Sparkline
			engagementChart = new ApexCharts(engagementChartEl, {
			...sparklineOptions,
			series: [
				{
					name: 'Engagement Rate',
					data: trends.engagementTrend.map(t => t.value)
				}
			],
			colors: ['#ec4899']
		});
			engagementChart.render();

			// Posts Per Day Sparkline
			postsChart = new ApexCharts(postsChartEl, {
			...sparklineOptions,
			series: [
				{
					name: 'Posts',
					data: trends.postsPerDay.map(t => t.value)
				}
			],
			colors: ['#3b82f6']
		});
			postsChart.render();

			// Listen for theme changes
			observer = new MutationObserver(() => {
			const isDark = document.documentElement.classList.contains('dark');
			const themeUpdate = { theme: { mode: isDark ? 'dark' : 'light' } };
			if (followerChart) followerChart.updateOptions(themeUpdate);
			if (engagementChart) engagementChart.updateOptions(themeUpdate);
			if (postsChart) postsChart.updateOptions(themeUpdate);
		});

			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['class']
			});
		})(); // Close IIFE

		// Return cleanup function synchronously
		return () => {
			if (observer) observer.disconnect();
			if (followerChart) followerChart.destroy();
			if (engagementChart) engagementChart.destroy();
			if (postsChart) postsChart.destroy();
		};
	});

	function getTrendIcon(trend: 'up' | 'down' | 'stable') {
		return trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';
	}

	function getTrendColor(trend: 'up' | 'down' | 'stable') {
		return trend === 'up'
			? 'text-green-600 dark:text-green-400'
			: trend === 'down'
				? 'text-red-600 dark:text-red-400'
				: 'text-gray-600 dark:text-gray-400';
	}
</script>

<div class="mb-6">
	<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Performance Trends</h2>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
		<!-- Follower Growth -->
		<div
			class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="mb-3 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30"
					>
						<TrendingUp class="h-4 w-4 text-purple-600 dark:text-purple-400" />
					</div>
					<h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Follower Growth
					</h3>
				</div>
				<span class="text-lg {getTrendColor(followerTrend)}">
					{getTrendIcon(followerTrend)}
				</span>
			</div>
			<div bind:this={followerChartEl}></div>
			{#if trends.followerGrowth.length > 0}
				<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
					Current: {trends.followerGrowth[trends.followerGrowth.length - 1]?.value.toLocaleString() || 0}
				</p>
			{/if}
		</div>

		<!-- Engagement Trend -->
		<div
			class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="mb-3 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-900/30"
					>
						<Heart class="h-4 w-4 text-pink-600 dark:text-pink-400" />
					</div>
					<h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Engagement Rate
					</h3>
				</div>
				<span class="text-lg {getTrendColor(engagementTrend)}">
					{getTrendIcon(engagementTrend)}
				</span>
			</div>
			<div bind:this={engagementChartEl}></div>
			{#if trends.engagementTrend.length > 0}
				<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
					Current: {trends.engagementTrend[trends.engagementTrend.length - 1]?.value.toFixed(2) || 0}%
				</p>
			{/if}
		</div>

		<!-- Posts Per Day -->
		<div
			class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="mb-3 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"
					>
						<Calendar class="h-4 w-4 text-blue-600 dark:text-blue-400" />
					</div>
					<h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Posts Per Day
					</h3>
				</div>
				<span class="text-lg {getTrendColor(postsTrend)}">
					{getTrendIcon(postsTrend)}
				</span>
			</div>
			<div bind:this={postsChartEl}></div>
			{#if trends.postsPerDay.length > 0}
				<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
					Today: {trends.postsPerDay[trends.postsPerDay.length - 1]?.value || 0} posts
				</p>
			{/if}
		</div>
	</div>
</div>
