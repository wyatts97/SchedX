<script lang="ts">
	import { Reply, Repeat2, Heart, BarChart2, Bookmark, Share2 } from 'lucide-svelte';
	import VideoModal from './VideoModal.svelte';
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
	export let showXLogo: boolean = true; // Show X logo (hide when action badges are present)

	let showVideoModal = false;
	let modalVideoUrl = '';
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
	function openVideoModal(url: string) {
		modalVideoUrl = url;
		showVideoModal = true;
	}
	function closeVideoModal() {
		showVideoModal = false;
		modalVideoUrl = '';
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
	class="flex w-full max-w-xl flex-col rounded-xl border border-gray-200 bg-white p-4 shadow dark:border-gray-800 dark:bg-gray-800 relative"
>
	<div class="flex justify-between">
		<div class="flex items-center">
			<img class="h-11 w-11 rounded-full object-cover" src={avatarUrl} alt={displayName} />
			<div class="ml-2 text-sm leading-tight">
				<span class="theme-dark:text-white block font-bold text-black dark:text-white"
					>{displayName}</span
				>
				<span class="theme-dark:text-gray-400 block font-normal text-gray-500 dark:text-gray-400"
					>@{username}</span
				>
			</div>
		</div>
		
		<!-- Action Badges Slot (replaces X logo when provided) -->
		{#if $$slots.actions}
			<div class="flex gap-2">
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
	<p
		class="theme-dark:text-white mt-3 block whitespace-pre-line text-xl leading-snug text-black dark:text-white"
	>
		{content}
	</p>

	{#if validMediaItems && validMediaItems.length > 0}
		<div class="mt-2 flex flex-col gap-2">
			{#each validMediaItems as m}
				{#if m.type === 'image' || m.type === 'photo' || m.type === 'gif'}
					<img
						class="theme-dark:border-gray-700 max-h-96 rounded-2xl border border-gray-100 object-contain dark:border-gray-700"
						src={m.url}
						alt="Tweet media"
					/>
				{:else if m.type === 'video'}
					<div
						class="group relative cursor-pointer"
						on:click={() => openVideoModal(m.url)}
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								openVideoModal(m.url);
							}
						}}
						role="button"
						tabindex="0"
						aria-label="Play video"
					>
						<!-- svelte-ignore element_invalid_self_closing_tag -->
						<video
							class="theme-dark:border-gray-700 max-h-96 rounded-2xl border border-gray-100 object-contain dark:border-gray-700"
							src={m.url}
							muted
							playsinline
						></video>
						<div class="absolute inset-0 flex items-center justify-center">
							<svg
								class="h-16 w-16 opacity-80 transition-transform group-hover:scale-110"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 72 72"
								><circle class="fill-white" cx="36" cy="36" r="36" fill-opacity=".8" /><path
									class="fill-indigo-500 drop-shadow-2xl"
									d="M44 36a.999.999 0 0 0-.427-.82l-10-7A1 1 0 0 0 32 29V43a.999.999 0 0 0 1.573.82l10-7A.995.995 0 0 0 44 36V36c0 .001 0 .001 0 0Z"
								/></svg
							>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
	<VideoModal videoUrl={modalVideoUrl} bind:open={showVideoModal} on:close={closeVideoModal} />
	<p class="theme-dark:text-gray-400 my-0.5 py-1 text-base text-gray-500 dark:text-gray-400">
		{formatDate(createdAt)}
	</p>
	<div
		class="theme-dark:border-gray-700 my-1 border border-b-0 border-gray-200 dark:border-gray-600"
	></div>
	{#if !hideActions}
		<div class="theme-dark:text-gray-400 mt-3 flex justify-between text-gray-500 dark:text-gray-400">
			<div class="group flex cursor-pointer items-center gap-1">
				<Reply class="h-5 w-5 transition group-hover:text-blue-500" />
				<span class="ml-1 text-sm">{replies}</span>
			</div>
			<div class="group flex cursor-pointer items-center gap-1">
				<Repeat2 class="h-5 w-5 transition group-hover:text-green-500" />
				<span class="ml-1 text-sm">{retweets}</span>
			</div>
			<div class="group flex cursor-pointer items-center gap-1">
				<Heart class="h-5 w-5 transition group-hover:text-pink-500" />
				<span class="ml-1 text-sm">{likes}</span>
			</div>
			<div class="group flex cursor-pointer items-center gap-1">
				<BarChart2 class="h-5 w-5 transition group-hover:text-blue-400" />
				<span class="ml-1 text-sm">{views}</span>
			</div>
			<div class="group flex cursor-pointer items-center gap-1">
				<Bookmark class="h-5 w-5 transition group-hover:text-yellow-500" />
				<span class="ml-1 text-sm">{bookmarks}</span>
			</div>
			<div class="group flex cursor-pointer items-center gap-1">
				<Share2 class="h-5 w-5 transition group-hover:text-blue-400" />
			</div>
		</div>
	{/if}
</div>
