<script lang="ts">
	import { FileText, ExternalLink, Edit, CheckCircle, Clock, X, List, FileEdit } from 'lucide-svelte';
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

	// Format timestamp like Twitter (e.g., "2h", "Oct 9", etc.)
	function formatTwitterTime(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'now';
		if (diffMins < 60) return `${diffMins}m`;
		if (diffHours < 24) return `${diffHours}h`;
		if (diffDays < 7) return `${diffDays}d`;
		
		// For older tweets, show date like "Oct 9"
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Get the display time based on tweet status
	function getDisplayTime(tweet: Tweet): string | null {
		if (tweet.status === 'draft') return null;
		
		try {
			if (tweet.status === 'posted') {
				// For posted tweets, show time since posted (using createdAt or updatedAt)
				const date = tweet.updatedAt || tweet.createdAt;
				return date ? formatTwitterTime(new Date(date)) : null;
			}
			// For scheduled/queued, show the scheduled time as if it's posted
			return tweet.scheduledDate ? formatTwitterTime(new Date(tweet.scheduledDate)) : null;
		} catch (e) {
			console.error('Error formatting time:', e);
			return null;
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
					{@const displayTime = getDisplayTime(tweet)}
					<div class="group relative rounded-lg border border-gray-200 bg-white p-4 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-800/80">
						<!-- Status Badge with integrated actions - Top Right -->
						<div class="absolute right-3 top-3">
							<!-- Combined Status Badge (icon-only for all screen sizes) -->
							{#if tweet.status === 'posted' && account}
								{@const tweetId = tweet.twitterTweetId || (tweet as any).twitterTweetId}
								{#if tweetId}
									<a
										href="https://twitter.com/{account.username}/status/{tweetId}"
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex items-center justify-center gap-1 rounded-full p-1.5 bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/30 hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors cursor-pointer"
										title="Posted - Click to view on Twitter"
									>
										<CheckCircle class="h-4 w-4" />
										<ExternalLink class="h-3 w-3 opacity-60" />
									</a>
								{:else}
									<span
										class="inline-flex items-center justify-center rounded-full p-1.5 bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/30"
										title="Posted"
									>
										<CheckCircle class="h-4 w-4" />
									</span>
								{/if}
							{:else if tweet.status === 'scheduled'}
								<button
									type="button"
									on:click={() => handleEditTweet(tweet)}
									class="inline-flex items-center justify-center gap-1 rounded-full p-1.5 bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors cursor-pointer"
									title="Scheduled - Click to edit"
								>
									<Clock class="h-4 w-4" />
									<Edit class="h-3 w-3 opacity-60" />
								</button>
							{:else if tweet.status === 'queued'}
								<button
									type="button"
									on:click={() => handleEditTweet(tweet)}
									class="inline-flex items-center justify-center gap-1 rounded-full p-1.5 bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/30 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors cursor-pointer"
									title="Queued - Click to edit"
								>
									<List class="h-4 w-4" />
									<Edit class="h-3 w-3 opacity-60" />
								</button>
							{:else if tweet.status === 'draft'}
								<button
									type="button"
									on:click={() => handleEditTweet(tweet)}
									class="inline-flex items-center justify-center gap-1 rounded-full p-1.5 bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/30 hover:bg-gray-100 dark:hover:bg-gray-500/20 transition-colors cursor-pointer"
									title="Draft - Click to edit"
								>
									<FileEdit class="h-4 w-4" />
									<Edit class="h-3 w-3 opacity-60" />
								</button>
							{:else if tweet.status === 'failed'}
								<span
									class="inline-flex items-center justify-center rounded-full p-1.5 bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30"
									title="Failed"
								>
									<X class="h-4 w-4" />
								</span>
							{/if}
						</div>

						<!-- Twitter-style tweet preview (reduced padding) -->
						<div class="flex gap-3 pr-16">
							<!-- Avatar -->
							<div class="flex-shrink-0">
								<img
									src={account?.profileImage || '/avatar.png'}
									alt={account?.displayName || account?.username || 'Account'}
									class="h-10 w-10 rounded-full"
								/>
							</div>

							<!-- Tweet content -->
							<div class="min-w-0 flex-1">
								<!-- Header: Name, username, time -->
								<div class="mb-1 flex items-center gap-1.5 text-sm">
									<span class="font-bold text-gray-900 dark:text-white">
										{account?.displayName || account?.username || 'Unknown'}
									</span>
									<span class="text-gray-500 dark:text-gray-400">
										@{account?.username || 'unknown'}
									</span>
									{#if displayTime}
										<span class="text-gray-500 dark:text-gray-400">·</span>
										<span class="text-gray-500 dark:text-gray-400">
											{displayTime}
										</span>
									{/if}
								</div>

								<p class="whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
									{tweet.content}
								</p>

								<!-- Media preview if present -->
								{#if tweet.media && tweet.media.length > 0}
									<div class="mt-3 grid gap-2 {tweet.media.length === 1 ? 'grid-cols-1' : tweet.media.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}">
										{#each tweet.media.slice(0, 4) as media}
											<div class="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
												<img
													src={media.url}
													alt="Tweet media"
													class="{tweet.media.length === 1 ? 'max-h-64' : 'h-32'} w-full object-cover"
												/>
											</div>
										{/each}
									</div>
								{/if}
							</div>
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