<script lang="ts">
	import { onMount } from 'svelte';
	import { navigationConfig } from '$lib/config/navigation';
	import { PenSquare, Upload } from 'lucide-svelte';

	let hidden = false;
	let y = 0;
	let showDropup = false;
	let isAnimating = false;

	onMount(() => {
		const handleScroll = () => {
			const scrollHeight = document.documentElement.scrollHeight;
			const clientHeight = document.documentElement.clientHeight;
			y = window.scrollY;

			// Check if at bottom of page
			const atBottom = y + clientHeight >= scrollHeight - 10;
			
			// Only trigger animation if state actually changes
			if (atBottom && !hidden && !isAnimating) {
				isAnimating = true;
				hidden = true;
				setTimeout(() => { isAnimating = false; }, 400); // Match animation duration
			} else if (!atBottom && hidden && !isAnimating) {
				isAnimating = true;
				hidden = false;
				setTimeout(() => { isAnimating = false; }, 400); // Match animation duration
			}
		};

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!target.closest('.dropup-container')) {
				showDropup = false;
			}
		};

		window.addEventListener('scroll', handleScroll);
		document.addEventListener('click', handleClickOutside);

		return () => {
			window.removeEventListener('scroll', handleScroll);
			document.removeEventListener('click', handleClickOutside);
		};
	});

	function toggleDropup() {
		showDropup = !showDropup;
	}
</script>

<nav
	class="mobile-navbar fixed bottom-4 left-1/2 z-50 flex w-11/12 -translate-x-1/2 transform justify-between transition-all duration-400 ease-in-out md:hidden"
	class:navbar-hidden={hidden}
>
	<div
		class="relative flex w-full justify-between overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg dark:border-white dark:bg-gray-800"
	>
		<!-- Left side items (first 3) -->
		{#each navigationConfig.mobile.slice(0, 3) as item}
			<a
				href={item.href}
				class="inline-flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-blue-600 dark:text-white"
			>
				<svg
					class="mobile-navbar-icon h-5 w-5 transition-all duration-200 hover:drop-shadow-[0_0_8px_#1da1f2] dark:hover:drop-shadow-[0_0_8px_#60a5fa]"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					viewBox="0 0 24 24"
				>
					{@html item.icon}
				</svg>
				<span class="text-[10px]">{item.label}</span>
			</a>
		{/each}
		
		<!-- Spacer for center button -->
		<div class="flex-1"></div>
		
		<!-- Right side items (last 3) -->
		{#each navigationConfig.mobile.slice(3) as item}
			<a
				href={item.href}
				class="inline-flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-blue-600 dark:text-white"
			>
				<svg
					class="mobile-navbar-icon h-5 w-5 transition-all duration-200 hover:drop-shadow-[0_0_8px_#1da1f2] dark:hover:drop-shadow-[0_0_8px_#60a5fa]"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					viewBox="0 0 24 24"
				>
					{@html item.icon}
				</svg>
				<span class="text-[10px]">{item.label}</span>
			</a>
		{/each}
	</div>

	<!-- Post Button with Dropup Menu -->
	<div class="dropup-container absolute -top-6 left-1/2 z-10 -translate-x-1/2">
		<!-- Dropup Menu -->
		{#if showDropup}
			<div class="absolute bottom-full left-1/2 mb-4 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2">
				<div class="rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
					<a
						href="/post"
						class="flex items-center gap-3 rounded-t-2xl px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
						on:click={() => showDropup = false}
					>
						<PenSquare class="h-5 w-5 text-blue-600 dark:text-blue-400" />
						<span class="whitespace-nowrap">Create Post</span>
					</a>
					<div class="h-px bg-gray-200 dark:bg-gray-700"></div>
					<a
						href="/gallery"
						class="flex items-center gap-3 rounded-b-2xl px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
						on:click={() => showDropup = false}
					>
						<Upload class="h-5 w-5 text-green-600 dark:text-green-400" />
						<span class="whitespace-nowrap">Upload Media</span>
					</a>
				</div>
			</div>
		{/if}

		<!-- Center Button -->
		<button
			on:click={toggleDropup}
			class="rounded-full border-4 border-white bg-blue-600 p-3 shadow-lg transition-transform hover:scale-110 dark:bg-blue-500"
			class:rotate-45={showDropup}
			aria-label={showDropup ? 'Close create menu' : 'Open create menu'}
		>
			<svg
				class="mobile-navbar-icon h-8 w-8 text-white transition-all duration-200"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path d="M12 5v14" />
				<path d="M5 12h14" />
			</svg>
		</button>
	</div>
</nav>

<style>
	.navbar-hidden {
		transform: translateX(-50%) translateY(calc(100% + 2rem));
		opacity: 0;
	}
	
	/* Smooth slide and fade animation */
	nav {
		transition: transform 400ms cubic-bezier(0.4, 0, 0.2, 1), 
		            opacity 400ms cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
