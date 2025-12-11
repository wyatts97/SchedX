<script lang="ts">
	import { Edit, Calendar as CalendarIcon, List, FileEdit, Trash2, FileText, Filter, Clock } from 'lucide-svelte';
	import type { Tweet } from '$lib/stores/dashboardStore';
	import type { UserAccount } from '$lib/types';
	import { createEventDispatcher } from 'svelte';
	import TweetPreview from '$lib/components/TweetPreview.svelte';
	import AccountDropdown from '$lib/components/AccountDropdown.svelte';
	import StyledSelect from '$lib/components/StyledSelect.svelte';

	export let tweets: Tweet[] = [];
	export let accounts: UserAccount[] = [];

	const dispatch = createEventDispatcher();
	
	// Transform accounts for dropdown with avatar support
	$: dropdownAccounts = accounts.map(account => ({
		id: (account.providerAccountId || account.id) as string,
		username: account.username,
		displayName: (account as any).displayName || account.username,
		avatarUrl: (account as any).profileImage || undefined
	}));

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

<div class="surface-card rounded-lg dark:bg-[#15202B]">
	<div class="px-4 py-5 sm:p-6">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="text-lg font-medium leading-6 text-surface-900 dark:text-surface-100">
				Scheduled Tweets
			</h3>
			<span class="text-sm text-surface-500 dark:text-surface-400">
				{filteredTweets.length} tweet{filteredTweets.length !== 1 ? 's' : ''}
			</span>
		</div>

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
		<div class="max-h-[800px] space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 dark:scrollbar-track-gray-800 dark:scrollbar-thumb-gray-600 dark:hover:scrollbar-thumb-gray-500">
			{#if sortedTweets.length > 0}
				{#each sortedTweets as tweet}
					{@const account = tweet.twitterAccountId ? accountByProviderId[tweet.twitterAccountId] : undefined}
					{@const displayDate = getDisplayDate(tweet)}
					<div class="group relative rounded-lg border border-surface-200 bg-surface-100 transition-all hover:bg-surface-200 dark:border-surface-700 dark:bg-surface-800 dark:hover:bg-surface-800/80">
						<!-- Status Badge & Actions - Responsive positioning -->
						<div class="relative z-10 flex flex-wrap items-center justify-end gap-2 p-3 pb-0 sm:absolute sm:right-3 sm:top-3 sm:p-0">
							<!-- Status Badge with Countdown -->
							{#if tweet.status === 'scheduled'}
								<span class="inline-flex items-center gap-1 rounded-full bg-surface-50 px-2 py-1 text-xs font-medium text-surface-700 ring-1 ring-inset ring-surface-600/20 dark:bg-surface-500/10 dark:text-surface-400 dark:ring-surface-500/30">
									<Clock class="h-3 w-3" />
									<span class="hidden xs:inline">{getTimeUntil(displayDate)}</span>
									<span class="xs:hidden">{getTimeUntil(displayDate).replace('in ', '')}</span>
								</span>
								<button
									type="button"
									on:click={() => handleEditTweet(tweet)}
									class="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-500 px-2.5 py-1 text-white ring-1 ring-inset ring-blue-600/20 transition-colors hover:bg-blue-600 dark:ring-blue-500/30 sm:gap-2 sm:px-3 sm:py-1.5"
									title="Edit scheduled tweet"
								>
									<CalendarIcon class="h-3 w-3 flex-shrink-0 sm:h-3.5 sm:w-3.5" />
									<Edit class="h-3 w-3 flex-shrink-0 sm:h-3.5 sm:w-3.5" />
								</button>
							{:else if tweet.status === 'queued'}
								<span class="inline-flex items-center gap-1 rounded-full bg-surface-50 px-2 py-1 text-xs font-medium text-surface-700 ring-1 ring-inset ring-surface-600/20 dark:bg-surface-500/10 dark:text-surface-400 dark:ring-surface-500/30">
									<Clock class="h-3 w-3" />
									<span class="hidden xs:inline">{getTimeUntil(displayDate)}</span>
									<span class="xs:hidden">{getTimeUntil(displayDate).replace('in ', '')}</span>
								</span>
								<button
									type="button"
									on:click={() => handleEditTweet(tweet)}
									class="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-500 px-2.5 py-1 text-white ring-1 ring-inset ring-blue-600/20 transition-colors hover:bg-blue-600 dark:ring-blue-500/30 sm:gap-2 sm:px-3 sm:py-1.5"
									title="Edit queued tweet"
								>
									<List class="h-3 w-3 flex-shrink-0 sm:h-3.5 sm:w-3.5" />
									<Edit class="h-3 w-3 flex-shrink-0 sm:h-3.5 sm:w-3.5" />
								</button>
							{/if}
							
							<!-- Delete Button -->
							<button
								type="button"
								on:click={() => handleDeleteTweet(tweet)}
								class="inline-flex items-center justify-center rounded-full bg-red-500 p-1.5 text-white ring-1 ring-inset ring-red-600/20 transition-colors hover:bg-red-600 dark:ring-red-500/30 sm:gap-2 sm:px-3 sm:py-1.5"
								title="Delete tweet"
							>
								<Trash2 class="h-3 w-3 flex-shrink-0 sm:h-3.5 sm:w-3.5" />
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
