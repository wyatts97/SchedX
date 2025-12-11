<script lang="ts">
	import { onMount } from 'svelte';
	import { RefreshCw, UserPlus, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import type { UserAccount, Tweet } from '$lib/types';
	import type { AccountStats, AccountStatsResponse } from '$lib/types/analytics';
	import AccountProfileCard from './AccountProfileCard.svelte';
	import { toast } from 'svelte-sonner';

	export let accounts: UserAccount[] = [];
	export let tweets: Tweet[] = [];

	let accountStats: Map<string, AccountStats> = new Map();
	let isLoadingStats = false;
	let lastFetchTime: Date | null = null;
	
	// Horizontal scroll
	let scrollContainer: HTMLDivElement;
	let canScrollLeft = false;
	let canScrollRight = false;
	
	function updateScrollButtons() {
		if (!scrollContainer) return;
		canScrollLeft = scrollContainer.scrollLeft > 0;
		canScrollRight = scrollContainer.scrollLeft < scrollContainer.scrollWidth - scrollContainer.clientWidth - 1;
	}
	
	function scrollLeft() {
		if (!scrollContainer) return;
		scrollContainer.scrollBy({ left: -340, behavior: 'smooth' });
	}
	
	function scrollRight() {
		if (!scrollContainer) return;
		scrollContainer.scrollBy({ left: 340, behavior: 'smooth' });
	}

	// Fetch real-time account stats from Rettiwt API
	async function fetchAccountStats() {
		if (accounts.length === 0) return;
		
		isLoadingStats = true;
		try {
			const response = await fetch('/api/analytics/account-stats');
			if (!response.ok) {
				throw new Error(`Failed to fetch stats: ${response.statusText}`);
			}
			
			const data: AccountStatsResponse = await response.json();
			
			// Map stats by account ID for easy lookup
			// Create new Map to trigger Svelte reactivity
			const newStats = new Map<string, AccountStats>();
			for (const stat of data.accounts) {
				newStats.set(stat.accountId, stat);
			}
			accountStats = newStats;
			
			lastFetchTime = new Date();
		} catch (error) {
			console.error('Failed to fetch account stats:', error);
			// Don't show error toast on initial load - stats are optional
		} finally {
			isLoadingStats = false;
		}
	}

	// Manual refresh
	async function handleRefresh() {
		toast.info('Refreshing account stats...');
		await fetchAccountStats();
		if (accountStats.size > 0) {
			toast.success('Account stats updated');
		}
	}

	// Fetch stats on mount
	onMount(() => {
		fetchAccountStats();
		// Initial check for scroll buttons after a brief delay for DOM to settle
		setTimeout(updateScrollButtons, 100);
		
		// Update scroll buttons on window resize
		const handleResize = () => updateScrollButtons();
		window.addEventListener('resize', handleResize);
		
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});

	// Reactive: rebuild stats lookup when accountStats changes
	$: statsLookup = accountStats;
	
	// Update scroll buttons when accounts change
	$: if (accounts.length > 0) {
		setTimeout(updateScrollButtons, 100);
	}
</script>

<div class="space-y-4">
	<!-- Header with Refresh Button -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			{#if lastFetchTime}
				<span class="text-xs text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">
					Updated {lastFetchTime.toLocaleTimeString()}
				</span>
			{/if}
		</div>
		<button
			on:click={handleRefresh}
			disabled={isLoadingStats}
			class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700 theme-lightsout:border-gray-800 theme-lightsout:bg-gray-900 theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-800"
		>
			<RefreshCw class="h-3.5 w-3.5 {isLoadingStats ? 'animate-spin' : ''}" />
			Refresh Stats
		</button>
	</div>

	<!-- Account Cards Horizontal Scroll -->
	{#if accounts && accounts.length > 0}
		<div class="relative">
			<!-- Left Arrow -->
			{#if canScrollLeft}
				<button
					on:click={scrollLeft}
					class="absolute -left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl dark:border-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 theme-lightsout:border-gray-800 theme-lightsout:bg-gray-900 theme-lightsout:hover:bg-gray-800"
					aria-label="Scroll left"
				>
					<ChevronLeft class="h-5 w-5 text-gray-600 dark:text-gray-300 theme-lightsout:text-gray-400" />
				</button>
			{/if}
			
			<!-- Scrollable Container -->
			<div
				bind:this={scrollContainer}
				on:scroll={updateScrollButtons}
				class="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-2 md:snap-none [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{#each accounts as account (account.id)}
					<div class="w-[280px] flex-shrink-0 snap-center sm:w-[320px] md:snap-align-none">
						<AccountProfileCard
							{account}
							stats={statsLookup.get(account.id) || null}
							{tweets}
							isLoading={isLoadingStats}
						/>
					</div>
				{/each}
			</div>
			
			<!-- Right Arrow -->
			{#if canScrollRight}
				<button
					on:click={scrollRight}
					class="absolute -right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl dark:border-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 theme-lightsout:border-gray-800 theme-lightsout:bg-gray-900 theme-lightsout:hover:bg-gray-800"
					aria-label="Scroll right"
				>
					<ChevronRight class="h-5 w-5 text-gray-600 dark:text-gray-300 theme-lightsout:text-gray-400" />
				</button>
			{/if}
		</div>
	{:else}
		<div class="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center dark:border-gray-700 dark:bg-slate-800/50 theme-lightsout:border-gray-800 theme-lightsout:bg-gray-900/50">
			<UserPlus class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 theme-lightsout:text-gray-600" />
			<h3 class="mt-4 text-sm font-semibold text-gray-900 dark:text-white theme-lightsout:text-gray-100">
				No accounts connected
			</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">
				Connect your Twitter/X accounts to start scheduling posts.
			</p>
			<a
				href="/accounts"
				class="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
			>
				<UserPlus class="h-4 w-4" />
				Connect Account
			</a>
		</div>
	{/if}
</div>
