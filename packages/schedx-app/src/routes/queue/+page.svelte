<script lang="ts">
	import { onMount } from 'svelte';
	import { Settings, Calendar as CalendarIcon, Edit, Trash2, GripVertical, Shuffle } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toastStore';
	import AccountDropdown from '$lib/components/AccountDropdown.svelte';
	import logger from '$lib/logger';

	let queuedTweets: any[] = [];
	let loading = true;
	let error = '';
	let processingQueue = false;
	let shuffling = false;
	let accounts: any[] = [];
	let selectedAccountId: string = 'all';

	onMount(async () => {
		await fetchAccounts();
		await fetchQueue();
	});

	async function fetchAccounts() {
		try {
			const res = await fetch('/api/accounts', {
				credentials: 'same-origin'
			});
			if (res.ok) {
				const data = await res.json();
				accounts = data.accounts || [];
			}
		} catch (e) {
			logger.error('Failed to load accounts:', { error: e });
		}
	}

	async function fetchQueue() {
		loading = true;
		error = '';
		try {
			const url = selectedAccountId && selectedAccountId !== 'all'
				? `/api/queue?accountId=${selectedAccountId}`
				: '/api/queue';
			const res = await fetch(url, {
				credentials: 'same-origin'
			});
			if (!res.ok) {
				const errorData = await res.json().catch(() => ({ error: res.statusText }));
				throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
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

	function onAccountChange(accountId: string) {
		selectedAccountId = accountId;
		fetchQueue();
	}

	async function processQueue() {
		processingQueue = true;
		try {
			const res = await fetch('/api/queue/process', { 
				method: 'POST',
				credentials: 'same-origin'
			});
			if (!res.ok) {
				const errorData = await res.json().catch(() => ({ error: 'Failed to process queue' }));
				throw new Error(errorData.error || 'Failed to process queue');
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

	async function shuffleQueue() {
		shuffling = true;
		try {
			const res = await fetch('/api/queue/shuffle', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ twitterAccountId: selectedAccountId }),
				credentials: 'same-origin'
			});
			if (!res.ok) {
				const errorData = await res.json().catch(() => ({ error: 'Failed to shuffle queue' }));
				throw new Error(errorData.error || 'Failed to shuffle queue');
			}
			toastStore.success('Queue Shuffled', 'Tweet order randomized');
			await fetchQueue();
		} catch (e) {
			toastStore.error('Shuffle Failed', 'Failed to shuffle queue');
			logger.error('Failed to shuffle queue:', { error: e });
		} finally {
			shuffling = false;
		}
	}

	async function deleteTweet(tweetId: string) {
		if (!confirm('Are you sure you want to remove this tweet from the queue?')) {
			return;
		}

		try {
			const res = await fetch(`/api/tweets/${tweetId}`, { 
				method: 'DELETE',
				credentials: 'same-origin'
			});
			if (!res.ok) {
				const errorData = await res.json().catch(() => ({ error: 'Failed to delete tweet' }));
				throw new Error(errorData.error || 'Failed to delete tweet');
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
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Tweet Queue</h1>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400 sm:mt-2">
				Manage tweets waiting to be auto-scheduled
			</p>
		</div>
		<div class="flex flex-col gap-2 sm:flex-row sm:gap-3">
			<a
				href="/queue/settings"
				class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
			>
				<Settings class="h-4 w-4" />
				Queue Settings
			</a>
			<button
				on:click={processQueue}
				disabled={processingQueue || queuedTweets.length === 0}
				class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<CalendarIcon class="h-4 w-4" />
				<span class="hidden xs:inline">{processingQueue ? 'Processing...' : 'Process Queue Now'}</span>
				<span class="xs:hidden">{processingQueue ? 'Processing...' : 'Process Now'}</span>
			</button>
		</div>
	</div>

	<!-- Account Filter -->
	{#if accounts.length > 1}
		<div class="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
			<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
				Filter by Account
			</span>
			<AccountDropdown
				accounts={accounts.map(acc => ({
					id: acc.providerAccountId,
					username: acc.username,
					displayName: acc.displayName || acc.username,
					avatarUrl: acc.profileImage
				}))}
				selectedAccount={selectedAccountId}
				onSelect={onAccountChange}
				placeholder="All Accounts"
			/>
		</div>
	{/if}

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
				<CalendarIcon class="h-8 w-8 text-blue-500" />
			</div>
		</div>
	</div>

	<!-- Queue List -->
	<div class="rounded-lg bg-white shadow dark:bg-gray-800">
		<div class="px-4 py-5 sm:p-6">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Queued Tweets</h2>
				{#if queuedTweets.length > 1}
					<button
						on:click={shuffleQueue}
						disabled={shuffling}
						class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Shuffle class="h-4 w-4" />
						{shuffling ? 'Shuffling...' : 'Shuffle Queue'}
					</button>
				{/if}
			</div>

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
					<CalendarIcon class="mx-auto h-12 w-12 text-gray-400" />
					<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No queued tweets</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Add tweets to the queue to have them auto-scheduled
					</p>
					<div class="mt-6">
						<a
							href="/post"
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
