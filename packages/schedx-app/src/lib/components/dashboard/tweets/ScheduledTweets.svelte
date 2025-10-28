<script lang="ts">
	import { Edit, Calendar as CalendarIcon, List, FileEdit, Trash2, FileText, Filter, Clock } from 'lucide-svelte';
	import type { Tweet } from '$lib/stores/dashboardStore';
	import type { UserAccount } from '$lib/types';
	import { createEventDispatcher } from 'svelte';
	import TweetPreview from '$lib/components/TweetPreview.svelte';

	export let tweets: Tweet[] = [];
	export let accounts: UserAccount[] = [];

	const dispatch = createEventDispatcher();

	// Filter state
	let selectedAccount = 'all';
	let selectedStatus: 'all' | 'scheduled' | 'queued' = 'all';

	// Create account lookup map
	$: accountByProviderId = accounts.reduce((acc: any, account: any) => {
		acc[account.providerAccountId] = account;
		return acc;
	}, {});

	// Filter scheduled/queued tweets only
	$: scheduledTweets = tweets.filter(t => t.status === 'scheduled' || t.status === 'queued');

	// Apply filters
	$: filteredTweets = scheduledTweets.filter(tweet => {
		// Account filter
		if (selectedAccount !== 'all' && tweet.twitterAccountId !== selectedAccount) {
			return false;
		}
		// Status filter
		if (selectedStatus !== 'all' && tweet.status !== selectedStatus) {
			return false;
		}
		return true;
	});

	// Sort by scheduled date (earliest first)
	$: sortedTweets = [...filteredTweets].sort((a, b) => {
		const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : new Date(a.createdAt).getTime();
		const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : new Date(b.createdAt).getTime();
		return dateA - dateB;
	});

	function handleEditTweet(tweet: Tweet) {
		dispatch('editTweet', tweet);
	}

	function handleDeleteTweet(tweet: Tweet) {
		dispatch('deleteTweet', tweet);
	}

	// Get the display date based on tweet status
	function getDisplayDate(tweet: Tweet): Date {
		if (tweet.status === 'scheduled' || tweet.status === 'queued') {
			return tweet.scheduledDate ? new Date(tweet.scheduledDate) : new Date(tweet.createdAt);
		}
		return new Date(tweet.createdAt);
	}

	// Calculate time until scheduled
	function getTimeUntil(date: Date): string {
		const now = new Date();
		const diff = date.getTime() - now.getTime();
		
		if (diff < 0) return 'Overdue';
		
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
		
		if (days > 0) return `in ${days}d ${hours}h`;
		if (hours > 0) return `in ${hours}h ${minutes}m`;
		return `in ${minutes}m`;
	}
</script>

<div class="rounded-lg bg-white shadow dark:bg-gray-800">
	<div class="px-4 py-5 sm:p-6">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">
				Scheduled Tweets
			</h3>
			<span class="text-sm text-gray-500 dark:text-gray-400">
				{filteredTweets.length} tweet{filteredTweets.length !== 1 ? 's' : ''}
			</span>
		</div>

		<!-- Filters -->
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
			<!-- Account Filter -->
			<div class="flex-1">
				<label for="scheduled-account-filter" class="sr-only">Filter by account</label>
				<select
					id="scheduled-account-filter"
					bind:value={selectedAccount}
					class="block w-full rounded-lg border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
				>
					<option value="all">All Accounts</option>
					{#each accounts as account}
						<option value={account.providerAccountId}>
							@{account.username}
						</option>
					{/each}
				</select>
			</div>

			<!-- Status Filter -->
			<div class="flex-1">
				<label for="status-filter" class="sr-only">Filter by status</label>
				<select
					id="status-filter"
					bind:value={selectedStatus}
					class="block w-full rounded-lg border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
				>
					<option value="all">All Status</option>
					<option value="scheduled">Scheduled</option>
					<option value="queued">Queued</option>
				</select>
			</div>
		</div>

		<!-- Tweet List -->
		<div class="max-h-[800px] space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 dark:scrollbar-track-gray-800 dark:scrollbar-thumb-gray-600 dark:hover:scrollbar-thumb-gray-500">
			{#if sortedTweets.length > 0}
				{#each sortedTweets as tweet}
					{@const account = tweet.twitterAccountId ? accountByProviderId[tweet.twitterAccountId] : undefined}
					{@const displayDate = getDisplayDate(tweet)}
					<div class="group relative rounded-lg border border-gray-200 bg-white transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-800/80">
						<!-- Status Badge & Actions - Top right corner -->
						<div class="absolute right-3 top-3 z-10 flex gap-2">
							<!-- Status Badge with Countdown -->
							{#if tweet.status === 'scheduled'}
								<div class="flex items-center gap-2">
									<span class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30">
										<Clock class="h-3 w-3" />
										{getTimeUntil(displayDate)}
									</span>
									<button
										type="button"
										on:click={() => handleEditTweet(tweet)}
										class="inline-flex items-center justify-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-blue-700 ring-1 ring-inset ring-blue-600/20 transition-colors hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30 dark:hover:bg-blue-500/20"
										title="Edit scheduled tweet"
									>
										<CalendarIcon class="h-3.5 w-3.5 flex-shrink-0" />
										<div class="h-3.5 w-px bg-blue-600/20 dark:bg-blue-500/30"></div>
										<Edit class="h-3.5 w-3.5 flex-shrink-0" />
									</button>
								</div>
							{:else if tweet.status === 'queued'}
								<div class="flex items-center gap-2">
									<span class="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/30">
										<Clock class="h-3 w-3" />
										{getTimeUntil(displayDate)}
									</span>
									<button
										type="button"
										on:click={() => handleEditTweet(tweet)}
										class="inline-flex items-center justify-center gap-2 rounded-full bg-purple-50 px-4 py-1.5 text-purple-700 ring-1 ring-inset ring-purple-600/20 transition-colors hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/30 dark:hover:bg-purple-500/20"
										title="Edit queued tweet"
									>
										<List class="h-3.5 w-3.5 flex-shrink-0" />
										<div class="h-3.5 w-px bg-purple-600/20 dark:bg-purple-500/30"></div>
										<Edit class="h-3.5 w-3.5 flex-shrink-0" />
									</button>
								</div>
							{/if}
							
							<!-- Delete Button -->
							<button
								type="button"
								on:click={() => handleDeleteTweet(tweet)}
								class="inline-flex items-center justify-center gap-2 rounded-full bg-red-50 px-4 py-1.5 text-red-700 ring-1 ring-inset ring-red-600/20 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30 dark:hover:bg-red-500/20"
								title="Delete tweet"
							>
								<Trash2 class="h-3.5 w-3.5 flex-shrink-0" />
							</button>
						</div>

						<!-- Tweet Preview -->
						{#if account}
							<div class="tweet-preview-wrapper">
								<TweetPreview
									avatarUrl={account.profileImage || '/avatar.png'}
									displayName={account.displayName || account.username}
									username={account.username}
									content={tweet.content}
									media={tweet.media || []}
									createdAt={displayDate}
									replies={0}
									retweets={0}
									likes={0}
									bookmarks={0}
									views={0}
									hideActions={true}
								/>
							</div>
						{/if}
					</div>
				{/each}
			{:else if selectedAccount !== 'all' || selectedStatus !== 'all'}
				<div class="py-12 text-center">
					<Filter class="mx-auto h-12 w-12 text-gray-400" />
					<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No tweets found</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Try adjusting your filters.
					</p>
				</div>
			{:else}
				<div class="py-12 text-center">
					<FileText class="mx-auto h-12 w-12 text-gray-400" />
					<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No scheduled tweets</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Schedule your first tweet to see it here.
					</p>
					<div class="mt-6">
						<a
							href="/post"
							class="inline-flex items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						>
							Schedule Tweet
						</a>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
