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

		// Dynamically import ApexCharts and initialize charts
		(async () => {
			// Wait for post type chart element to be available
			if (!postTypeChartEl || !hasPostTypeData) {
				console.warn('Post type chart element not found or no data, skipping chart initialization');
				return;
			}
			
			const ApexCharts = (await import('apexcharts')).default;

			// Post Type Distribution Chart (Donut)
			const postTypeData = [
				contentMix.postTypeDistribution?.text ?? 0,
				contentMix.postTypeDistribution?.image ?? 0,
				contentMix.postTypeDistribution?.video ?? 0,
				contentMix.postTypeDistribution?.gif ?? 0,
				contentMix.postTypeDistribution?.link ?? 0
			];

			const postTypeOptions = {
			chart: {
				type: 'donut',
				height: 300,
				fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
				toolbar: { show: false }
			},
			series: postTypeData,
			labels: ['Text Only', 'Image', 'Video', 'GIF', 'Link'],
			colors: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
			legend: {
				position: 'bottom',
				fontSize: '12px',
				fontWeight: 400,
				markers: {
					width: 8,
					height: 8,
					radius: 2
				},
				itemMargin: {
					horizontal: 8,
					vertical: 4
				},
				labels: {
					colors: document.documentElement.classList.contains('dark') ? '#d1d5db' : '#374151',
					useSeriesColors: false
				}
			},
			dataLabels: {
				enabled: true,
				formatter: function (val: number) {
					return Math.round(val) + '%';
				}
			},
			plotOptions: {
				pie: {
					donut: {
						size: '70%',
						labels: {
							show: true,
							name: { show: true, fontSize: '14px' },
							value: { show: true, fontSize: '24px', fontWeight: 600 },
							total: {
								show: true,
								label: 'Total Posts',
								fontSize: '14px',
								formatter: function (w: any) {
									return w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
								}
							}
						}
					}
				}
			},
			theme: {
				mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
			}
		};

		postTypeChart = new ApexCharts(postTypeChartEl, postTypeOptions);
		postTypeChart.render();

		// Top Hashtags Chart (Bar)
		const hashtagData = (contentMix?.topHashtags ?? []).slice(0, 10);
		
		const hashtagOptions = {
			chart: {
				type: 'bar',
				height: 300,
				fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
				toolbar: { show: false }
			},
			series: [
				{
					name: 'Uses',
					data: hashtagData.map(h => h.count)
				}
			],
			xaxis: {
				categories: hashtagData.map(h => '#' + h.hashtag),
				labels: {
					style: { fontSize: '12px' }
				}
			},
			yaxis: {
				title: { text: 'Number of Uses' }
			},
			colors: ['#3b82f6'],
			plotOptions: {
				bar: {
					borderRadius: 4,
					horizontal: true,
					dataLabels: { position: 'top' }
				}
			},
			dataLabels: {
				enabled: true,
				offsetX: 30,
				style: { fontSize: '12px', colors: ['#334155'] }
			},
			theme: {
				mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
			}
		};

		// Only create hashtag chart if element exists (when there are hashtags)
		if (hashtagChartEl) {
			hashtagChart = new ApexCharts(hashtagChartEl, hashtagOptions);
			hashtagChart.render();
		}

		// Listen for theme changes
		const observer = new MutationObserver(() => {
			const isDark = document.documentElement.classList.contains('dark');
			if (postTypeChart) {
				postTypeChart.updateOptions({ theme: { mode: isDark ? 'dark' : 'light' } });
			}
			if (hashtagChart) {
				hashtagChart.updateOptions({ theme: { mode: isDark ? 'dark' : 'light' } });
			}
		});

			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['class']
			});
		})();

		return () => {
			if (postTypeChart) postTypeChart.destroy();
			if (hashtagChart) hashtagChart.destroy();
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
				<div bind:this={postTypeChartEl}></div>
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
				<div bind:this={hashtagChartEl}></div>
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
