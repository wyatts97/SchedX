<script lang="ts">
	import { FileText, ExternalLink, Edit } from 'lucide-svelte';
	import type { Tweet } from '$lib/stores/dashboardStore';
	import { createEventDispatcher } from 'svelte';

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
</script>

<div class="rounded-lg bg-white shadow dark:bg-gray-800">
	<div class="px-4 py-5 sm:p-6">
		<h3 class="mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-white">
			Recent Activity
		</h3>
		<div class="space-y-4">
			{#if tweets && tweets.length > 0}
				{@const sortedTweets = [...tweets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
				{#each sortedTweets.slice(0, 5) as tweet}
					{@const account = tweet.twitterAccountId ? accountByProviderId[tweet.twitterAccountId] : undefined}
					<div class="flex items-start space-x-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50">
						<!-- Account Avatar -->
						<div class="flex-shrink-0">
							<img
								src={account?.profileImage || '/avatar.png'}
								alt={account?.displayName || account?.username || 'Account'}
							/>
						</div>

						<!-- Tweet Content -->
						<div class="min-w-0 flex-1">
							<!-- Account Name & Date/Time -->
							<div class="mb-1 flex items-center gap-2">
								<p class="text-sm font-semibold text-gray-900 dark:text-white">
									{account?.displayName || account?.username || 'Unknown Account'}
								</p>
								<span class="text-xs text-gray-500 dark:text-gray-400">
									{new Date(tweet.createdAt).toLocaleDateString()} at {new Date(tweet.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
								</span>
							</div>

							<!-- Tweet Text -->
							<p class="text-sm text-gray-700 dark:text-gray-300">
								{tweet.content}
							</p>
						</div>

						<!-- Status Badge & Action Buttons Column -->
						<div class="flex flex-col items-end gap-2">
							<!-- Status Badge -->
							<span
								class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold {tweet.status === 'scheduled'
									? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30'
									: tweet.status === 'posted'
										? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/30'
										: tweet.status === 'draft'
											? 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/30'
											: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30'}"
							>
								{tweet.status === 'scheduled'
									? 'Scheduled'
									: tweet.status === 'posted'
										? 'Posted'
										: tweet.status === 'draft'
											? 'Draft'
											: 'Failed'}
							</span>

							<!-- View Tweet Button (for posted tweets) -->
							{#if tweet.status === 'posted' && account}
								<a
									href="https://twitter.com/{account.username}/status/{(tweet as any).twitterTweetId || (tweet as any).id}"
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
								>
									<ExternalLink class="h-3 w-3" />
									View Tweet
								</a>
							{/if}

							<!-- Edit Button (for scheduled/draft tweets) -->
							{#if tweet.status === 'scheduled' || tweet.status === 'draft'}
								<button
									type="button"
									on:click={() => handleEditTweet(tweet)}
									class="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
								>
									<Edit class="h-3 w-3" />
									Edit
								</button>
							{/if}
						</div>
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