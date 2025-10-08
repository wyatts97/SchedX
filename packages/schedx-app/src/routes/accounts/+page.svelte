<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	// @ts-ignore
	import {
		UserPlus,
		UserMinus,
		Users,
		AlertTriangle,
		CheckCircle,
		XCircle,
		Loader2
	} from 'lucide-svelte';
	import type { PageData } from './$types';
	import logger from '$lib/logger';
	import { toastStore } from '$lib/stores/toastStore';

	export let data: PageData;

	let loading = false;
	let error = '';
	let accounts: any[] = [];
	let twitterApps: any[] = [];
	let processingAccountId = '';
	let pendingSuccessMessage = ''; // Track pending success message from URL params
	let pollingForAccount = false; // Track if we're polling for a new account
	let pollCount = 0;
	let maxPolls = 30;
	let showAppSelectionModal = false;
	let initialLoad = true; // Track if this is the first load


	const isAuthenticated = $page.data.isAuthenticated;

	// Check for URL parameters for success/error messages
	$: if (browser) {
		const urlParams = new URLSearchParams(window.location.search);
		const success = urlParams.get('success');
		const errorParam = urlParams.get('error');

		if (success === 'twitter_connected') {
			// Store the success message but don't show it yet
			pendingSuccessMessage = 'Twitter account connected successfully!';
			// Start polling for the new account
			pollingForAccount = true;
			pollCount = 0;
			// Clean URL immediately
			window.history.replaceState({}, '', '/accounts');
		} else if (errorParam) {
			toastStore.error('Connection Failed', decodeURIComponent(errorParam));
			// Clean URL
			window.history.replaceState({}, '', '/accounts');
		}
	}

	async function fetchAccounts() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/accounts');
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}
			const data = await res.json();
			if (data.accounts) {
				const previousAccountCount = accounts.length;
				accounts = data.accounts;

				// If we're polling for a new account and the count increased, stop polling
				if (pollingForAccount && accounts.length > previousAccountCount) {
					pollingForAccount = false;
					toastStore.success('Account Connected', pendingSuccessMessage);
					pendingSuccessMessage = ''; // Clear the pending message
				} else if (pendingSuccessMessage && accounts.length > 0 && !pollingForAccount) {
					// If we have a pending success message and accounts were loaded, show it now
					toastStore.success('Account Connected', pendingSuccessMessage);
					pendingSuccessMessage = ''; // Clear the pending message
				}
				// Don't show any toast on initial load or regular refreshes
			} else {
				error = data.error || 'Failed to load accounts';
				toastStore.error('Load Failed', error);
			}
		} catch (e) {
			error = 'Failed to load accounts';
			if (!initialLoad) {
				toastStore.error('Load Failed', error);
			}
		} finally {
			loading = false;
			initialLoad = false;
		}
	}

	async function fetchTwitterApps() {
		try {
			const res = await fetch('/api/twitter_apps');
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}
			const data = await res.json();
			if (data.apps) {
				twitterApps = data.apps;
			} else {
				logger.error('Failed to load Twitter apps:', data.error);
			}
		} catch (e) {
			logger.error('Failed to load Twitter apps:', { error: e });
		}
	}

	async function handleConnectNewAccount() {
		await fetchTwitterApps();
		showAppSelectionModal = true;
	}

	async function disconnectAccount(accountId: string) {
		// accountId should be providerAccountId, which is used as 'id' in the accounts array
		if (
			!confirm(
				'Are you sure you want to disconnect this Twitter account? This action cannot be undone.'
			)
		)
			return;

		processingAccountId = accountId;
		try {
			const res = await fetch('/api/accounts', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ accountId }) // accountId is providerAccountId
			});

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}

			const data = await res.json();
			if (data.success) {
				await fetchAccounts();
				toastStore.success('Account Disconnected', 'Account disconnected successfully');
			} else {
				error = data.error || 'Failed to disconnect account';
				toastStore.error('Disconnect Failed', error);
			}
		} catch (e) {
			error = 'Failed to disconnect account';
			toastStore.error('Disconnect Failed', error);
		} finally {
			processingAccountId = '';
		}
	}

	async function setDefaultAccount(accountId: string) {
		processingAccountId = accountId;
		try {
			const res = await fetch('/api/accounts/default', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ accountId })
			});

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}

			const data = await res.json();
			if (data.success) {
				await fetchAccounts();
				toastStore.success('Default Updated', 'Default account updated successfully');
			} else {
				error = data.error || 'Failed to set default account';
				toastStore.error('Update Failed', error);
			}
		} catch (e) {
			error = 'Failed to set default account';
			toastStore.error('Update Failed', error);
		} finally {
			processingAccountId = '';
		}
	}

	onMount(async () => {
		// Initialize Preline components
		if (browser) {
			const initPreline = () => {
				if (typeof window !== 'undefined' && window.HSStaticMethods) {
					logger.debug('Initializing Accounts page Preline components...');
					window.HSStaticMethods.autoInit();
				}
			};

			// Try multiple times to ensure Preline is loaded
			setTimeout(initPreline, 100);
			setTimeout(initPreline, 500);
			setTimeout(initPreline, 1000);
		}

		if (isAuthenticated) {
			// Add a longer delay to ensure database consistency after OAuth redirect
			if (pendingSuccessMessage) {
				await new Promise((resolve) => setTimeout(resolve, 1500));
			}

			// Try to fetch accounts with retry logic
			let retryCount = 0;
			const maxRetries = 3;

			while (retryCount < maxRetries) {
				try {
					await Promise.all([fetchAccounts(), fetchTwitterApps()]);

					// If we have accounts or no pending success message, break
					if (accounts.length > 0 || !pendingSuccessMessage) {
						break;
					}

					// If we have a pending success message but no accounts, wait and retry
					if (pendingSuccessMessage && accounts.length === 0) {
						retryCount++;
						if (retryCount < maxRetries) {
							await new Promise((resolve) => setTimeout(resolve, 1000));
							continue;
						}
					}
					break;
				} catch (error) {
					retryCount++;
					if (retryCount < maxRetries) {
						await new Promise((resolve) => setTimeout(resolve, 1000));
						continue;
					}
					// On final retry failure, show error
					toastStore.error('Load Failed', 'Failed to load accounts. Please refresh the page.');
				}
			}

			// Start polling if we're waiting for a new account
			if (pollingForAccount) {
				const pollInterval = setInterval(async () => {
					pollCount++;
					if (pollCount >= maxPolls) {
						clearInterval(pollInterval);
						pollingForAccount = false;
						toastStore.error('Connection Timeout', 'Account connection timed out. Please refresh the page.');
						return;
					}

					try {
						await fetchAccounts();
						// If we found the new account, stop polling
						if (!pollingForAccount) {
							clearInterval(pollInterval);
						}
					} catch (error) {
						logger.error('Polling error:', { error });
					}
				}, 1000);
			}
		}
	});
</script>

<svelte:head>
	<title>SchedX - Accounts</title>
	<meta name="description" content="Manage your connected Twitter accounts" />
</svelte:head>

<div class="mx-auto max-w-4xl p-6">
	<div class="mb-8">
		<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Twitter Accounts</h1>
		<p class="text-gray-600 dark:text-gray-400">
			Manage your connected Twitter accounts for scheduling tweets.
		</p>
	</div>

	<!-- Connected Accounts -->
	<div
		class="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
			<h2 class="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
				<Users class="mr-2 h-5 w-5" />
				Connected Accounts
				{#if loading || pollingForAccount}
					<Loader2 class="ml-2 h-4 w-4 animate-spin" />
				{/if}
			</h2>
		</div>

		<div class="p-6">
			{#if loading}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="h-6 w-6 animate-spin text-gray-400" />
					<span class="ml-2 text-gray-500 dark:text-gray-400">Loading accounts...</span>
				</div>
			{:else if pollingForAccount}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="h-6 w-6 animate-spin text-blue-500" />
					<span class="ml-2 text-gray-500 dark:text-gray-400"
						>Connecting your Twitter account...</span
					>
				</div>
			{:else if accounts.length === 0}
				<div class="py-8 text-center">
					<Users class="mx-auto mb-4 h-12 w-12 text-gray-400" />
					<h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
						No accounts connected
					</h3>
					<p class="mb-4 text-gray-500 dark:text-gray-400">
						Connect your first Twitter account to start scheduling tweets.
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each accounts as account}
						<div
							class="flex items-center justify-between rounded-lg bg-gray-50 p-4 dark:bg-gray-700"
						>
							<div class="flex items-center space-x-4">
								{#if account.profileImage}
									<img
										src={account.profileImage}
										alt={account.displayName}
										class="h-10 w-10 rounded-full"
									/>
								{:else}
									<div
										class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 dark:bg-gray-600"
									>
										<span class="font-medium text-gray-600 dark:text-gray-400"
											>{account.username.charAt(0).toUpperCase()}</span
										>
									</div>
								{/if}
								<div>
									<div class="flex items-center space-x-2">
										<h3 class="font-medium text-gray-900 dark:text-white">{account.displayName}</h3>
										<span class="text-sm text-gray-500 dark:text-gray-400">@{account.username}</span
										>
										{#if account.isDefault}
											<span
												class="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
											>
												Default
											</span>
										{/if}
									</div>
									<p class="text-sm text-gray-500 dark:text-gray-400">
										Connected via {account.twitterAppName || 'Unknown App'}
									</p>
								</div>
							</div>
							<div class="flex items-center space-x-2">
								{#if !account.isDefault}
									<button
										class="inline-flex items-center rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
										on:click={() => setDefaultAccount(account.id)}
										disabled={processingAccountId === account.id}
									>
										{#if processingAccountId === account.id}
											<Loader2 class="h-4 w-4 animate-spin" />
										{:else}
											Set Default
										{/if}
									</button>
								{/if}
								<button
									class="inline-flex items-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm transition-all duration-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-600 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
									on:click={() => disconnectAccount(account.id)}
									disabled={processingAccountId === account.id}
								>
									{#if processingAccountId === account.id}
										<Loader2 class="h-4 w-4 animate-spin" />
									{:else}
										<UserMinus class="h-4 w-4" />
									{/if}
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Connect New Account -->
	<div
		class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
			<h2 class="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
				<UserPlus class="mr-2 h-5 w-5" />
				Connect New Account
			</h2>
		</div>

		<div class="p-6">
			<div class="py-6 text-center">
				<UserPlus class="mx-auto mb-4 h-12 w-12 text-blue-500" />
				<h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
					Connect Twitter Account
				</h3>
				<p class="mb-4 text-gray-500 dark:text-gray-400">
					Connect a new Twitter account to SchedX.
				</p>
				<div class="flex flex-col justify-center space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
					<button
						class="inline-flex items-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						on:click={handleConnectNewAccount}
					>
						<UserPlus class="mr-2 h-4 w-4" />
						Connect New Account
					</button>
				</div>
			</div>
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
				<div class="space-y-2">
					{#each twitterApps as app}
						<a
							href={`/api/auth/signin/twitter?twitterAppId=${app.id}`}
							class="block rounded-lg border border-gray-200 p-4 text-center transition-all duration-200 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700"
						>
							{app.appName}
						</a>
					{/each}
				</div>
			{:else}
				<p class="mb-4 text-gray-600 dark:text-gray-400">
					You need to create a Twitter app in the admin panel before you can connect an account.
				</p>
				<a
					href="/"
					class="inline-flex items-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					Go to Admin Panel
				</a>
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
