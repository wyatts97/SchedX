<script lang="ts">
	import { BarChart2, Clock, Upload, Users } from 'lucide-svelte';
	import type { Analytics, TwitterApp } from '$lib/stores/dashboardStore';

	export let analytics: Analytics | undefined = undefined;
	export let apps: TwitterApp[] | undefined = undefined;
</script>

{#if analytics && apps}
	<div class="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-white dark:bg-gray-800"
		>
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<BarChart2 class="h-6 w-6 text-gray-400" />
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
								Total Tweets
							</dt>
							<dd class="text-lg font-medium text-gray-900 dark:text-white">
								{analytics.totalTweets || 0}
							</dd>
						</dl>
					</div>
				</div>
			</div>
		</div>

		<div
			class="rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-white dark:bg-gray-800"
		>
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<Clock class="h-6 w-6 text-blue-400" />
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
								Scheduled
							</dt>
							<dd class="text-lg font-medium text-gray-900 dark:text-white">
								{analytics.scheduledTweets || 0}
							</dd>
						</dl>
					</div>
				</div>
			</div>
		</div>

		<div
			class="rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-white dark:bg-gray-800"
		>
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<Upload class="h-6 w-6 text-green-400" />
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Posted</dt>
							<dd class="text-lg font-medium text-gray-900 dark:text-white">
								{analytics.postedTweets || 0}
							</dd>
						</dl>
					</div>
				</div>
			</div>
		</div>

		<div
			class="rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-white dark:bg-gray-800"
		>
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<Users class="h-6 w-6 text-purple-400" />
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
								Twitter Apps
							</dt>
							<dd class="text-lg font-medium text-gray-900 dark:text-white">{apps.length}</dd>
						</dl>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
