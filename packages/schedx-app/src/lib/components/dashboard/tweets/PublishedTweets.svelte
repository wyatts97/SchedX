<script lang="ts">
    import TweetPreview from '$lib/components/TweetPreview.svelte';
    import AccountDropdown from '$lib/components/AccountDropdown.svelte';
    import { FileText, Loader2, AlertCircle, Filter, Search, ExternalLink, RefreshCw } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';
    import type { Tweet as TweetType } from '$lib/stores/dashboardStore';
    import type { UserAccount } from '$lib/types';

    export let tweets: TweetType[] = [];
    
    // Track which tweets are currently refreshing
    let refreshingTweets: Set<string> = new Set();
    
    // Local tweet stats cache (for immediate UI updates after refresh)
    let tweetStats: Map<string, { likeCount: number; retweetCount: number; replyCount: number; impressionCount: number; bookmarkCount: number }> = new Map();
    
    // Version counter to force reactivity when tweetStats changes
    let statsVersion = 0;
    export let accounts: UserAccount[] = [];
    
    // Transform accounts for dropdown with avatar support
    $: dropdownAccounts = accounts.map(account => ({
        id: (account.providerAccountId || account.id) as string,
        username: account.username,
        displayName: (account as any).displayName || account.username,
        avatarUrl: (account as any).profileImage || undefined
    }));

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
    $: accountById = accounts.reduce((acc: any, account: any) => {
        // Use providerAccountId as the key to align with tweet.twitterAccountId
        const key = account.providerAccountId || account.id;
        acc[key] = account;
        return acc;
    }, {});

    // Filter published tweets only (case-insensitive status check)
    $: publishedTweets = tweets.filter(
        (t) => (t.status ? t.status.toLowerCase() === 'posted' : false) && t.twitterTweetId
    );

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
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        // Sort by engagement (likes + retweets + replies)
        const aStats = getTweetStats(a);
        const bStats = getTweetStats(b);
        const aEngagement = aStats.likeCount + aStats.retweetCount + aStats.replyCount;
        const bEngagement = bStats.likeCount + bStats.retweetCount + bStats.replyCount;
        return bEngagement - aEngagement;
    });

    // Pagination
    $: totalPages = Math.ceil(sortedTweets.length / itemsPerPage);
    $: paginatedTweets = sortedTweets.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Build tweet link for embed
    function getTweetLink(tweet: TweetType): string | null {
        if (!tweet.twitterAccountId || !tweet.twitterTweetId) return null;
        const account = accountById[tweet.twitterAccountId];
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
        return tweetLink;
    }

    function handlePageChange(page: number) {
        currentPage = page;
    }
    
    // Get stats for a tweet (from cache or original data)
    function getTweetStats(tweet: TweetType) {
        const cached = tweetStats.get(tweet.id!);
        if (cached) return cached;
        return {
            likeCount: tweet.likeCount || 0,
            retweetCount: tweet.retweetCount || 0,
            replyCount: tweet.replyCount || 0,
            impressionCount: tweet.impressionCount || 0,
            bookmarkCount: (tweet as any).bookmarkCount || 0
        };
    }
    
    // Refresh stats for a single tweet
    async function refreshTweetStats(tweetId: string) {
        if (refreshingTweets.has(tweetId)) return;
        
        refreshingTweets.add(tweetId);
        refreshingTweets = refreshingTweets; // Trigger reactivity
        
        try {
            const response = await fetch(`/api/tweets/${tweetId}/refresh-stats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Failed to refresh stats' }));
                throw new Error(error.message || 'Failed to refresh stats');
            }
            
            const result = await response.json();
            
            // Update local cache with new stats
            tweetStats.set(tweetId, result.stats);
            tweetStats = tweetStats; // Trigger reactivity
            statsVersion++; // Force re-render of stats
            
            // Show info toast if stats are cached (API couldn't fetch fresh data)
            if (result.cached) {
                toast.info('Stats unavailable', {
                    description: 'Twitter API could not fetch fresh stats. Try again in a few minutes.'
                });
            }
            
        } catch (error: any) {
            console.error('Failed to refresh tweet stats:', error);
            toast.error('Refresh failed', {
                description: error.message || 'Could not refresh tweet stats'
            });
        } finally {
            refreshingTweets.delete(tweetId);
            refreshingTweets = refreshingTweets; // Trigger reactivity
        }
    }
</script>

<div class="surface-card rounded-lg dark:bg-[#15202B]">
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
                <AccountDropdown
                    accounts={dropdownAccounts}
                    bind:selectedAccount
                    onSelect={(id) => { selectedAccount = id; }}
                    placeholder="Filter by account"
                />
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
                        class="input-surface block w-full rounded-lg py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                    />
                </div>
            </div>
        </div>

        <!-- Tweet List -->
        <div class="max-h-[800px] space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 dark:scrollbar-track-gray-800 dark:scrollbar-thumb-gray-600 dark:hover:scrollbar-thumb-gray-500">
            {#if paginatedTweets.length > 0}
                {#each paginatedTweets as tweet (tweet.id + '-' + statsVersion)}
                    {@const account = tweet.twitterAccountId ? accountById[tweet.twitterAccountId] : null}
                    {#if account}
                        {@const stats = getTweetStats(tweet)}
                        <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-800 theme-lightsout:bg-black">
                            <div class="tweet-preview-wrapper [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
                            <TweetPreview
                                avatarUrl={account.profileImage || '/avatar.png'}
                                displayName={account.displayName || account.username}
                                username={account.username}
                                content={tweet.content}
                                media={tweet.media || []}
                                createdAt={tweet.createdAt}
                                replies={stats.replyCount}
                                retweets={stats.retweetCount}
                                likes={stats.likeCount}
                                bookmarks={stats.bookmarkCount}
                                views={stats.impressionCount}
                                hideActions={false}
                            >
                                <svelte:fragment slot="actions">
                                    {#if tweet.twitterTweetId}
                                        <button
                                            on:click={() => refreshTweetStats(tweet.id!)}
                                            disabled={refreshingTweets.has(tweet.id!)}
                                            class="inline-flex items-center justify-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 theme-lightsout:bg-gray-900 theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-800"
                                            title="Refresh engagement stats"
                                        >
                                            <RefreshCw class="h-3.5 w-3.5 {refreshingTweets.has(tweet.id!) ? 'animate-spin' : ''}" />
                                        </button>
                                        <a
                                            href={`https://twitter.com/${account.username}/status/${tweet.twitterTweetId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="inline-flex items-center justify-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 theme-lightsout:bg-blue-900/30 theme-lightsout:text-blue-300 theme-lightsout:hover:bg-blue-900/40"
                                            title="View on Twitter/X"
                                        >
                                            <ExternalLink class="h-3.5 w-3.5" />
                                        </a>
                                    {/if}
                                </svelte:fragment>
                            </TweetPreview>
                            </div>
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
            <div class="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700 theme-lightsout:border-gray-800">
                <button
                    on:click={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 theme-lightsout:border-gray-700 theme-lightsout:bg-gray-900 theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-800"
                >
                    Previous
                </button>
                <span class="text-sm text-gray-700 dark:text-gray-300 theme-lightsout:text-gray-400">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    on:click={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 theme-lightsout:border-gray-700 theme-lightsout:bg-gray-900 theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-800"
                >
                    Next
                </button>
            </div>
        {/if}
    </div>
</div>
