<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import type { Tweet } from '$lib/types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	// @ts-ignore
	import { AlertTriangle } from 'lucide-svelte';
	import { Search, X } from 'lucide-svelte';
	import VideoModal from '$lib/components/VideoModal.svelte';
	import { constructTweetUrl } from '$lib/utils/twitter';
	import { ExternalLink } from 'lucide-svelte';
	import logger from '$lib/logger';

	export let data: PageData;

	let selectedAccountId = data.selectedAccountId;

	interface AccountInfo {
		id: string;
		userId: string;
		username: string;
		provider: string;
		providerAccountId: string;
		displayName?: string;
		profileImage?: string;
		isDefault?: boolean;
		createdAt: Date;
		updatedAt?: Date;
	}

	let accountByProviderId: Record<string, AccountInfo> = {};
	$: if (data?.accounts) {
		accountByProviderId = data.accounts.reduce((acc: Record<string, AccountInfo>, account: any) => {
			acc[account.providerAccountId] = account as AccountInfo;
			return acc;
		}, {});
	}

	const handleAccountChange = (event: Event) => {
		const accountId = (event.target as HTMLSelectElement).value;
		const url = new URL(window.location.href);
		url.searchParams.set('twitterAccountId', accountId);
		window.location.href = url.toString();
	};

	// Lightbox state (reuse from gallery behavior)
	let showImageModal = false;
	let showVideoModal = false;
	let modalImageUrl = '';
	let modalVideoUrl = '';

	const openImageModal = (url: string) => {
		modalImageUrl = url;
		showImageModal = true;
	};

	const openVideoModal = (url: string) => {
		modalVideoUrl = url;
		showVideoModal = true;
	};

	const closeImageModal = () => {
		showImageModal = false;
		modalImageUrl = '';
	};

	const closeVideoModal = () => {
		showVideoModal = false;
		modalVideoUrl = '';
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			closeImageModal();
			closeVideoModal();
		}
	};

	onMount(() => {
		// Initialize Preline components
		if (browser) {
			const initPreline = () => {
				if (typeof window !== 'undefined' && window.HSStaticMethods) {
					logger.debug('Initializing History page Preline components...');
					window.HSStaticMethods.autoInit();
				}
			};

			// Try multiple times to ensure Preline is loaded
			setTimeout(initPreline, 100);
			setTimeout(initPreline, 500);
			setTimeout(initPreline, 1000);

			window.addEventListener('keydown', handleKeydown);
			return () => {
				window.removeEventListener('keydown', handleKeydown);
			};
		}
	});
</script>

<svelte:head>
	<title>SchedX - History</title>
	<meta name="description" content="View your sent tweets history" />
</svelte:head>

<div class="mx-auto max-w-3xl">
	<h1 class="theme-dark:text-white mb-6 text-3xl font-bold text-gray-900 dark:text-white">
		Your Tweet History
	</h1>

	{#if !data.accounts || data.accounts.length === 0}
		<div
			class="mb-4 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
		>
			<AlertTriangle class="h-6 w-6 shrink-0 stroke-current" />
			<span
				>No Twitter apps configured. Please configure Twitter API credentials in <a
					href="/"
					class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
					>Dashboard</a
				> first.</span
			>
		</div>
	{/if}

	<!-- Twitter Account Selector -->
	<div class="mb-6">
		<label
			class="theme-dark:text-[#8899a6] mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
			for="twitterAccountId"
		>
			Twitter Account
		</label>
		<select
			id="twitterAccountId"
			name="twitterAccountId"
			bind:value={selectedAccountId}
			class="theme-dark:bg-[#253341] theme-dark:border-[#38444d] theme-dark:text-white theme-dark:placeholder-[#8899a6] block w-full rounded-lg border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
			on:change={handleAccountChange}
		>
			{#each data.accounts as account}
				<option value={account.providerAccountId}
					>{account.username} ({account.providerAccountId})</option
				>
			{/each}
		</select>
	</div>

	{#if data.tweets && data.tweets.length > 0}
		<div class="grid grid-cols-1 gap-4">
			{#each data.tweets as tweet (tweet.id)}
				<!-- Card with media on the right -->
				<div
					class="hover:shadow-2xs focus:outline-hidden group block rounded-lg border border-gray-200 bg-white dark:border-neutral-700 dark:bg-gray-800"
				>
					<div class="relative flex items-center overflow-hidden">
						{#if tweet.media && tweet.media.length > 0}
							{#if tweet.media[0].type === 'video'}
								<video
									class="absolute inset-y-0 right-0 h-full w-32 rounded-e-lg object-cover sm:w-48"
									src={tweet.media[0].url}
									muted
									playsinline
									preload="metadata"
								/>
							{:else}
								<img
									class="absolute inset-y-0 right-0 h-full w-32 rounded-e-lg object-cover sm:w-48"
									src={tweet.media[0].url}
									alt="Tweet media"
									loading="lazy"
								/>
							{/if}

							<!-- Hover View Button (magnifying glass) -->
							<div
								class="absolute bottom-2 right-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
							>
								<button
									class="flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-gray-800 shadow-lg backdrop-blur-sm transition hover:bg-white dark:bg-gray-900/90 dark:text-gray-200 dark:hover:bg-gray-900"
									on:click|stopPropagation|preventDefault={() =>
										tweet.media && tweet.media[0]?.type === 'video'
											? openVideoModal(tweet.media[0].url)
											: openImageModal(tweet.media[0]?.url || '')}
									aria-label="View media"
									tabindex="0"
									on:keydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											tweet.media && tweet.media[0]?.type === 'video'
												? openVideoModal(tweet.media[0].url)
												: openImageModal(tweet.media[0]?.url || '');
										}
									}}
								>
									<Search class="h-3 w-3" />
									<span>View</span>
								</button>
							</div>
						{/if}

						<div
							class={`grow p-4 ${tweet.media && tweet.media.length > 0 ? 'me-32 sm:me-48' : ''}`}
						>
							<div class="flex min-h-24 flex-col justify-center">
								<!-- Account avatar and name -->
								{#if tweet.twitterAccountId && accountByProviderId[tweet.twitterAccountId]}
									<div class="mb-2 flex items-center gap-3">
										{#if accountByProviderId[tweet.twitterAccountId].profileImage}
											<img
												src={accountByProviderId[tweet.twitterAccountId].profileImage}
												alt={`${accountByProviderId[tweet.twitterAccountId].displayName || accountByProviderId[tweet.twitterAccountId].username} avatar`}
												class="h-8 w-8 rounded-full object-cover"
											/>
										{:else}
											<div
												class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
												aria-label="Avatar placeholder"
											>
												{accountByProviderId[tweet.twitterAccountId].username?.[0]?.toUpperCase()}
											</div>
										{/if}
										<div class="min-w-0">
											<p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
												{accountByProviderId[tweet.twitterAccountId].displayName ||
													accountByProviderId[tweet.twitterAccountId].username}
											</p>
											<p class="truncate text-xs text-gray-500 dark:text-gray-400">
												@{accountByProviderId[tweet.twitterAccountId].username}
											</p>
										</div>
									</div>
								{/if}
								<h3 class="text-sm font-semibold text-gray-800 dark:text-neutral-300">
									{tweet.status === 'posted'
										? 'Posted'
										: tweet.status === 'failed'
											? 'Failed'
											: tweet.status}
									• {new Date(tweet.createdAt).toLocaleString()}
								</h3>
								<p class="mt-1 text-sm text-gray-500 dark:text-neutral-500">
									{tweet.content}
								</p>

								<!-- View Tweet Button for posted tweets -->
								{#if tweet.status === 'posted' && (tweet as any).twitterTweetId && tweet.twitterAccountId && accountByProviderId[tweet.twitterAccountId]}
									<div class="mt-3">
										<a
											href={constructTweetUrl(
												accountByProviderId[tweet.twitterAccountId].username,
												(tweet as any).twitterTweetId
											)}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
										>
											<ExternalLink class="h-3 w-3" />
											View Tweet
										</a>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<Pagination currentPage={data.currentPage} totalPages={data.totalPages} basePath="/history" />
	{:else}
		<EmptyState
			title="No Tweet History"
			message="You haven't posted any tweets yet. Create and schedule a tweet to see it here after it's posted."
			actionLink="/post"
			actionText="Create a Tweet"
		/>
	{/if}
</div>

<!-- Image Modal -->
{#if showImageModal}
	<div
		class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-200"
		on:click={closeImageModal}
	>
		<div
			class="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-lg bg-white dark:bg-gray-900"
		>
			<!-- Close Button -->
			<button
				class="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 shadow-lg backdrop-blur-sm transition hover:bg-white dark:bg-gray-900/90 dark:hover:bg-gray-900"
				on:click={closeImageModal}
				aria-label="Close image"
			>
				<X class="h-6 w-6 text-gray-700 dark:text-gray-200" />
			</button>

			<!-- Image -->
			<img
				src={modalImageUrl}
				alt="Full size image"
				class="max-h-[90vh] max-w-[90vw] object-contain"
			/>
		</div>
	</div>
{/if}

<!-- Video Modal -->
<VideoModal videoUrl={modalVideoUrl} bind:open={showVideoModal} on:close={closeVideoModal} />
