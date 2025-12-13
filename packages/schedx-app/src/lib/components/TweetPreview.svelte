<script lang="ts">
	import { Reply, Repeat2, Heart, BarChart2, Bookmark, Share2 } from 'lucide-svelte';
	import MediaLightbox from './MediaLightbox.svelte';
	import AnimatedCounter from './AnimatedCounter.svelte';
	import { onMount } from 'svelte';
	import logger from '$lib/logger';

	// Props for tweet preview - works with or without an activated account
	export let avatarUrl: string;
	export let displayName: string;
	export let username: string;
	export let content: string;
	export let media: { url: string; type: string }[] = [];
	export let createdAt: string | Date;
	export let replies: number = 0;
	export let retweets: number = 0;
	export let likes: number = 0;
	export let bookmarks: number = 0;
	export let views: number = 0;
	export let hideActions: boolean = false; // Hide interaction buttons
	export let showXLogo: boolean = false; // Show X logo (hide when action badges are present)

	let lightbox: MediaLightbox;

	// Convert media to lightbox format
	$: lightboxMedia = validMediaItems.map((m, index) => ({
		id: `${index}`,
		url: m.url,
		type: m.type as 'photo' | 'gif' | 'video',
		filename: `Media ${index + 1}`,
	}));
	let theme: string = 'light';
	
	// Initialize validMediaItems before using it
	let validMediaItems: { url: string; type: string }[] = [];

	// Function to get media items with type checking
	function getValidMediaItems(): { url: string; type: string }[] {
		logger.debug('getValidMediaItems called');
		logger.debug('Media prop validation', { media, type: typeof media, isArray: Array.isArray(media) });

		if (!Array.isArray(media)) {
			logger.debug('Media is not an array, returning empty');
			return [];
		}

		if (media.length > 0) {
			const firstItem = media[0];
			logger.debug('First media item details', { 
				firstItem, 
				type: typeof firstItem, 
				url: firstItem?.url, 
				typeProp: firstItem?.type 
			});
		}

		const validItems = media.filter((item) => {
			const isValid =
				item &&
				typeof item === 'object' &&
				typeof item.url === 'string' &&
				typeof item.type === 'string';
			return isValid;
		});

		logger.debug('Valid items result', { validItems, count: validItems.length });
		return validItems;
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			const updateTheme = () => {
				theme = document.documentElement.getAttribute('data-theme') || 'light';
			};
			updateTheme();
			const observer = new MutationObserver(updateTheme);
			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['data-theme']
			});

			return () => observer.disconnect();
		}
	});
	function openLightbox(index: number) {
		if (lightbox) {
			lightbox.open(index);
		}
	}
	function formatDate(date: string | Date) {
		const d = typeof date === 'string' ? new Date(date) : date;
		return (
			d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
			' · ' +
			d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
		);
	}
	$: xLogoFill = theme === 'light' ? '#000' : '#fff';

	// Reactive: Update validMediaItems when media prop changes
	$: {
		logger.debug('Media prop changed, recalculating validMediaItems', { media });
		validMediaItems = getValidMediaItems();
		logger.debug('ValidMediaItems updated', { validMediaItems, length: validMediaItems?.length });
	}
</script>

<div
	class="flex w-full max-w-xl flex-col rounded-xl border border-gray-200 bg-white p-4 shadow dark:border-gray-800 dark:bg-gray-800 theme-lightsout:border-gray-800 theme-lightsout:bg-black relative"
>
	<div class="flex justify-between">
		<div class="flex items-center">
			<img class="h-11 w-11 rounded-full object-cover" src={avatarUrl} alt={displayName} />
			<div class="ml-2 text-sm leading-tight">
				<div class="font-semibold text-gray-900 dark:text-white theme-lightsout:text-white">{displayName}</div>
				<div class="text-gray-500 dark:text-gray-400 theme-lightsout:text-white">@{username}</div>
			</div>
		</div>
		
		<!-- Action Badges Slot (replaces X logo when provided) -->
		{#if $$slots.actions}
			<div class="flex flex-shrink-0 gap-1 sm:gap-2">
				<slot name="actions" />
			</div>
		{:else if showXLogo}
			<svg
				width="32"
				height="32"
				viewBox="0 0 1200 1227"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"
					fill={xLogoFill}
				/>
			</svg>
		{/if}
	</div>
	<div class="text-gray-800 dark:text-gray-200 theme-lightsout:text-white mt-3 block whitespace-pre-line text-xl leading-snug">
		{content}
	</div>

	{#if validMediaItems && validMediaItems.length > 0}
		<!-- Twitter/X style media grid -->
		<div class="mt-3 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 theme-lightsout:border-gray-800"
			class:grid={validMediaItems.length > 1}
			class:grid-cols-2={validMediaItems.length > 1}
			class:gap-0.5={validMediaItems.length > 1}
		>
			{#each validMediaItems as m, index}
				{@const isVideo = m.type === 'video'}
				{@const isSingle = validMediaItems.length === 1}
				<button
					type="button"
					class="relative block w-full cursor-pointer overflow-hidden border-0 bg-gray-100 p-0 dark:bg-gray-800 theme-lightsout:bg-gray-900"
					class:aspect-video={isSingle}
					class:aspect-square={!isSingle}
					class:row-span-2={validMediaItems.length === 3 && index === 0}
					on:click={() => openLightbox(index)}
				>
					{#if isVideo}
						<video
							class="h-full w-full object-cover"
							src={m.url}
							muted
							playsinline
						></video>
						<div class="absolute inset-0 flex items-center justify-center bg-black/20">
							<div class="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
								<svg class="ml-1 h-5 w-5 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
									<path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
								</svg>
							</div>
						</div>
					{:else}
						<img
							class="h-full w-full object-cover"
							src={m.url}
							alt="Tweet media"
							loading="lazy"
						/>
					{/if}
				</button>
			{/each}
		</div>
		{#if validMediaItems.length > 1}
			<p class="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
				Media {validMediaItems.length} · Tap to view full
			</p>
		{/if}
	{/if}
	<MediaLightbox bind:this={lightbox} mediaItems={lightboxMedia} />
	<div class="text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-400">
		{formatDate(createdAt)}
	</div>
	<div
		class="theme-dark:border-gray-700 my-1 border border-b-0 border-gray-200 dark:border-gray-600"
	></div>
	{#if !hideActions}
		<div class="theme-dark:text-gray-400 mt-3 flex justify-between text-gray-500 dark:text-gray-400">
			<div class="group flex cursor-pointer items-center gap-1">
				<Reply class="h-5 w-5 transition group-hover:text-blue-500" />
				<span class="ml-1 text-sm"><AnimatedCounter value={replies} /></span>
			</div>
			<div class="group flex cursor-pointer items-center gap-1">
				<Repeat2 class="h-5 w-5 transition group-hover:text-green-500" />
				<span class="ml-1 text-sm"><AnimatedCounter value={retweets} /></span>
			</div>
			<div class="group flex cursor-pointer items-center gap-1">
				<Heart class="h-5 w-5 transition group-hover:text-pink-500" />
				<span class="ml-1 text-sm"><AnimatedCounter value={likes} /></span>
			</div>
			<div class="group flex cursor-pointer items-center gap-1">
				<BarChart2 class="h-5 w-5 transition group-hover:text-blue-400" />
				<span class="ml-1 text-sm"><AnimatedCounter value={views} /></span>
			</div>
			<div class="group flex cursor-pointer items-center gap-1">
				<Bookmark class="h-5 w-5 transition group-hover:text-yellow-500" />
				<span class="ml-1 text-sm"><AnimatedCounter value={bookmarks} /></span>
			</div>
			<div class="group flex cursor-pointer items-center gap-1">
				<Share2 class="h-5 w-5 transition group-hover:text-blue-400" />
			</div>
		</div>
	{/if}
</div>
