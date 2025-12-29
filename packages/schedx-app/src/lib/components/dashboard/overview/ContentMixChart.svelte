<!--
  @component ContentMixChart
  
  Displays content type distribution and hashtag frequency using Chart.js.
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

	let postTypeChartEl: HTMLCanvasElement;
	let hashtagChartEl: HTMLCanvasElement;
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

		// Dynamically import Chart.js and initialize charts
		(async () => {
			// Wait for post type chart element to be available
			if (!postTypeChartEl || !hasPostTypeData) {
				console.warn('Post type chart element not found or no data, skipping chart initialization');
				return;
			}
			
			const { Chart, registerables } = await import('chart.js');
			Chart.register(...registerables);

			// Post Type Distribution Chart (Doughnut)
			const isDark = document.documentElement.classList.contains('dark');
			const postTypeData = [
				contentMix.postTypeDistribution?.text ?? 0,
				contentMix.postTypeDistribution?.image ?? 0,
				contentMix.postTypeDistribution?.video ?? 0,
				contentMix.postTypeDistribution?.gif ?? 0,
				contentMix.postTypeDistribution?.link ?? 0
			];

			postTypeChart = new Chart(postTypeChartEl, {
				type: 'doughnut',
				data: {
					labels: ['Text Only', 'Image', 'Video', 'GIF', 'Link'],
					datasets: [{
						data: postTypeData,
						backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
						borderWidth: 0
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: 'bottom',
							labels: {
								font: { size: 12, family: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif' },
								color: isDark ? '#d1d5db' : '#374151',
								padding: 8,
								boxWidth: 8,
								boxHeight: 8
							}
						},
						tooltip: {
							callbacks: {
								label: function(context: any) {
									const label = context.label || '';
									const value = context.parsed || 0;
									const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
									const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
									return `${label}: ${value} (${percentage}%)`;
								}
							}
						}
					},
					cutout: '70%'
				}
			});

		// Top Hashtags Chart (Horizontal Bar)
		const hashtagData = (contentMix?.topHashtags ?? []).slice(0, 10);
		
		// Only create hashtag chart if element exists (when there are hashtags)
		if (hashtagChartEl && hashtagData.length > 0) {
			hashtagChart = new Chart(hashtagChartEl, {
				type: 'bar',
				data: {
					labels: hashtagData.map(h => '#' + h.hashtag),
					datasets: [{
						label: 'Uses',
						data: hashtagData.map(h => h.count),
						backgroundColor: '#3b82f6',
						borderRadius: 4
					}]
				},
				options: {
					indexAxis: 'y',
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								label: function(context: any) {
									return `Uses: ${context.parsed.x}`;
								}
							}
						}
					},
					scales: {
						x: {
							beginAtZero: true,
							ticks: {
								font: { size: 12 },
								color: isDark ? '#d1d5db' : '#374151'
							},
							grid: {
								color: isDark ? '#374151' : '#e5e7eb'
							}
						},
						y: {
							ticks: {
								font: { size: 12 },
								color: isDark ? '#d1d5db' : '#374151'
							},
							grid: {
								display: false
							}
						}
					}
				}
			});
		}

		// Listen for theme changes
		const observer = new MutationObserver(() => {
			const newIsDark = document.documentElement.classList.contains('dark');
			const textColor = newIsDark ? '#d1d5db' : '#374151';
			const gridColor = newIsDark ? '#374151' : '#e5e7eb';
			
			if (postTypeChart) {
				postTypeChart.options.plugins.legend.labels.color = textColor;
				postTypeChart.update();
			}
			if (hashtagChart) {
				hashtagChart.options.scales.x.ticks.color = textColor;
				hashtagChart.options.scales.y.ticks.color = textColor;
				hashtagChart.options.scales.x.grid.color = gridColor;
				hashtagChart.update();
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
				<div class="h-[300px]">
					<canvas bind:this={postTypeChartEl}></canvas>
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
					<canvas bind:this={hashtagChartEl}></canvas>
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
