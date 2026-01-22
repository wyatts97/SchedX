<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	export let src: string;
	export let alt: string = '';
	export let placeholder: string = ''; // Low-res placeholder or blur data URL
	export let aspectRatio: string = ''; // e.g., "16/9" or "1/1"
	export let className: string = '';
	export let loading: 'lazy' | 'eager' = 'lazy';
	export let decoding: 'async' | 'sync' | 'auto' = 'async';

	let loaded = false;
	let error = false;
	let imgElement: HTMLImageElement;

	// Generate a simple gray placeholder if none provided
	const defaultPlaceholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect fill="%23f3f4f6" width="1" height="1"/%3E%3C/svg%3E';

	$: placeholderSrc = placeholder || defaultPlaceholder;

	function handleLoad() {
		loaded = true;
	}

	function handleError() {
		error = true;
	}

	onMount(() => {
		// Check if image is already cached
		if (imgElement?.complete && imgElement?.naturalWidth > 0) {
			loaded = true;
		}
	});
</script>

<div 
	class="progressive-image relative overflow-hidden bg-gray-100 dark:bg-gray-800 {className}"
	style={aspectRatio ? `aspect-ratio: ${aspectRatio};` : ''}
>
	<!-- Placeholder / Blur -->
	{#if !loaded && !error}
		<img
			src={placeholderSrc}
			{alt}
			class="absolute inset-0 h-full w-full object-cover blur-sm scale-105"
			aria-hidden="true"
		/>
		
		<!-- Loading shimmer -->
		<div class="absolute inset-0 shimmer"></div>
	{/if}

	<!-- Error state -->
	{#if error}
		<div class="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
			<svg class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
			</svg>
		</div>
	{/if}

	<!-- Main image -->
	<img
		bind:this={imgElement}
		{src}
		{alt}
		{loading}
		{decoding}
		on:load={handleLoad}
		on:error={handleError}
		class="h-full w-full object-cover transition-opacity duration-300"
		class:opacity-0={!loaded}
		class:opacity-100={loaded}
	/>
</div>

<style>
	.shimmer {
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(255, 255, 255, 0.2) 50%,
			transparent 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
	}

	:global(.dark) .shimmer {
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(255, 255, 255, 0.05) 50%,
			transparent 100%
		);
		background-size: 200% 100%;
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}
</style>
