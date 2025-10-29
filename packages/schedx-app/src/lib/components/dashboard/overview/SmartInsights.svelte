<!--
  @component SmartInsights
  
  Displays actionable insights with priority badges.
  Allows users to dismiss insights they've seen.
  
  @prop {Insight[]} insights - Array of insights from API
  @prop {Function} onDismiss - Callback when insight is dismissed
  
  @example
  <SmartInsights {insights} onDismiss={handleDismiss} />
-->

<script lang="ts">
	import { Lightbulb, X, AlertCircle, Info } from 'lucide-svelte';
	import type { Insight } from '$lib/types/analytics';

	export let insights: Insight[];
	export let onDismiss: (insightId: string) => Promise<void>;

	let dismissing: string | null = null;

	async function handleDismiss(insightId: string) {
		dismissing = insightId;
		try {
			await onDismiss(insightId);
		} catch (error) {
			console.error('Failed to dismiss insight:', error);
		} finally {
			dismissing = null;
		}
	}

	// Get priority badge styling
	function getPriorityBadge(priority: number): { text: string; class: string } {
		switch (priority) {
			case 2:
				return {
					text: 'High',
					class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
				};
			case 1:
				return {
					text: 'Medium',
					class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
				};
			default:
				return {
					text: 'Low',
					class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
				};
		}
	}

	// Get icon based on insight type
	function getInsightIcon(type: string) {
		switch (type) {
			case 'inactive_account':
				return AlertCircle;
			default:
				return Lightbulb;
		}
	}
</script>

<div class="mb-6">
	<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Smart Insights</h2>

	{#if insights.length === 0}
		<!-- Empty State -->
		<div
			class="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-8 dark:border-gray-700 dark:bg-gray-800/50"
		>
			<Info class="mb-3 h-12 w-12 text-gray-400 dark:text-gray-600" />
			<p class="text-sm text-gray-600 dark:text-gray-400">
				No insights available yet. Check back after posting more content!
			</p>
		</div>
	{:else}
		<!-- Insights Grid -->
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			{#each insights as insight (insight.id)}
				<div
					class="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
				>
					<!-- Dismiss Button -->
					<button
						on:click={() => handleDismiss(insight.id)}
						disabled={dismissing === insight.id}
						class="absolute right-3 top-3 rounded-lg p-1 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-300"
						title="Dismiss insight"
					>
						<X class="h-4 w-4" />
					</button>

					<!-- Header -->
					<div class="mb-3 flex items-start gap-3">
						<div
							class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"
						>
							<svelte:component
								this={getInsightIcon(insight.insightType)}
								class="h-5 w-5 text-blue-600 dark:text-blue-400"
							/>
						</div>
						<div class="flex-1">
							<div class="mb-1 flex items-center gap-2">
								<h3 class="font-semibold text-gray-900 dark:text-white">
									{insight.title}
								</h3>
								<span
									class="rounded-full px-2 py-0.5 text-xs font-medium {getPriorityBadge(
										insight.priority
									).class}"
								>
									{getPriorityBadge(insight.priority).text}
								</span>
							</div>
						</div>
					</div>

					<!-- Message -->
					<p class="text-sm text-gray-700 dark:text-gray-300">
						{insight.message}
					</p>

					<!-- Generated Time -->
					<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
						Generated {new Date(insight.generatedAt).toLocaleDateString()}
					</p>
				</div>
			{/each}
		</div>
	{/if}
</div>
