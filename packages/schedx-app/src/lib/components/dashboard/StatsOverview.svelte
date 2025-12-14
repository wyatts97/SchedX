<script lang="ts">
	import { onMount } from 'svelte';
	import { TrendingUp, MessageCircle, Calendar as CalendarIcon, CheckCircle, XCircle, Users } from 'lucide-svelte';
	import type { Analytics, TwitterApp } from '$lib/stores/dashboardStore';

	export let analytics: Analytics | undefined = undefined;
	export let apps: TwitterApp[] | undefined = undefined;

	let animatedPublished = 0;
	let animatedScheduled = 0;
	let animatedFailed = 0;
	let animatedApps = 0;

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

	$: if (analytics && apps) {
		animateCounter(analytics.postedTweets || 0, (val) => (animatedPublished = val));
		animateCounter(analytics.scheduledTweets || 0, (val) => (animatedScheduled = val));
		animateCounter(analytics.failedTweets || 0, (val) => (animatedFailed = val));
		animateCounter(apps.length, (val) => (animatedApps = val));
	}
</script>

{#if analytics && apps}
	<div class="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Published Tweets (was Posted, moved to first position) -->
		<div
			class="group cursor-default rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-800 theme-lightsout:bg-black"
		>
			<div class="flex items-center">
				<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/20">
					<CheckCircle class="h-6 w-6 text-green-600 dark:text-green-400" />
				</div>
				<div class="ml-4 flex-1">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
						Published Tweets
					</dt>
					<dd class="text-2xl font-semibold text-gray-900 dark:text-white">
						{animatedPublished}
					</dd>
				</div>
			</div>
		</div>

		<div
			class="group cursor-default rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-800 theme-lightsout:bg-black"
		>
			<div class="flex items-center">
				<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 theme-lightsout:bg-gray-800">
					<CalendarIcon class="h-6 w-6 text-blue-600 dark:text-blue-400" />
				</div>
				<div class="ml-4 flex-1">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
						Scheduled
					</dt>
					<dd class="text-2xl font-semibold text-gray-900 dark:text-white">
						{animatedScheduled}
					</dd>
				</div>
			</div>
		</div>

		<!-- Failed Tweets -->
		<div
			class="group cursor-default rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-800 theme-lightsout:bg-black"
		>
			<div class="flex items-center">
				<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20">
					<XCircle class="h-6 w-6 text-red-600 dark:text-red-400" />
				</div>
				<div class="ml-4 flex-1">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Failed</dt>
					<dd class="text-2xl font-semibold text-gray-900 dark:text-white">
						{animatedFailed}
					</dd>
				</div>
			</div>
		</div>

		<div
			class="group cursor-default rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-800 theme-lightsout:bg-black"
		>
			<div class="flex items-center">
				<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/20">
					<Users class="h-6 w-6 text-purple-600 dark:text-purple-400" />
				</div>
				<div class="ml-4 flex-1">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
						Twitter Apps
					</dt>
					<dd class="text-2xl font-semibold text-gray-900 dark:text-white">{animatedApps}</dd>
				</div>
			</div>
		</div>
	</div>
{/if}
