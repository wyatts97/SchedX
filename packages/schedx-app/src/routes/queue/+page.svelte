<script lang="ts">
	import { onMount } from 'svelte';
	import { Clock, Settings, Trash2, GripVertical, Calendar } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toastStore';
	import logger from '$lib/logger';

	let queuedTweets: any[] = [];
	let loading = true;
	let error = '';
	let processingQueue = false;

	onMount(async () => {
		await fetchQueue();
	});

	async function fetchQueue() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/queue');
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}
			const data = await res.json();
			queuedTweets = data.tweets || [];
		} catch (e) {
			error = 'Failed to load queue';
			toastStore.error('Load Failed', error);
			logger.error('Failed to load queue:', { error: e });
		} finally {
			loading = false;
		}
	}

	async function processQueue() {
		processingQueue = true;
		try {
			const res = await fetch('/api/queue/process', { method: 'POST' });
			if (!res.ok) {
				throw new Error('Failed to process queue');
			}
			const data = await res.json();
			toastStore.success('Queue Processed', `Scheduled ${data.scheduled} tweets`);
			await fetchQueue();
		} catch (e) {
			toastStore.error('Process Failed', 'Failed to process queue');
			logger.error('Failed to process queue:', { error: e });
		} finally {
			processingQueue = false;
		}
	}

	async function deleteTweet(tweetId: string) {
		if (!confirm('Are you sure you want to remove this tweet from the queue?')) {
			return;
		}

		try {
			const res = await fetch(`/api/tweets/${tweetId}`, { method: 'DELETE' });
			if (!res.ok) {
				throw new Error('Failed to delete tweet');
			}
			toastStore.success('Removed', 'Tweet removed from queue');
			await fetchQueue();
		} catch (e) {
			toastStore.error('Delete Failed', 'Failed to remove tweet from queue');
			logger.error('Failed to delete tweet:', { error: e });
		}
	}

	function formatDate(date: string | Date) {
		return new Date(date).toLocaleString();
	}
</script>

<svelte:head>
	<title>Tweet Queue - SchedX</title>
	<meta name="description" content="Manage your tweet queue" />
</svelte:head>

<div class="mx-auto max-w-6xl">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Tweet Queue</h1>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
				Manage tweets waiting to be auto-scheduled
			</p>
		</div>
		<div class="flex gap-3">
			<a
				href="/queue/settings"
				class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
			>
				<Settings class="h-4 w-4" />
				Queue Settings
			</a>
			<button
				on:click={processQueue}
				disabled={processingQueue || queuedTweets.length === 0}
				class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<Calendar class="h-4 w-4" />
				{processingQueue ? 'Processing...' : 'Process Queue Now'}
			</button>
		</div>
	</div>

	<!-- Queue Stats -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-gray-600 dark:text-gray-400">Queued Tweets</p>
					<p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
						{queuedTweets.length}
					</p>
				</div>
				<Clock class="h-8 w-8 text-blue-500" />
			</div>
		</div>
	</div>

	<!-- Queue List -->
	<div class="rounded-lg bg-white shadow dark:bg-gray-800">
		<div class="px-4 py-5 sm:p-6">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Queued Tweets</h2>

			{#if loading}
				<div class="flex items-center justify-center py-12">
					<div
						class="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
					></div>
				</div>
			{:else if error}
				<div class="rounded-md border border-red-200 bg-red-50 p-4">
					<p class="text-sm text-red-800">{error}</p>
				</div>
			{:else if queuedTweets.length === 0}
				<div class="py-12 text-center">
					<Clock class="mx-auto h-12 w-12 text-gray-400" />
					<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No queued tweets</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Add tweets to the queue to have them auto-scheduled
					</p>
					<div class="mt-6">
						<a
							href="/"
							class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-700"
						>
							Create Tweet
						</a>
					</div>
				</div>
			{:else}
				<div class="space-y-3">
					{#each queuedTweets as tweet, index (tweet.id)}
						<div
							class="flex items-start gap-4 rounded-lg border border-gray-200 p-4 transition-all duration-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
						>
							<!-- Drag Handle -->
							<div class="flex items-center">
								<GripVertical class="h-5 w-5 text-gray-400" />
								<span class="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">
									#{index + 1}
								</span>
							</div>

							<!-- Tweet Content -->
							<div class="flex-1">
								<p class="text-sm text-gray-900 dark:text-white">{tweet.content}</p>
								{#if tweet.media && tweet.media.length > 0}
									<div class="mt-2 flex gap-2">
										{#each tweet.media as media}
											<img
												src={media.url}
												alt="Media"
												class="h-16 w-16 rounded object-cover"
											/>
										{/each}
									</div>
								{/if}
								<div class="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
									<span>Added: {formatDate(tweet.createdAt)}</span>
									{#if tweet.twitterAccountId}
										<span>Account: {tweet.twitterAccountId}</span>
									{/if}
								</div>
							</div>

							<!-- Actions -->
							<div class="flex items-center gap-2">
								<button
									on:click={() => deleteTweet(tweet.id)}
									class="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
									title="Remove from queue"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
