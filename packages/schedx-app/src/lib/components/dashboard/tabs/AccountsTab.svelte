<script lang="ts">
	import { UserPlus, Users } from 'lucide-svelte';
	import QuickActions from '../QuickActions.svelte';
	import TwitterAppsTable from '../TwitterAppsTable.svelte';
	import type { UserAccount, TwitterApp, Tweet } from '$lib/types';
	import logger from '$lib/logger';

	export let accounts: UserAccount[] = [];
	export let tweets: Tweet[] = [];
	export let apps: TwitterApp[] = [];

	let showAppSelectionModal = false;
	let twitterApps: TwitterApp[] = [];

	async function handleConnectNewAccount() {
		// Fetch latest Twitter apps
		try {
			const res = await fetch('/api/twitter_apps');
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}
			const data = await res.json();
			if (data.apps) {
				twitterApps = data.apps;
				logger.info('Twitter apps loaded for connection', {
					count: twitterApps.length,
					apps: twitterApps.map(app => ({ id: app.id, name: app.name }))
				});
			}
		} catch (e) {
			logger.error('Failed to load Twitter apps:', { error: e });
		}
		showAppSelectionModal = true;
	}
</script>

<div class="space-y-6">
	<!-- Connected Accounts Section -->
	<div class="rounded-lg bg-white shadow dark:bg-gray-800">
		<div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
			<div class="flex items-center justify-between">
				<h2 class="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
					<Users class="mr-2 h-5 w-5" />
					Connected Accounts
				</h2>
				<button
					on:click={handleConnectNewAccount}
					class="inline-flex items-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					<UserPlus class="mr-2 h-4 w-4" />
					Connect New Account
				</button>
			</div>
		</div>
		<div class="p-6">
			<QuickActions {accounts} {tweets} />
		</div>
	</div>

	<!-- Twitter Apps Management Section -->
	<div class="rounded-lg bg-white shadow dark:bg-gray-800">
		<div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
				Twitter Apps
			</h2>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Manage your Twitter OAuth applications used for account connections.
			</p>
		</div>
		<div class="p-6">
			<TwitterAppsTable {apps} />
		</div>
	</div>
</div>

<!-- App Selection Modal -->
{#if showAppSelectionModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
		<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Select a Twitter App</h2>
			{#if twitterApps.length > 0}
				<p class="mb-4 text-gray-600 dark:text-gray-400">
					Choose a Twitter app to connect your account.
				</p>
				<div class="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
					<strong>Note:</strong> To connect a different Twitter account, make sure you're logged into that account on Twitter/X.com first, or use an incognito/private browser window.
				</div>
				<div class="space-y-2">
					{#each twitterApps as app}
						<a
							href={`/api/auth/signin/twitter?twitterAppId=${app.id}`}
							class="block rounded-lg border border-gray-200 p-4 text-center font-medium text-gray-900 transition-all duration-200 hover:bg-gray-100 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700"
						>
							{app.name}
						</a>
					{/each}
				</div>
			{:else}
				<p class="mb-4 text-gray-600 dark:text-gray-400">
					You need to create a Twitter app before you can connect an account.
				</p>
				<button
					on:click={() => (showAppSelectionModal = false)}
					class="inline-flex items-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					Close
				</button>
			{/if}
			<button
				class="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				on:click={() => (showAppSelectionModal = false)}
			>
				Cancel
			</button>
		</div>
	</div>
{/if}
