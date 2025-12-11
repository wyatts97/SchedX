<!--
================================================================================
OVERVIEW TAB - TEMPORARILY DISABLED (COMING SOON)
================================================================================
The analytics/overview functionality has been temporarily disabled.
To restore, uncomment the original implementation below.
================================================================================
-->

<script lang="ts">
	import { BarChart3, Clock, Sparkles } from 'lucide-svelte';
</script>

<!-- Coming Soon Display -->
<div class="flex min-h-[60vh] items-center justify-center p-6">
	<div class="max-w-md text-center">
		<!-- Icon -->
		<div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 theme-lightsout:bg-blue-900/40">
			<BarChart3 class="h-10 w-10 text-blue-600 dark:text-blue-400 theme-lightsout:text-blue-300" />
		</div>
		
		<!-- Title -->
		<h2 class="mb-3 text-2xl font-bold text-gray-900 dark:text-white theme-lightsout:text-gray-100">
			Analytics Coming Soon
		</h2>
		
		<!-- Description -->
		<p class="mb-6 text-gray-600 dark:text-gray-400 theme-lightsout:text-gray-500">
			We're working on powerful analytics features to help you track your Twitter performance, 
			engagement metrics, and growth trends.
		</p>
		
		<!-- Feature Preview Cards -->
		<div class="mb-8 grid gap-4 sm:grid-cols-2">
			<div class="rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-700 theme-lightsout:bg-gray-900">
				<div class="mb-2 flex items-center gap-2">
					<Sparkles class="h-5 w-5 text-amber-500" />
					<span class="font-medium text-gray-900 dark:text-white theme-lightsout:text-gray-100">Smart Insights</span>
				</div>
				<p class="text-sm text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">
					AI-powered recommendations to optimize your content
				</p>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-700 theme-lightsout:bg-gray-900">
				<div class="mb-2 flex items-center gap-2">
					<Clock class="h-5 w-5 text-green-500" />
					<span class="font-medium text-gray-900 dark:text-white theme-lightsout:text-gray-100">Performance Trends</span>
				</div>
				<p class="text-sm text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">
					Track follower growth and engagement over time
				</p>
			</div>
		</div>
		
		<!-- Status Badge -->
		<div class="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 theme-lightsout:bg-blue-900/30 theme-lightsout:text-blue-300">
			<span class="relative flex h-2 w-2">
				<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
				<span class="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
			</span>
			In Development
		</div>
	</div>
</div>

<!--
================================================================================
ORIGINAL IMPLEMENTATION - COMMENTED OUT FOR FUTURE RESTORATION
================================================================================

<script lang="ts">
	import { onMount } from 'svelte';
	import { analytics, isLoading, error, lastUpdated, currentDateRange } from '$lib/stores/analyticsStore';
	import ActivitySummary from '../overview/ActivitySummary.svelte';
	import SmartInsights from '../overview/SmartInsights.svelte';
	import ContentMixChart from '../overview/ContentMixChart.svelte';
	import PerformanceTrends from '../overview/PerformanceTrends.svelte';
	import { Loader2, Info, RefreshCw, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { DateRange } from '$lib/types/analytics';
	import AccountDropdown from '$lib/components/AccountDropdown.svelte';
	
	let showTooltip = false;
	let syncError: string | null = null;
	let syncing = false;
	let syncProgress = { step: '', current: 0, total: 0, message: '' };
	let selectedAccountId = 'all';
	let accounts: any[] = [];
	let accountsStatus: any[] = [];
	let loadingAccounts = false;
	let isInitialLoad = true;

	function handleDateRangeChange(range: DateRange) {
		analytics.setDateRange(range);
	}

	onMount(async () => {
		await Promise.all([
			loadAccounts(),
			loadAccountsStatus(),
			analytics.fetch()
		]);
		isInitialLoad = false;
	});

	$: lastUpdatedText = $lastUpdated
		? new Date($lastUpdated).toLocaleString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
		  })
		: 'Never updated';

	async function handleDismissInsight(insightId: string) {
		await analytics.dismissInsight(insightId);
	}

	async function handleSyncAnalytics() {
		syncing = true;
		syncProgress = { step: 'Starting...', current: 0, total: 0, message: '' };
		
		const daysBack = $currentDateRange === '7d' ? 7 : 
		                 $currentDateRange === '30d' ? 30 : 
		                 $currentDateRange === '90d' ? 90 : 30;
		
		try {
			syncProgress = { step: 'import', current: 0, total: 100, message: 'Fetching account info...' };
			
			const accountsResponse = await fetch('/api/dashboard');
			if (!accountsResponse.ok) {
				throw new Error('Failed to fetch accounts');
			}
			
			const dashboardData = await accountsResponse.json();
			const twitterAccount = dashboardData.accounts?.find((acc: any) => acc.provider === 'twitter');
			
			if (!twitterAccount?.username) {
				throw new Error('No Twitter account found. Please connect a Twitter account first.');
			}

			syncProgress = { step: 'import', current: 10, total: 100, message: `Importing tweets from @${twitterAccount.username}...` };

			const importResponse = await fetch('/api/analytics/import-tweets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: twitterAccount.username,
					daysBack: daysBack,
					maxTweets: 500
				})
			});

			if (!importResponse.ok) {
				const importError = await importResponse.json().catch(() => ({}));
				throw new Error(importError.error || 'Failed to import tweets');
			}
			
			const importResult = await importResponse.json();
			const importedCount = importResult.stats?.imported ?? 0;
			const updatedCount = importResult.stats?.updated ?? 0;
			const totalFetched = importResult.stats?.fetched ?? 0;
			
			syncProgress = { 
				step: 'engagement', 
				current: 50, 
				total: 100, 
				message: `Imported ${importedCount} new, updated ${updatedCount} tweets. Syncing engagement...` 
			};

			const syncResponse = await fetch('/api/analytics/sync-engagement', {
				method: 'POST'
			});

			if (!syncResponse.ok) {
				const syncError = await syncResponse.json().catch(() => ({}));
				throw new Error(syncError.error || 'Failed to sync analytics data');
			}

			const result = await syncResponse.json();
			
			syncProgress = { step: 'complete', current: 100, total: 100, message: 'Sync complete!' };
			
			const syncedTweets = result.data?.totalTweetsSynced ?? 0;
			const successMsg = `Synced ${syncedTweets} tweets. ${importedCount > 0 ? `Imported ${importedCount} new tweets.` : ''}`;
			toast.success(successMsg);
			
			await Promise.all([
				analytics.fetch(),
				loadAccountsStatus()
			]);
		} catch (error) {
			console.error('Failed to sync analytics:', error);
			syncProgress = { step: 'error', current: 0, total: 0, message: '' };
			toast.error(error instanceof Error ? error.message : 'Failed to sync analytics data');
		} finally {
			syncing = false;
			setTimeout(() => {
				syncProgress = { step: '', current: 0, total: 0, message: '' };
			}, 2000);
		}
	}

	async function loadAccounts() {
		loadingAccounts = true;
		try {
			const response = await fetch('/api/dashboard');
			if (response.ok) {
				const data = await response.json();
				accounts = data.accounts?.filter((acc: any) => acc.provider === 'twitter') || [];
			}
		} catch (error) {
			console.error('Failed to load accounts:', error);
		} finally {
			loadingAccounts = false;
		}
	}

	async function loadAccountsStatus() {
		try {
			const response = await fetch('/api/analytics/account-sync');
			if (response.ok) {
				const data = await response.json();
				accountsStatus = data.accounts || [];
			}
		} catch (error) {
			console.error('Failed to load account status:', error);
		}
	}

	function handleAccountChange(accountId: string) {
		selectedAccountId = accountId;
	}

	$: dropdownAccounts = accounts.map(account => ({
		id: account.id,
		username: account.username,
		displayName: account.displayName || account.username,
		avatarUrl: account.profileImage || undefined
	}));

</script>

<div class="space-y-6 p-6 bg-gray-50 dark:bg-[#15202B] rounded-lg theme-lightsout:bg-gray-900/20">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white theme-lightsout:text-gray-200">Overview</h1>
			<div class="mt-1 flex items-center gap-2">
				<p class="text-sm text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-600">
					Last Updated: {lastUpdatedText}
				</p>
				<div class="relative">
					<button
						on:mouseenter={() => showTooltip = true}
						on:mouseleave={() => showTooltip = false}
						class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
						aria-label="Info about data sync"
					>
						<Info class="h-4 w-4" />
					</button>
					{#if showTooltip}
						<div class="absolute left-0 top-6 z-50 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-700 theme-lightsout:bg-gray-900">
							<p class="text-xs text-gray-700 dark:text-gray-300 theme-lightsout:text-gray-300">
							Analytics data is automatically synced daily at 3 AM UTC using Rettiwt-API. No rate limits or API keys required. Click "Sync Analytics Data" to manually refresh anytime.
						</p>
						</div>
					{/if}
				</div>
			</div>
			{#if syncError}
				<p class="mt-1 text-xs text-red-600 dark:text-red-400">
					Last sync error: {syncError}
				</p>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-3">
			{#if dropdownAccounts.length > 0}
				<div class="w-64">
					<AccountDropdown
						accounts={dropdownAccounts}
						bind:selectedAccount={selectedAccountId}
						onSelect={handleAccountChange}
						placeholder="All Accounts"
					/>
				</div>
			{/if}

			<div class="flex items-center gap-3">
				<button
					on:click={handleSyncAnalytics}
					disabled={syncing || $isLoading}
					class="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition-all duration-200 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 theme-lightsout:border-blue-700 theme-lightsout:bg-blue-900/30 theme-lightsout:text-blue-300"
					title="Sync all analytics data: tweets, followers, engagement metrics"
				>
					<RefreshCw class={syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
					{syncing ? 'Syncing...' : 'Sync Analytics Data'}
				</button>
				
				{#if syncing && syncProgress.message}
					<div class="flex items-center gap-2">
						<div class="h-2 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
							<div 
								class="h-full rounded-full bg-blue-500 transition-all duration-300"
								style="width: {syncProgress.current}%"
							></div>
						</div>
						<span class="text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">
							{syncProgress.message}
						</span>
					</div>
				{/if}
			</div>

			<select
				value={$currentDateRange}
				on:change={(e) => handleDateRangeChange(e.currentTarget.value as DateRange)}
				class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 theme-lightsout:border-gray-700 theme-lightsout:bg-gray-900/30 theme-lightsout:text-gray-200"
			>
				<option value="7d">Last 7 days</option>
				<option value="30d">Last 30 days</option>
				<option value="90d">Last 90 days</option>
			</select>
		</div>
	</div>

	{#if $error}
		<div
			class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200 theme-lightsout:border-red-700 theme-lightsout:bg-red-900/40 theme-lightsout:text-red-300"
		>
			<p class="text-sm text-red-800 dark:text-red-200 theme-lightsout:text-red-300">
				{$error}
			</p>
		</div>
	{/if}

	{#if (isInitialLoad || $isLoading) && !$analytics.data}
		<div class="flex items-center justify-center py-12">
			<div class="flex flex-col items-center gap-3">
				<Loader2 class="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 theme-lightsout:text-blue-300" />
				<p class="text-sm text-gray-600 dark:text-gray-400 theme-lightsout:text-gray-500">Loading analytics data...</p>
				<p class="text-xs text-gray-500 dark:text-gray-500 theme-lightsout:text-gray-600">This may take a moment on first load</p>
			</div>
		</div>
	{:else if $analytics.data}
		{#if accountsStatus.length > 0}
			<div class="surface-card rounded-lg p-6 surface-1 theme-lightsout:surface-2">
				<div class="mb-4 flex items-center gap-2">
					<Users class="h-5 w-5 text-blue-600 dark:text-blue-400" />
					<h2 class="text-lg font-semibold text-gray-900 dark:text-white theme-lightsout:text-gray-100">
						Account Sync Status
					</h2>
				</div>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each accountsStatus as account}
						<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-800 theme-lightsout:bg-gray-900">
							<div class="flex items-start gap-3">
								{#if account.profileImage}
									<img src={account.profileImage} alt={account.username} class="h-10 w-10 rounded-full" />
								{:else}
									<div class="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
										<Users class="h-5 w-5 text-blue-600 dark:text-blue-400" />
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<h3 class="font-semibold text-gray-900 dark:text-white truncate">
										@{account.username}
									</h3>
									<p class="text-xs text-gray-500 dark:text-gray-400">
										{account.followerCount?.toLocaleString() || 0} followers
									</p>
									<div class="mt-2 flex items-center gap-2">
										{#if account.last_sync_status === 'success'}
											<CheckCircle class="h-4 w-4 text-green-600 dark:text-green-400" />
											<span class="text-xs text-green-600 dark:text-green-400">Synced</span>
										{:else if account.last_sync_status === 'partial'}
											<AlertCircle class="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
											<span class="text-xs text-yellow-600 dark:text-yellow-400">
												Partial ({account.tweets_failed || 0} failed)
											</span>
										{:else if account.last_sync_status === 'failed'}
											<XCircle class="h-4 w-4 text-red-600 dark:text-red-400" />
											<span class="text-xs text-red-600 dark:text-red-400">Failed</span>
										{:else}
											<span class="text-xs text-gray-500 dark:text-gray-400">Not synced</span>
										{/if}
									</div>
									{#if account.last_error}
										<p class="mt-1 text-xs text-red-500 dark:text-red-400 truncate" title={account.last_error}>
											{account.last_error}
										</p>
									{/if}
									{#if account.last_sync_at}
										<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
											Last sync: {new Date(account.last_sync_at).toLocaleDateString()}
										</p>
									{/if}
									{#if account.tweets_synced !== undefined}
										<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
											{account.tweets_synced} tweets synced{#if account.tweets_failed > 0}, {account.tweets_failed} failed{/if}
										</p>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="surface-card rounded-lg p-6 surface-1 theme-lightsout:surface-2">
			<ActivitySummary summary={$analytics.data.activitySummary} />
		</div>

		<div class="surface-card rounded-lg p-6 surface-1 theme-lightsout:surface-2">
			<PerformanceTrends trends={$analytics.data.trends} />
		</div>

		<div class="surface-card rounded-lg p-6 surface-1 theme-lightsout:surface-2">
			<SmartInsights insights={$analytics.data.insights} onDismiss={handleDismissInsight} />
		</div>

		<div class="surface-card rounded-lg p-6 surface-1 theme-lightsout:surface-2">
			<ContentMixChart contentMix={$analytics.data.contentMix} />
		</div>
	{:else}
		<div class="queue-status-empty flex flex-col items-center justify-center rounded-lg p-4 theme-lightsout:bg-gray-900">
			<p class="text-sm text-red-800 dark:text-red-200 theme-lightsout:text-red-700">
				No analytics data available. Click refresh to load.
			</p>
		</div>
	{/if}
</div>

================================================================================
END OF COMMENTED OUT ORIGINAL IMPLEMENTATION
================================================================================
-->
