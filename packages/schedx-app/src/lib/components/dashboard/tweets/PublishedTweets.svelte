<script lang="ts">
    import TweetEmbedSimple from '$lib/components/TweetEmbedSimple.svelte';
    import { FileText, Loader2, AlertCircle, Filter, Search } from 'lucide-svelte';
    import type { Tweet as TweetType } from '$lib/stores/dashboardStore';
    import type { UserAccount } from '$lib/types';

    export let tweets: TweetType[] = [];
    export let accounts: UserAccount[] = [];

    // Debug: Log when component receives data
    $: if (tweets.length > 0) {
        console.log('PublishedTweets component - tweets:', tweets);
        console.log('PublishedTweets component - accounts:', accounts);
    }

    // Filter and sort state
    let selectedAccount = 'all';
    let sortBy: 'date' | 'engagement' = 'date';
    let searchQuery = '';
    let currentPage = 1;
    let itemsPerPage = 10;

    // Get theme for embedded tweets
    let theme: 'light' | 'dark' = 'light';
    $: if (typeof document !== 'undefined') {
        const isDark = document.documentElement.classList.contains('dark');
        theme = isDark ? 'dark' : 'light';
    }

    // Create account lookup map
    $: accountByProviderId = accounts.reduce((acc: any, account: any) => {
        acc[account.providerAccountId] = account;
        return acc;
    }, {});

    // Filter published tweets only
    $: publishedTweets = tweets.filter(t => t.status === 'posted' && t.twitterTweetId);
    $: if (publishedTweets.length > 0) {
        console.log('Filtered published tweets:', publishedTweets);
        console.log('Account lookup map:', accountByProviderId);
    }

    // Apply filters
    $: filteredTweets = publishedTweets.filter(tweet => {
        // Account filter
        if (selectedAccount !== 'all' && tweet.twitterAccountId !== selectedAccount) {
            return false;
        }
        // Search filter
        if (searchQuery && !tweet.content.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }
        return true;
    });

    // Sort tweets
    $: sortedTweets = [...filteredTweets].sort((a, b) => {
        if (sortBy === 'date') {
            return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
        }
        // For engagement, we'd need actual metrics from Twitter API
        return 0;
    });

    // Pagination
    $: totalPages = Math.ceil(sortedTweets.length / itemsPerPage);
    $: paginatedTweets = sortedTweets.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );
    $: if (paginatedTweets.length > 0) {
        console.log('Paginated tweets to display:', paginatedTweets);
        paginatedTweets.forEach(tweet => {
            const link = getTweetLink(tweet);
            console.log(`Tweet ${tweet.id}: link = ${link}`);
        });
    }

    // Build tweet link for embed
    function getTweetLink(tweet: TweetType): string | null {
        if (!tweet.twitterAccountId || !tweet.twitterTweetId) return null;
        const account = accountByProviderId[tweet.twitterAccountId];
        if (!account) return null;

        // Clean username - remove any URL prefix if present
        let username = account.username;
        if (username.startsWith('https://twitter.com/')) {
            username = username.replace('https://twitter.com/', '');
        }
        if (username.startsWith('http://twitter.com/')) {
            username = username.replace('http://twitter.com/', '');
        }
        if (username.startsWith('https://x.com/')) {
            username = username.replace('https://x.com/', '');
        }
        if (username.startsWith('http://x.com/')) {
            username = username.replace('http://x.com/', '');
        }
        if (username.startsWith('@')) {
            username = username.substring(1);
        }

        const tweetLink = `${username}/status/${tweet.twitterTweetId}`;
        console.log('Generated tweetLink:', tweetLink, 'from username:', account.username);
        return tweetLink;
    }

    function handlePageChange(page: number) {
        currentPage = page;
    }
</script>

<div class="rounded-lg bg-white shadow dark:bg-gray-800">
    <div class="px-4 py-5 sm:p-6">
        <div class="mb-4 flex items-center justify-between">
            <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                Published Tweets
            </h3>
            <span class="text-sm text-gray-500 dark:text-gray-400">
                {filteredTweets.length} tweet{filteredTweets.length !== 1 ? 's' : ''}
            </span>
        </div>

        <!-- Filters -->
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <!-- Account Filter -->
            <div class="flex-1">
                <label for="account-filter" class="sr-only">Filter by account</label>
                <select
                    id="account-filter"
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

			<!-- Search -->
			<div class="flex-1">
				<label for="search-tweets" class="sr-only">Search tweets</label>
				<div class="relative">
					<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
					<input
						id="search-tweets"
						type="text"
						bind:value={searchQuery}
						placeholder="Search tweets..."
						class="block w-full rounded-lg border-gray-300 bg-gray-50 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
					/>
				</div>
			</div>

			<!-- Sort -->
			<div class="w-full sm:w-auto">
				<label for="sort-by" class="sr-only">Sort by</label>
				<select
					id="sort-by"
					bind:value={sortBy}
					class="block w-full rounded-lg border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
				>
					<option value="date">Latest First</option>
					<option value="engagement">Most Engaged</option>
				</select>
			</div>
		</div>

		<!-- Tweet List -->
		<div class="max-h-[800px] space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 dark:scrollbar-track-gray-800 dark:scrollbar-thumb-gray-600 dark:hover:scrollbar-thumb-gray-500">
			{#if paginatedTweets.length > 0}
				{#each paginatedTweets as tweet}
					{@const tweetLink = getTweetLink(tweet)}
					{#if tweetLink}
						<div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
							<TweetEmbedSimple tweetLink={tweetLink} theme={theme} />
						</div>
					{:else}
						<div class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
							<div class="flex items-center gap-2 text-red-700 dark:text-red-400">
								<AlertCircle class="h-5 w-5" />
								<p class="text-sm">Unable to load tweet embed (missing data)</p>
								<p class="text-xs">Tweet ID: {tweet.id}, Account: {tweet.twitterAccountId}, TweetID: {tweet.twitterTweetId}</p>
							</div>
						</div>
					{/if}
				{/each}
			{:else if searchQuery || selectedAccount !== 'all'}
				<div class="py-12 text-center">
					<Filter class="mx-auto h-12 w-12 text-gray-400" />
					<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No tweets found</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Try adjusting your filters or search query.
					</p>
				</div>
			{:else}
				<div class="py-12 text-center">
					<FileText class="mx-auto h-12 w-12 text-gray-400" />
					<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No published tweets yet</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Published tweets will appear here.
					</p>
				</div>
			{/if}
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
				<button
					on:click={() => handlePageChange(currentPage - 1)}
					disabled={currentPage === 1}
					class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				>
					Previous
				</button>
				<span class="text-sm text-gray-700 dark:text-gray-300">
					Page {currentPage} of {totalPages}
				</span>
				<button
					on:click={() => handlePageChange(currentPage + 1)}
					disabled={currentPage === totalPages}
					class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				>
					Next
				</button>
			</div>
		{/if}
	</div>
</div>
