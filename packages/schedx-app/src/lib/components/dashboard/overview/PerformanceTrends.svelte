<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { TrendData } from '$lib/types/analytics';
	import { TrendingUp } from 'lucide-svelte';

	export let trends: TrendData;

	let followerChartEl: HTMLElement;
	let followerChart: any;
	
	// Track observer and mounted state for proper cleanup
	let observer: MutationObserver | null = null;
	let isMounted = true;

	// Calculate percent change for each account
	function calculatePercentChange(data: { value: number }[]): number {
		if (!data || data.length < 2) return 0;
		const first = data[0]?.value ?? 0;
		const last = data[data.length - 1]?.value ?? 0;
		if (first === 0) return 0;
		return ((last - first) / first) * 100;
	}

	// Calculate trend direction
	function getTrendDirection(data: { value: number }[]): 'up' | 'down' | 'stable' {
		if (!data || data.length < 2) return 'stable';
		const first = data[0]?.value ?? 0;
		const last = data[data.length - 1]?.value ?? 0;
		if (first === 0) return 'stable';
		const change = ((last - first) / first) * 100;
		if (change > 5) return 'up';
		if (change < -5) return 'down';
		return 'stable';
	}

	// Removed engagement and posts trends

	onMount(() => {
		if (!browser) return;
		
		isMounted = true;

		// Use IIFE to handle async import
		(async () => {
			const ApexCharts = (await import('apexcharts')).default;
			const { HSTooltip } = await import('preline/preline');
			const isDark = document.documentElement.classList.contains('dark');

			// Common sparkline options
			const sparklineOptions = {
			chart: {
				type: 'area',
				height: 80,
				sparkline: { enabled: true },
				fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif'
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

			// Follower Growth - Multi-line chart for each account
			const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
			
			// Only render chart if we have data
			if (trends.followerGrowth && trends.followerGrowth.length > 0) {
				const followerSeries = trends.followerGrowth
					.filter(account => account.data && account.data.length > 0)
					.map((account) => ({
						name: `@${account.username}`,
						data: account.data.map(d => ({ x: d.date, y: d.value }))
					}));

				if (followerSeries.length === 0) {
					// Show empty state
					followerChartEl.innerHTML = '<div class="flex h-[240px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">No follower data available for this period</div>';
				} else {
					followerChart = new ApexCharts(followerChartEl, {
				chart: {
					type: 'line',
					height: 240,
					fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
					toolbar: { show: false },
					zoom: { enabled: false }
				},
				series: followerSeries,
				colors: colors.slice(0, followerSeries.length),
				stroke: {
					curve: 'smooth',
					width: 2
				},
				xaxis: {
					type: 'datetime',
					labels: {
						show: true,
						style: { fontSize: '10px' }
					}
				},
				yaxis: {
					forceNiceScale: true,
					labels: {
						show: true,
						style: { fontSize: '10px' },
						formatter: (val: number) => {
							if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
							if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
							return Math.round(val).toString();
						}
					}
				},
				legend: {
					show: false
				},
				grid: {
					show: true,
					strokeDashArray: 3,
					borderColor: isDark ? '#374151' : '#e5e7eb',
					padding: {
						right: 40
					}
				},
				tooltip: {
					enabled: true,
					x: { format: 'MMM dd' },
					y: {
						formatter: (val: number) => val.toLocaleString() + ' followers'
					}
				},
					theme: { mode: isDark ? 'dark' : 'light' }
				});
				followerChart.render();
				
				// Initialize Preline tooltips
				setTimeout(() => {
					HSTooltip.autoInit();
				}, 100);
			}
		} else {
			// Show empty state when no accounts
			followerChartEl.innerHTML = '<div class="flex h-[240px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">Connect a Twitter account to see follower growth</div>';
		}

			// Listen for theme changes - only if still mounted
			if (!isMounted) return;
			
			observer = new MutationObserver(() => {
				if (!isMounted) return;
				const isDark = document.documentElement.classList.contains('dark');
				const themeUpdate = { theme: { mode: isDark ? 'dark' : 'light' } };
				if (followerChart) followerChart.updateOptions(themeUpdate);
			});

			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['class']
			});
		})(); // Close IIFE

		// Return cleanup function synchronously
		return () => {
			isMounted = false;
			if (observer) {
				observer.disconnect();
				observer = null;
			}
			if (followerChart) {
				followerChart.destroy();
				followerChart = null;
			}
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

	<!-- Follower Growth - Full Width -->
	<div
		class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
	>
			<div class="mb-3 flex items-center">
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
			</div>
			<div class="relative">
				<div bind:this={followerChartEl} class="follower-chart-container"></div>
				<!-- Avatars positioned at end of lines -->
				{#if trends.followerGrowth && trends.followerGrowth.length > 0 && trends.followerGrowth.some(a => a.data && a.data.length > 0)}
					<div class="absolute right-0 top-0 flex h-full flex-col justify-around pr-2">
						{#each trends.followerGrowth.filter(a => a.data && a.data.length > 0) as account, i}
							{@const percentChange = calculatePercentChange(account.data)}
							<div class="hs-tooltip [--placement:left]">
								<button type="button" class="hs-tooltip-toggle">
									{#if account.profileImage}
										<img 
											src={account.profileImage} 
											alt={account.username}
											class="h-5 w-5 rounded-full border border-gray-200 object-cover dark:border-gray-700"
										/>
									{:else}
										{@const colors = ['bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400', 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400', 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400']}
										<span class="inline-flex h-5 w-5 items-center justify-center rounded-full {colors[i % colors.length]}">
											<span class="text-[10px] font-medium">
												{account.username.charAt(0).toUpperCase()}
											</span>
										</span>
									{/if}
									<span
										class="hs-tooltip-content invisible absolute z-10 inline-block rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-sm transition-opacity hs-tooltip-shown:visible hs-tooltip-shown:opacity-100 dark:bg-gray-700"
										role="tooltip"
									>
										<span class="font-medium">@{account.username}</span>
										<br />
										<span class="{percentChange >= 0 ? 'text-green-400' : 'text-red-400'}">
											{percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
										</span>
									</span>
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
	</div>
</div>
