<script lang="ts">
	import { onMount } from 'svelte';
	import { navigationConfig } from '$lib/config/navigation';

	let hidden = false;
	let y = 0;

	onMount(() => {
		const handleScroll = () => {
			const scrollHeight = document.documentElement.scrollHeight;
			const clientHeight = document.documentElement.clientHeight;
			y = window.scrollY;

			if (y + clientHeight >= scrollHeight - 10) {
				hidden = true;
			} else {
				hidden = false;
			}
		};

		window.addEventListener('scroll', handleScroll);

		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
	});
</script>

<nav
	class="fixed bottom-4 left-1/2 z-50 flex w-11/12 -translate-x-1/2 transform justify-between transition-transform duration-300 md:hidden"
	class:hidden
>
	<div
		class="relative flex w-full justify-between overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg dark:border-white dark:bg-gray-800"
	>
		{#each navigationConfig.mobile as item}
			<a
				href={item.href}
				class="inline-flex flex-grow flex-col items-center px-4 py-3 text-xs font-medium text-blue-600 dark:text-white"
			>
				<svg
					class="mobile-navbar-icon h-7 w-7 transition-all duration-200 hover:drop-shadow-[0_0_8px_#1da1f2] dark:hover:drop-shadow-[0_0_8px_#60a5fa]"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					viewBox="0 0 24 24"
				>
					{@html item.icon}
				</svg>
				<span class="sr-only">{item.label}</span>
			</a>
		{/each}
	</div>

	<!-- Post (center, accent) -->
	<a href="/post" class="absolute -top-6 left-1/2 z-10 -translate-x-1/2">
		<div class="rounded-full border-4 border-white bg-blue-600 p-3 shadow-lg dark:bg-blue-500">
			<svg
				class="mobile-navbar-icon h-8 w-8 text-white transition-all duration-200 hover:drop-shadow-[0_0_10px_#1da1f2] dark:hover:drop-shadow-[0_0_10px_#60a5fa]"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				viewBox="0 0 24 24"
			>
				<path d="M12 5v14" />
				<path d="M5 12h14" />
			</svg>
		</div>
		<span class="sr-only">Post</span>
	</a>
</nav>

<style>
	.hidden {
		transform: translateX(-50%) translateY(150%);
	}
</style>
