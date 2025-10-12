<script lang="ts">
	import { ExternalLink, Edit, CheckCircle, Clock, X, List, FileEdit, FileText, Trash2 } from 'lucide-svelte';
	import type { Tweet } from '$lib/stores/dashboardStore';
	import { createEventDispatcher } from 'svelte';
	import TweetPreview from '$lib/components/TweetPreview.svelte';

	export let tweets: Tweet[] | undefined = undefined;
	export let accounts: any[] = [];

	const dispatch = createEventDispatcher();

	// Create a map of accounts by providerAccountId for quick lookup
	$: accountByProviderId = accounts.reduce((acc: any, account: any) => {
		acc[account.providerAccountId] = account;
		return acc;
	}, {});

	function handleEditTweet(tweet: Tweet) {
		dispatch('editTweet', tweet);
	}

	function handleDeleteTweet(tweet: Tweet) {
		dispatch('deleteTweet', tweet);
	}

	// Get the display date based on tweet status
	function getDisplayDate(tweet: Tweet): Date {
		if (tweet.status === 'posted') {
			// For posted tweets, show when it was posted
			return new Date(tweet.updatedAt || tweet.createdAt);
		} else if (tweet.status === 'scheduled' || tweet.status === 'queued') {
			// For scheduled/queued, show when it will be published
			return tweet.scheduledDate ? new Date(tweet.scheduledDate) : new Date(tweet.createdAt);
		} else {
			// For drafts, show when it was created
			return new Date(tweet.createdAt);
		}
	}
</script>

<div class="rounded-lg bg-white shadow dark:bg-gray-800">
	<div class="px-4 py-5 sm:p-6">
		<h3 class="mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-white">
			Recent Activity
		</h3>
		<!-- Scrollable container with custom scrollbar -->
		<div class="max-h-[600px] space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 dark:scrollbar-track-gray-800 dark:scrollbar-thumb-gray-600 dark:hover:scrollbar-thumb-gray-500 theme-lightsout:scrollbar-track-black theme-lightsout:scrollbar-thumb-gray-800 theme-lightsout:hover:scrollbar-thumb-gray-700">
			{#if tweets && tweets.length > 0}
				{@const sortedTweets = [...tweets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
				{#each sortedTweets.slice(0, 5) as tweet}
					{@const account = tweet.twitterAccountId ? accountByProviderId[tweet.twitterAccountId] : undefined}
					{@const displayDate = getDisplayDate(tweet)}
					<div class="group relative rounded-lg border border-gray-200 bg-white transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-800/80">
						<!-- Status Badge - Top right corner -->
						<div class="absolute right-3 top-3 z-10 flex gap-2">
							<!-- Combined Status Badge (icon-only for all screen sizes) -->
							{#if tweet.status === 'posted' && account}
								{@const tweetId = tweet.twitterTweetId || (tweet as any).twitterTweetId}
								{#if tweetId}
									<a
										href="https://twitter.com/{account.username}/status/{tweetId}"
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/30 hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors cursor-pointer"
										title="Posted - Click to view on Twitter"
									>
										<CheckCircle class="h-3.5 w-3.5" />
										<div class="h-3.5 w-px bg-green-600/20 dark:bg-green-500/30"></div>
										<ExternalLink class="h-3.5 w-3.5" />
									</a>
								{:else}
									<span
										class="inline-flex items-center justify-center rounded-full px-4 py-1.5 bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/30"
										title="Posted"
									>
										<CheckCircle class="h-3.5 w-3.5" />
									</span>
								{/if}
							{:else if tweet.status === 'scheduled'}
								<button
									type="button"
									on:click={() => handleEditTweet(tweet)}
									class="inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors cursor-pointer"
									title="Scheduled - Click to edit"
								>
									<Clock class="h-3.5 w-3.5 flex-shrink-0" />
									<div class="h-3.5 w-px bg-blue-600/20 dark:bg-blue-500/30"></div>
									<Edit class="h-3.5 w-3.5 flex-shrink-0" />
								</button>
								<button
									type="button"
									on:click={() => handleDeleteTweet(tweet)}
									class="inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors cursor-pointer"
									title="Delete scheduled tweet"
								>
									<Trash2 class="h-3.5 w-3.5 flex-shrink-0" />
								</button>
							{:else if tweet.status === 'queued'}
								<button
									type="button"
									on:click={() => handleEditTweet(tweet)}
									class="inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/30 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors cursor-pointer"
									title="Queued - Click to edit"
								>
									<List class="h-3.5 w-3.5 flex-shrink-0" />
									<div class="h-3.5 w-px bg-purple-600/20 dark:bg-purple-500/30"></div>
									<Edit class="h-3.5 w-3.5 flex-shrink-0" />
								</button>
								<button
									type="button"
									on:click={() => handleDeleteTweet(tweet)}
									class="inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors cursor-pointer"
									title="Delete queued tweet"
								>
									<Trash2 class="h-3.5 w-3.5 flex-shrink-0" />
								</button>
							{:else if tweet.status === 'draft'}
								<button
									type="button"
									on:click={() => handleEditTweet(tweet)}
									class="inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/30 hover:bg-gray-100 dark:hover:bg-gray-500/20 transition-colors cursor-pointer"
									title="Draft - Click to edit"
								>
									<FileEdit class="h-3.5 w-3.5 flex-shrink-0" />
									<div class="h-3.5 w-px bg-gray-600/20 dark:bg-gray-500/30"></div>
									<Edit class="h-3.5 w-3.5 flex-shrink-0" />
								</button>
								<button
									type="button"
									on:click={() => handleDeleteTweet(tweet)}
									class="inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors cursor-pointer"
									title="Delete draft"
								>
									<Trash2 class="h-3.5 w-3.5 flex-shrink-0" />
								</button>
							{:else if tweet.status === 'failed'}
								<span
									class="inline-flex items-center justify-center rounded-full px-4 py-1.5 bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30"
									title="Failed"
								>
									<X class="h-3.5 w-3.5" />
								</span>
							{/if}
						</div>

						<!-- Tweet Preview (without interaction buttons) -->
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
			{:else}
				<div class="py-8 text-center">
					<FileText class="mx-auto h-12 w-12 text-gray-400" />
					<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No tweets yet</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Get started by creating your first tweet.
					</p>
					<div class="mt-6">
						<a
							href="/post"
							class="inline-flex items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						>
							Create Tweet
						</a>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>