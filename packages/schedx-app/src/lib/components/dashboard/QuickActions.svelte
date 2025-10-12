<script lang="ts">
	import { Edit3, Calendar, FileText } from 'lucide-svelte';
	import type { UserAccount, Tweet } from '$lib/types';

	export let accounts: UserAccount[] = [];
	export let tweets: Tweet[] = [];

	// Calculate stats for each account
	function getAccountStats(accountId: string) {
		const accountTweets = tweets.filter(t => t.twitterAccountId === accountId);
		return {
			published: accountTweets.filter(t => t.status === 'posted').length,
			scheduled: accountTweets.filter(t => t.status === 'scheduled').length,
			drafts: accountTweets.filter(t => t.status === 'draft').length
		};
	}
</script>

<div class="rounded-lg bg-white shadow dark:bg-gray-800">
	<div class="px-4 py-5 sm:p-6">
		<h3 class="mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-white">
			Connected Accounts
		</h3>
		
		<!-- Scrollable container -->
		<div class="max-h-[600px] space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 dark:scrollbar-track-gray-800 dark:scrollbar-thumb-gray-600 dark:hover:scrollbar-thumb-gray-500 theme-lightsout:scrollbar-track-black theme-lightsout:scrollbar-thumb-gray-800 theme-lightsout:hover:scrollbar-thumb-gray-700">
			{#if accounts && accounts.length > 0}
				{#each accounts as account}
					{@const stats = getAccountStats(account.providerAccountId)}
					<div class="overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
						<!-- Profile Header -->
						<div class="relative">
							<!-- Banner (placeholder gradient) -->
							<div class="h-20 bg-gradient-to-r from-blue-400 to-purple-500"></div>
							
							<!-- Avatar -->
							<div class="absolute -bottom-8 left-4">
								<img
									src={account.profileImage || '/avatar.png'}
									alt={account.displayName || account.username}
									class="h-16 w-16 rounded-full border-4 border-white dark:border-gray-800"
								/>
							</div>
						</div>

						<!-- Profile Info -->
						<div class="px-4 pb-4 pt-10">
							<div class="mb-3">
								<h4 class="font-bold text-gray-900 dark:text-white">
									{account.displayName || account.username}
								</h4>
								<p class="text-sm text-gray-500 dark:text-gray-400">
									@{account.username}
								</p>
							</div>

							<!-- Stats -->
							<div class="mb-3 flex gap-4 text-sm">
								<div>
									<span class="font-semibold text-gray-900 dark:text-white">{stats.published}</span>
									<span class="text-gray-500 dark:text-gray-400"> Published</span>
								</div>
								<div>
									<span class="font-semibold text-gray-900 dark:text-white">{stats.scheduled}</span>
									<span class="text-gray-500 dark:text-gray-400"> Scheduled</span>
								</div>
								<div>
									<span class="font-semibold text-gray-900 dark:text-white">{stats.drafts}</span>
									<span class="text-gray-500 dark:text-gray-400"> Drafts</span>
								</div>
							</div>

							<!-- Action Buttons (responsive layout) -->
							<div class="flex flex-col gap-2 sm:flex-row">
								<a
									href="/post?account={account.id}"
									class="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
								>
									<Edit3 class="h-4 w-4" />
									<span>Post</span>
								</a>
								<a
									href="/post?account={account.id}&action=schedule"
									class="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-700 hover:shadow-md dark:bg-orange-600 dark:hover:bg-orange-700"
								>
									<Calendar class="h-4 w-4" />
									<span>Schedule</span>
								</a>
								<a
									href="/post?account={account.id}&action=draft"
									class="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-purple-700 hover:shadow-md dark:bg-purple-600 dark:hover:bg-purple-700"
								>
									<FileText class="h-4 w-4" />
									<span>Draft</span>
								</a>
							</div>
						</div>
					</div>
				{/each}
			{:else}
				<div class="py-8 text-center">
					<p class="text-sm text-gray-500 dark:text-gray-400">
						No accounts connected yet
					</p>
					<a
						href="/accounts"
						class="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
					>
						Connect Account
					</a>
				</div>
			{/if}
		</div>
	</div>
</div>
