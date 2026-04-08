<script lang="ts">
	import { autoAnimate } from '@formkit/auto-animate';
	import { Edit, Calendar as CalendarIcon, List, FileEdit, Trash2, FileText, Filter, Clock, CheckSquare, Square, Trash, Clock3, Hash } from 'lucide-svelte';
	import type { Tweet } from '$lib/stores/dashboardStore';
	import type { UserAccount } from '$lib/types';
	import { createEventDispatcher } from 'svelte';
	import TweetPreview from '$lib/components/TweetPreview.svelte';
	import AccountDropdown from '$lib/components/AccountDropdown.svelte';
	import StyledSelect from '$lib/components/StyledSelect.svelte';
	import { getHighResProfileImage } from '$lib/utils/twitter';

	export let tweets: Tweet[] = [];
	export let accounts: UserAccount[] = [];

	const dispatch = createEventDispatcher();
	
	// Transform accounts for dropdown with avatar support
	$: dropdownAccounts = accounts.map(account => ({
		id: (account.providerAccountId || account.id) as string,
		username: account.username,
		displayName: (account as any).displayName || account.username,
		avatarUrl: getHighResProfileImage((account as any).profileImage)
	}));

	// Filter state
	let selectedAccount = 'all';
	let selectedStatus: 'all' | 'scheduled' | 'queued' = 'all';

	// Bulk selection state
	let selectedTweetIds: Set<string> = new Set();
	let bulkMode = false;

	// Toggle bulk selection mode
	function toggleBulkMode() {
		bulkMode = !bulkMode;
		if (!bulkMode) {
			selectedTweetIds = new Set();
		}
	}

	// Toggle single tweet selection
	function toggleTweetSelection(tweetId: string) {
		if (selectedTweetIds.has(tweetId)) {
			selectedTweetIds.delete(tweetId);
		} else {
			selectedTweetIds.add(tweetId);
		}
		selectedTweetIds = selectedTweetIds; // Trigger reactivity
	}

	// Select/deselect all visible tweets
	function toggleSelectAll() {
		if (selectedTweetIds.size === sortedTweets.length) {
			selectedTweetIds = new Set();
		} else {
			selectedTweetIds = new Set(sortedTweets.map(t => t.id).filter((id): id is string => !!id));
		}
	}

	// Handle bulk delete
	function handleBulkDelete() {
		if (selectedTweetIds.size === 0) return;
		dispatch('bulkDelete', Array.from(selectedTweetIds));
		selectedTweetIds = new Set();
		bulkMode = false;
	}

	// Handle bulk reschedule (shift by hours)
	function handleBulkReschedule(hoursToShift: number) {
		if (selectedTweetIds.size === 0) return;
		dispatch('bulkReschedule', { 
			tweetIds: Array.from(selectedTweetIds), 
			hoursToShift 
		});
		selectedTweetIds = new Set();
		bulkMode = false;
	}

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

<div class="surface-card rounded-lg dark:bg-[#15202B]">
	<div class="px-4 py-5 sm:p-6">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="text-lg font-medium leading-6 text-surface-900 dark:text-surface-100">
				Scheduled Tweets
			</h3>
			<div class="flex items-center gap-2">
				<span class="text-sm text-surface-500 dark:text-surface-400">
					{filteredTweets.length} tweet{filteredTweets.length !== 1 ? 's' : ''}
				</span>
				<!-- Bulk Mode Toggle -->
				<button
					type="button"
					on:click={toggleBulkMode}
					class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {bulkMode ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
					title="{bulkMode ? 'Exit bulk mode' : 'Select multiple tweets'}"
				>
					<CheckSquare class="h-4 w-4" />
					{bulkMode ? 'Done' : 'Select'}
				</button>
			</div>
		</div>

		<!-- Bulk Actions Bar (shown when in bulk mode with selections) -->
		{#if bulkMode}
			<div class="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
				<button
					type="button"
					on:click={toggleSelectAll}
					class="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-700"
				>
					{#if selectedTweetIds.size === sortedTweets.length && sortedTweets.length > 0}
						<CheckSquare class="h-4 w-4 text-blue-500" />
						Deselect All
					{:else}
						<Square class="h-4 w-4" />
						Select All
					{/if}
				</button>

				{#if selectedTweetIds.size > 0}
					<span class="text-sm font-medium text-blue-700 dark:text-blue-300">
						{selectedTweetIds.size} selected
					</span>
					
					<div class="ml-auto flex flex-wrap items-center gap-2">
						<!-- Reschedule options -->
						<div class="flex items-center gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-600">
							<span class="px-2 text-xs text-gray-500 dark:text-gray-400">Shift:</span>
							<button
								type="button"
								on:click={() => handleBulkReschedule(-24)}
								class="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
								title="Move 24 hours earlier"
							>
								-1 day
							</button>
							<button
								type="button"
								on:click={() => handleBulkReschedule(-1)}
								class="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
								title="Move 1 hour earlier"
							>
								-1h
							</button>
							<button
								type="button"
								on:click={() => handleBulkReschedule(1)}
								class="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
								title="Move 1 hour later"
							>
								+1h
							</button>
							<button
								type="button"
								on:click={() => handleBulkReschedule(24)}
								class="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
								title="Move 24 hours later"
							>
								+1 day
							</button>
						</div>

						<!-- Delete button -->
						<button
							type="button"
							on:click={handleBulkDelete}
							class="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-600"
							title="Delete selected tweets"
						>
							<Trash class="h-4 w-4" />
							Delete
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Filters -->
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
			<!-- Account Filter -->
			<div class="flex-1">
				<AccountDropdown
					accounts={dropdownAccounts}
					bind:selectedAccount
					onSelect={(id) => { selectedAccount = id; }}
					placeholder="Filter by account"
				/>
			</div>

			<!-- Status Filter -->
			<div class="flex-1">
				<StyledSelect
					id="status-filter"
					bind:value={selectedStatus}
					options={[
						{ value: 'all', label: 'All Status' },
						{ value: 'scheduled', label: 'Scheduled' },
						{ value: 'queued', label: 'Queued' }
					]}
					placeholder="Filter by status"
				/>
			</div>
		</div>

		<!-- Tweet List -->
		<div use:autoAnimate={{ duration: 250 }} class="max-h-[800px] space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 dark:scrollbar-track-gray-800 dark:scrollbar-thumb-gray-600 dark:hover:scrollbar-thumb-gray-500">
			{#if sortedTweets.length > 0}
				{#each sortedTweets as tweet (tweet.id)}
					{@const account = tweet.twitterAccountId ? accountByProviderId[tweet.twitterAccountId] : undefined}
					{@const displayDate = getDisplayDate(tweet)}
					{@const isSelected = tweet.id ? selectedTweetIds.has(tweet.id) : false}
					<div class="group overflow-hidden rounded-xl border transition-all hover:shadow-md {isSelected ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-200 dark:border-gray-700 theme-lightsout:border-gray-800'} bg-white shadow-sm dark:bg-gray-800 theme-lightsout:bg-black">
						<!-- Status Badge & Actions - Clean horizontal layout -->
						<div class="flex items-center justify-center gap-2 rounded-t-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/50 theme-lightsout:bg-gray-900">
							<!-- Bulk Selection Checkbox -->
							{#if bulkMode && tweet.id}
								<button
									type="button"
									on:click={() => tweet.id && toggleTweetSelection(tweet.id)}
									class="flex items-center justify-center rounded p-1 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
									title="{isSelected ? 'Deselect' : 'Select'} tweet"
								>
									{#if isSelected}
										<CheckSquare class="h-5 w-5 text-blue-500" />
									{:else}
										<Square class="h-5 w-5 text-gray-400" />
									{/if}
								</button>
							{/if}

							<!-- Queue Position Badge (for queued tweets) -->
							{#if tweet.status === 'queued' && tweet.queuePosition !== undefined}
								<div class="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
									<Hash class="h-3 w-3" />
									<span>{tweet.queuePosition + 1}</span>
								</div>
							{/if}

							<!-- Time Badge -->
							<div class="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm ring-1 ring-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-600 theme-lightsout:bg-gray-800 theme-lightsout:text-gray-300 theme-lightsout:ring-gray-700">
								<Clock class="h-4 w-4 text-gray-400" />
								<span>{tweet.status === 'queued' ? 'Est. ' : ''}{getTimeUntil(displayDate)}</span>
							</div>
							
							<!-- Edit Button -->
							<button
								type="button"
								on:click={() => handleEditTweet(tweet)}
								class="inline-flex items-center gap-1.5 rounded-full bg-blue-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-600 hover:shadow-md"
								title="Edit {tweet.status === 'scheduled' ? 'scheduled' : 'queued'} tweet"
							>
								{#if tweet.status === 'scheduled'}
									<CalendarIcon class="h-4 w-4" />
								{:else}
									<List class="h-4 w-4" />
								{/if}
								<Edit class="h-4 w-4" />
							</button>
							
							<!-- Delete Button -->
							<button
								type="button"
								on:click={() => handleDeleteTweet(tweet)}
								class="inline-flex items-center justify-center rounded-full bg-red-500 p-2 text-white shadow-sm transition-all hover:bg-red-600 hover:shadow-md"
								title="Delete tweet"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>

						<!-- Tweet Preview -->
						{#if account}
							<div class="tweet-preview-wrapper [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
								<TweetPreview
									avatarUrl={getHighResProfileImage(account.profileImage)}
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
					<Filter class="mx-auto h-12 w-12 text-surface-400" />
					<h3 class="mt-2 text-sm font-medium text-surface-900 dark:text-surface-100">No tweets found</h3>
					<p class="mt-1 text-sm text-surface-500 dark:text-surface-400">
						Try adjusting your filters.
					</p>
				</div>
			{:else}
				<div class="py-12 text-center">
					<FileText class="mx-auto h-12 w-12 text-surface-400" />
					<h3 class="mt-2 text-sm font-medium text-surface-900 dark:text-surface-100">No scheduled tweets</h3>
					<p class="mt-1 text-sm text-surface-500 dark:text-surface-400">
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
