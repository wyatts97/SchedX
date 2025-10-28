<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Edit3 } from 'lucide-svelte';
	import { adminProfile, fetchAdminProfile } from '$lib/components/adminProfile';
	import { dashboardStore } from '$lib/stores/dashboardStore';
	import StatsOverview from '$lib/components/dashboard/StatsOverview.svelte';
	import TweetsTab from '$lib/components/dashboard/tabs/TweetsTab.svelte';
	import OverviewTab from '$lib/components/dashboard/tabs/OverviewTab.svelte';
	import AccountsTab from '$lib/components/dashboard/tabs/AccountsTab.svelte';
	import AppFormModal from '$lib/components/dashboard/AppFormModal.svelte';
	import TweetCreate from '$lib/components/TweetCreate.svelte';
	import TweetPreview from '$lib/components/TweetPreview.svelte';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import { MessageSquare, LayoutDashboard, Users } from 'lucide-svelte';
	import logger from '$lib/logger';

	let activeTab = 'tweets';
	let dashboardError: Error | null = null;
	let isInitializing = true;
	let showEditTweetModal = false;
	let editingTweet: any = null;
	let previewContent = '';
	let previewMedia: { url: string; type: string }[] = [];

	$: isAdmin = $page.data.isAdmin;
	$: isAuthenticated = $page.data.isAuthenticated;

	// Check for tab parameter in URL
	$: if (browser && $page.url.searchParams.has('tab')) {
		const tabParam = $page.url.searchParams.get('tab');
		if (tabParam === 'tweets' || tabParam === 'overview' || tabParam === 'accounts') {
			activeTab = tabParam;
		}
	}

	// Load dashboard data from page server data (no API call needed)
	const loadDashboardData = async () => {
		try {
			dashboardStore.setLoading(true);

			// Use data already loaded by the page server
			const dashboardData = {
				apps: $page.data.apps || [],
				analytics: $page.data.analytics || {},
				tweets: $page.data.tweets || [],
				accounts: $page.data.accounts || []
			};

			// Check if there was an error from the page server
			if ($page.data.error) {
				throw new Error($page.data.error);
			}

			dashboardStore.setData(dashboardData);

			logger.info('Dashboard data loaded successfully', {
				appsCount: dashboardData.apps?.length || 0,
				tweetsCount: dashboardData.tweets?.length || 0,
				analytics: dashboardData.analytics,
				source: 'page-server'
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to load dashboard data';
			dashboardError = error instanceof Error ? error : new Error(errorMessage);

			dashboardStore.setError(errorMessage);

			logger.error('Dashboard data loading failed', {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				pageDataError: $page.data.error
			});
		}
	};

	// Function to refresh dashboard data by making individual API calls
	const refreshDashboardData = async () => {
		try {
			dashboardStore.setLoading(true);

			logger.info('Refreshing dashboard data...');

			// Use the same endpoints as the page server
			const [appsRes, analyticsRes, tweetsRes] = await Promise.all([
				fetch('/api/twitter_apps'),
				fetch('/api/admin/analytics'),
				fetch('/api/admin/tweets')
			]);

			// Check if all requests were successful
			if (!appsRes.ok || !analyticsRes.ok || !tweetsRes.ok) {
				const failedRequests = [];
				if (!appsRes.ok) failedRequests.push(`twitter_apps: ${appsRes.status}`);
				if (!analyticsRes.ok) failedRequests.push(`analytics: ${analyticsRes.status}`);
				if (!tweetsRes.ok) failedRequests.push(`tweets: ${tweetsRes.status}`);

				throw new Error(`API requests failed: ${failedRequests.join(', ')}`);
			}

			const [apps, analytics, tweets] = await Promise.all([
				appsRes.json(),
				analyticsRes.json(),
				tweetsRes.json()
			]);

			const dashboardData = {
				apps: apps.apps || apps || [],
				analytics: analytics.analytics || analytics || {},
				tweets: tweets.tweets || tweets || [],
				accounts: $page.data.accounts || []
			};

			dashboardStore.setData(dashboardData);

			logger.info('Dashboard data refreshed successfully', {
				appsCount: dashboardData.apps?.length || 0,
				tweetsCount: dashboardData.tweets?.length || 0,
				source: 'api-refresh'
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to refresh dashboard data';
			dashboardError = error instanceof Error ? error : new Error(errorMessage);

			dashboardStore.setError(errorMessage);

			logger.error('Dashboard data refresh failed', {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined
			});

			// Fallback to existing page data if refresh fails
			if ($page.data.apps || $page.data.analytics || $page.data.tweets) {
				dashboardStore.setData({
					apps: $page.data.apps || [],
					analytics: $page.data.analytics || {},
					tweets: $page.data.tweets || []
				});
				dashboardStore.setError(`${errorMessage} (using cached data)`);
			}
		}
	};

	const handleTabChange = (newTab: string) => {
		activeTab = newTab;
		logger.debug('Dashboard tab changed', { tab: newTab });
	};

	function handleEditTweet(event: CustomEvent) {
		editingTweet = event.detail;
		showEditTweetModal = true;
		// Initialize preview with existing content
		previewContent = editingTweet.content || '';
		previewMedia = editingTweet.media || [];
		logger.debug('Opening edit tweet modal', { tweetId: editingTweet.id });
	}

	function handleCloseEditModal() {
		showEditTweetModal = false;
		editingTweet = null;
	}

	async function handleTweetSubmit() {
		// Refresh dashboard data after tweet is updated
		await refreshDashboardData();
		handleCloseEditModal();
	}

	async function handleDeleteTweet(event: CustomEvent) {
		const tweet = event.detail;
		const statusLabel = tweet.status === 'scheduled' ? 'scheduled tweet' : 
							tweet.status === 'queued' ? 'queued tweet' : 
							tweet.status === 'draft' ? 'draft' : 'tweet';
		
		if (!confirm(`Are you sure you want to delete this ${statusLabel}? This action cannot be undone.`)) {
			return;
		}

		try {
			const response = await fetch(`/api/tweets/${tweet.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete tweet');
			}

			// Refresh dashboard data
			await refreshDashboardData();
		} catch (error) {
			logger.error('Failed to delete tweet:', { error });
			alert('Failed to delete tweet. Please try again.');
		}
	}

	onMount(async () => {
		try {
			if (browser) {
				const initPreline = () => {
					if (typeof window !== 'undefined' && window.HSStaticMethods) {
						window.HSStaticMethods.autoInit();
					}
				};

				// Reduced timeout calls for better performance
				setTimeout(initPreline, 100);
				setTimeout(initPreline, 1000);
			}

			// Check authentication first
			if (!isAuthenticated || !isAdmin) {
				logger.warn('Unauthorized access attempt to dashboard', {
					isAuthenticated,
					isAdmin,
					path: $page.url.pathname
				});
				goto('/login');
				return;
			}

			// Load admin profile
			if (isAuthenticated && isAdmin) {
				try {
					await fetchAdminProfile();
				} catch (error) {
					logger.error('Failed to fetch admin profile', {
						error: error instanceof Error ? error.message : error
					});
				}
			}

			// Load dashboard data
			await loadDashboardData();
		} catch (error) {
			dashboardError =
				error instanceof Error ? error : new Error('Dashboard initialization failed');
			logger.error('Dashboard mount error', {
				error: error instanceof Error ? error.message : error
			});
		} finally {
			isInitializing = false;
		}
	});
</script>

<svelte:head>
	<title>Dashboard - SchedX</title>
</svelte:head>

<ErrorBoundary error={dashboardError} errorId="dashboard-main">
	{#if !isAuthenticated || !isAdmin}
		<LoadingSpinner message="Redirecting to login..." fullScreen={true} />
	{:else if isInitializing}
		<LoadingSpinner message="Loading dashboard..." fullScreen={true} />
	{:else}
		<div class="space-y-6">
			<!-- Dashboard Header -->
			<div class="mb-8">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div class="min-w-0 flex-1">
						<h1 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Dashboard</h1>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400 sm:text-base">
							Welcome back, {$adminProfile.displayName || 'Administrator'}. Here's what's happening
							with your tweets today.
						</p>
					</div>
					<div class="flex items-center space-x-3">
						<a
							href="/post"
							class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:px-6 sm:py-3"
							aria-label="Create a new tweet"
						>
							<Edit3 class="mr-2 h-4 w-4" aria-hidden="true" />
							Create Tweet
						</a>
					</div>
				</div>
			</div>

			<!-- Error Display -->
			{#if $dashboardStore.error}
				<div
					class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
					role="alert"
					aria-live="polite"
				>
					<div class="flex">
						<div class="flex-shrink-0">
							<svg
								class="h-5 w-5 text-red-400"
								viewBox="0 0 20 20"
								fill="currentColor"
								aria-hidden="true"
							>
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<h3 class="text-sm font-medium text-red-800 dark:text-red-200">Dashboard Error</h3>
							<p class="mt-1 text-sm text-red-700 dark:text-red-300">
								{$dashboardStore.error}
							</p>
							<div class="mt-3">
								<button
									on:click={refreshDashboardData}
									class="text-sm font-medium text-red-800 underline hover:text-red-900 dark:text-red-200 dark:hover:text-red-100"
								>
									Refresh Data
								</button>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Loading State -->
			{#if $dashboardStore.isLoading}
				<LoadingSpinner message="Loading dashboard data..." size="lg" />
			{:else}
				<!-- Tab Navigation with Preline Style -->
				<div class="border-b border-gray-200 dark:border-gray-700">
					<nav class="-mb-px flex space-x-8" aria-label="Dashboard sections" role="tablist">
						<button
							type="button"
							class="inline-flex items-center gap-x-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50 {activeTab ===
							'tweets'
								? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
								: 'border-transparent text-gray-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-500'}"
							on:click={() => handleTabChange('tweets')}
							role="tab"
							aria-selected={activeTab === 'tweets'}
							aria-controls="tweets-tab-panel"
						>
							<MessageSquare class="h-4 w-4 flex-shrink-0" />
							Tweets
						</button>
						<button
							type="button"
							class="inline-flex items-center gap-x-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50 {activeTab ===
							'overview'
								? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
								: 'border-transparent text-gray-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-500'}"
							on:click={() => handleTabChange('overview')}
							role="tab"
							aria-selected={activeTab === 'overview'}
							aria-controls="overview-tab-panel"
						>
							<LayoutDashboard class="h-4 w-4 flex-shrink-0" />
							Overview
						</button>
						<button
							type="button"
							class="inline-flex items-center gap-x-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50 {activeTab ===
							'accounts'
								? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
								: 'border-transparent text-gray-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-500'}"
							on:click={() => handleTabChange('accounts')}
							role="tab"
							aria-selected={activeTab === 'accounts'}
							aria-controls="accounts-tab-panel"
						>
							<Users class="h-4 w-4 flex-shrink-0" />
							Accounts
						</button>
					</nav>
				</div>

				<!-- Tab Content -->
				<div class="mt-6">
					{#if activeTab === 'tweets'}
						<div id="tweets-tab-panel" role="tabpanel" aria-labelledby="tweets-tab">
							<ErrorBoundary errorId="tweets-tab">
								<TweetsTab
									tweets={$dashboardStore.data.tweets}
									accounts={$dashboardStore.data.accounts}
									on:editTweet={handleEditTweet}
									on:deleteTweet={handleDeleteTweet}
								/>
							</ErrorBoundary>
						</div>
					{:else if activeTab === 'overview'}
						<div id="overview-tab-panel" role="tabpanel" aria-labelledby="overview-tab">
							<ErrorBoundary errorId="overview-tab">
								<OverviewTab
									analytics={$dashboardStore.data.analytics}
									apps={$dashboardStore.data.apps}
									tweets={$dashboardStore.data.tweets}
									accounts={$dashboardStore.data.accounts}
									on:editTweet={handleEditTweet}
									on:deleteTweet={handleDeleteTweet}
								/>
							</ErrorBoundary>
						</div>
					{:else if activeTab === 'accounts'}
						<div id="accounts-tab-panel" role="tabpanel" aria-labelledby="accounts-tab">
							<ErrorBoundary errorId="accounts-tab">
								<AccountsTab
									accounts={$dashboardStore.data.accounts}
									tweets={$dashboardStore.data.tweets}
									apps={$dashboardStore.data.apps}
								/>
							</ErrorBoundary>
						</div>
					{/if}
				</div>
			{/if}

			<!-- App Form Modal -->
			{#if $dashboardStore.ui.showAppForm}
				<ErrorBoundary errorId="app-form-modal">
					<AppFormModal editingApp={$dashboardStore.ui.editingApp} />
				</ErrorBoundary>
			{/if}
		</div>
	{/if}

	<!-- Edit Tweet Modal (Outside main container to cover entire viewport) -->
	{#if showEditTweetModal && editingTweet}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto overscroll-contain">
			<div class="relative w-full max-w-2xl my-8 rounded-lg bg-white shadow-xl dark:bg-gray-800 max-h-[90vh] flex flex-col overflow-hidden">
				<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700 flex-shrink-0">
					<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Edit Tweet</h2>
					<button
						on:click={handleCloseEditModal}
						aria-label="Close edit tweet modal"
						class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
					>
						<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<div class="overflow-y-auto overflow-x-hidden overscroll-contain p-6 space-y-6">
					<TweetCreate
						mode="edit"
						tweetId={editingTweet.id}
						initialContent={editingTweet.content}
						initialMedia={editingTweet.media || []}
						accounts={$dashboardStore.data.accounts.filter((acc: any) => acc.id) as any}
						selectedAccountId={editingTweet.twitterAccountId}
						on:submit={handleTweetSubmit}
						on:contentInput={(e) => previewContent = e.detail}
						on:changeMedia={(e) => previewMedia = e.detail}
					/>
					
					<!-- Tweet Preview -->
					{#each $dashboardStore.data.accounts.filter((acc) => acc.providerAccountId === editingTweet.twitterAccountId) as account}
						{#if previewContent || editingTweet.content}
							<div class="border-t border-gray-200 pt-6 dark:border-gray-700">
								<h3 class="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Preview</h3>
								<TweetPreview
									avatarUrl={account.profileImage || '/avatar.png'}
									displayName={account.displayName || account.username}
									username={account.username}
									content={previewContent || editingTweet.content}
									media={previewMedia.length > 0 ? previewMedia : (editingTweet.media || [])}
									createdAt={new Date()}
								/>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	{/if}
</ErrorBoundary>
