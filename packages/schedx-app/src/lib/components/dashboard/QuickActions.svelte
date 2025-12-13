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
	
	// Preline carousel config (stored as variable to avoid Svelte parsing issues)
	const carouselConfig = JSON.stringify({
		loadingClasses: "opacity-0",
		isAutoHeight: true,
		isCentered: true,
		isDraggable: true
	});
	
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

	// Fetch stats on mount and init carousel
	onMount(() => {
		fetchAccountStats();
		// Init Preline carousel after DOM renders
		setTimeout(() => {
			if (typeof window !== 'undefined' && (window as any).HSCarousel) {
				(window as any).HSCarousel.autoInit();
			}
		}, 100);
	});

	// Reactive: rebuild stats lookup when accountStats changes
	$: statsLookup = accountStats;
	
	// Re-init carousel when accounts change
	$: if (accounts.length > 0 && typeof window !== 'undefined') {
		setTimeout(() => {
			if ((window as any).HSCarousel) {
				(window as any).HSCarousel.autoInit();
			}
		}, 150);
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

	<!-- Account Cards - Preline Carousel for Mobile, Grid for Desktop -->
	{#if accounts && accounts.length > 0}
		<!-- Mobile: Preline Carousel (centered, full-width cards) -->
		<div class="block md:hidden">
			<div 
				data-hs-carousel={carouselConfig}
				class="relative"
			>
				<div class="hs-carousel relative w-full overflow-hidden">
					<div class="hs-carousel-body flex flex-nowrap gap-4 opacity-0 transition-transform duration-700">
						{#each accounts as account (account.id)}
							<div class="hs-carousel-slide w-full flex-shrink-0 snap-center px-2">
								<AccountProfileCard
									{account}
									stats={statsLookup.get(account.id || '') || null}
									{tweets}
									isLoading={isLoadingStats}
								/>
							</div>
						{/each}
					</div>
				</div>
				
				<!-- Navigation Arrows -->
				{#if accounts.length > 1}
					<button 
						type="button" 
						class="hs-carousel-prev hs-carousel-disabled:opacity-50 hs-carousel-disabled:pointer-events-none absolute inset-y-0 start-0 z-10 flex w-10 items-center justify-center text-gray-800 dark:text-white"
					>
						<span class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-slate-800 theme-lightsout:border-gray-800 theme-lightsout:bg-gray-900">
							<ChevronLeft class="h-5 w-5" />
						</span>
						<span class="sr-only">Previous</span>
					</button>
					<button 
						type="button" 
						class="hs-carousel-next hs-carousel-disabled:opacity-50 hs-carousel-disabled:pointer-events-none absolute inset-y-0 end-0 z-10 flex w-10 items-center justify-center text-gray-800 dark:text-white"
					>
						<span class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-slate-800 theme-lightsout:border-gray-800 theme-lightsout:bg-gray-900">
							<ChevronRight class="h-5 w-5" />
						</span>
						<span class="sr-only">Next</span>
					</button>
					
					<!-- Pagination Dots -->
					<div class="hs-carousel-pagination mt-4 flex justify-center gap-2"></div>
				{/if}
			</div>
		</div>
		
		<!-- Desktop: Horizontal scroll with flex -->
		<div class="hidden md:block">
			<div class="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{#each accounts as account (account.id)}
					<div class="w-[340px] flex-shrink-0 lg:w-[320px]">
						<AccountProfileCard
							{account}
							stats={statsLookup.get(account.id || '') || null}
							{tweets}
							isLoading={isLoadingStats}
						/>
					</div>
				{/each}
			</div>
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
