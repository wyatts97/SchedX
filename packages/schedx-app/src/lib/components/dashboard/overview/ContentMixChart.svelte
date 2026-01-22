<!--
  @component ContentMixChart
  
  Displays content type distribution and hashtag frequency using ApexCharts.
  Follows Preline UI chart styling.
  
  @prop {ContentMixData} contentMix - Content mix data from API
  
  @example
  <ContentMixChart {contentMix} />
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { ContentMixData } from '$lib/types/analytics';

	export let contentMix: ContentMixData;

	let postTypeChartEl: HTMLElement;
	let hashtagChartEl: HTMLElement;
	let postTypeChart: any;
	let hashtagChart: any;
	let observer: MutationObserver | null = null;
	let isMounted = true;
	
	// Check if we have any post type data
	$: hasPostTypeData = contentMix?.postTypeDistribution && (
		(contentMix.postTypeDistribution.text ?? 0) > 0 ||
		(contentMix.postTypeDistribution.image ?? 0) > 0 ||
		(contentMix.postTypeDistribution.video ?? 0) > 0 ||
		(contentMix.postTypeDistribution.gif ?? 0) > 0 ||
		(contentMix.postTypeDistribution.link ?? 0) > 0
	);

	onMount(() => {
		if (!browser) return;
		isMounted = true;

		// Dynamically import ApexCharts and initialize charts
		(async () => {
			if (!isMounted) return;
			
			const ApexCharts = (await import('apexcharts')).default;
			const isDark = document.documentElement.classList.contains('dark');

			// Post Type Distribution Chart (Donut)
			if (postTypeChartEl && hasPostTypeData) {
				const postTypeData = [
					contentMix.postTypeDistribution?.text ?? 0,
					contentMix.postTypeDistribution?.image ?? 0,
					contentMix.postTypeDistribution?.video ?? 0,
					contentMix.postTypeDistribution?.gif ?? 0,
					contentMix.postTypeDistribution?.link ?? 0
				];

				postTypeChart = new ApexCharts(postTypeChartEl, {
					chart: {
						type: 'donut',
						height: 300,
						fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif'
					},
					series: postTypeData,
					labels: ['Text Only', 'Image', 'Video', 'GIF', 'Link'],
					colors: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
					legend: {
						position: 'bottom',
						fontSize: '12px'
					},
					plotOptions: {
						pie: {
							donut: {
								size: '70%'
							}
						}
					},
					dataLabels: {
						enabled: false
					},
					tooltip: {
						y: {
							formatter: function(value: number, { seriesIndex, w }: any) {
								const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
								const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
								return `${value} (${percentage}%)`;
							}
						}
					},
					theme: { mode: isDark ? 'dark' : 'light' }
				});
				postTypeChart.render();
			}

			// Top Hashtags Chart (Horizontal Bar)
			const hashtagData = (contentMix?.topHashtags ?? []).slice(0, 10);
			
			if (hashtagChartEl && hashtagData.length > 0) {
				hashtagChart = new ApexCharts(hashtagChartEl, {
					chart: {
						type: 'bar',
						height: 300,
						fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
						toolbar: { show: false }
					},
					series: [{
						name: 'Uses',
						data: hashtagData.map(h => h.count)
					}],
					xaxis: {
						categories: hashtagData.map(h => '#' + h.hashtag),
						labels: {
							style: { fontSize: '12px' }
						}
					},
					yaxis: {
						labels: {
							style: { fontSize: '12px' }
						}
					},
					plotOptions: {
						bar: {
							horizontal: true,
							borderRadius: 4
						}
					},
					colors: ['#3b82f6'],
					dataLabels: {
						enabled: false
					},
					grid: {
						strokeDashArray: 3,
						borderColor: isDark ? '#374151' : '#e5e7eb'
					},
					theme: { mode: isDark ? 'dark' : 'light' }
				});
				hashtagChart.render();
			}

			// Listen for theme changes
			if (!isMounted) return;
			
			observer = new MutationObserver(() => {
				if (!isMounted) return;
				const newIsDark = document.documentElement.classList.contains('dark');
				const themeUpdate = { theme: { mode: newIsDark ? 'dark' : 'light' } };
				
				if (postTypeChart) postTypeChart.updateOptions(themeUpdate);
				if (hashtagChart) hashtagChart.updateOptions(themeUpdate);
			});

			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['class']
			});
		})();

		return () => {
			isMounted = false;
			if (observer) {
				observer.disconnect();
				observer = null;
			}
			if (postTypeChart) {
				postTypeChart.destroy();
				postTypeChart = null;
			}
			if (hashtagChart) {
				hashtagChart.destroy();
				hashtagChart = null;
			}
		};
	});
</script>

<div class="mb-6">
	<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Content Mix</h2>

	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
		<!-- Post Type Distribution -->
		<div
			class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">
				Post Type Distribution
			</h3>
			{#if hasPostTypeData}
				<div class="h-[300px]">
					<div bind:this={postTypeChartEl}></div>
				</div>
			{:else}
				<div class="flex h-[300px] items-center justify-center">
					<p class="text-sm text-gray-500 dark:text-gray-400">
						No posts found. Click "Sync Analytics Data" to import tweets.
					</p>
				</div>
			{/if}
		</div>

		<!-- Top Hashtags -->
		<div
			class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">
				Top Hashtags
			</h3>
			{#if contentMix?.topHashtags?.length > 0}
				<div class="h-[300px]">
					<div bind:this={hashtagChartEl}></div>
				</div>
			{:else}
				<div class="flex h-[300px] items-center justify-center">
					<p class="text-sm text-gray-500 dark:text-gray-400">
						No hashtags used yet
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>
