<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	export let className: string = 'w-8 h-8';

	let theme: string = 'dark';
	let isTransitioning = false;
	let currentIcon: string;
	let nextIcon: string;

	// Initialize icons
	$: currentIcon = `/app-icon-${theme === 'lightsout' ? 'lightsout' : theme}.png`;
	$: nextIcon = currentIcon;

	// Preload images for smooth transitions
	function preloadImage(src: string) {
		const img = new Image();
		img.src = src;
	}

	onMount(() => {
		// Preload all theme icons
		preloadImage('/app-icon-dark.png');
		preloadImage('/app-icon-light.png');
		preloadImage('/app-icon-lightsout.png');

		const observer = new MutationObserver(() => {
			const newTheme = document.documentElement.getAttribute('data-theme') || 'dark';
			if (newTheme !== theme) {
				// Trigger smooth transition
				isTransitioning = true;
				nextIcon = `/app-icon-${newTheme === 'lightsout' ? 'lightsout' : newTheme}.png`;
				
				// Update theme after a brief delay to allow transition
				setTimeout(() => {
					theme = newTheme;
					currentIcon = nextIcon;
					isTransitioning = false;
				}, 150);
			}
		});
		
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});
		
		return () => observer.disconnect();
	});
</script>

<div class={`app-icon-container relative ${className}`}>
	{#key currentIcon}
		<img
			src={currentIcon}
			alt="SchedX App Icon"
			class="h-full w-full object-contain"
			in:fade={{ duration: 300, delay: 150 }}
			out:fade={{ duration: 150 }}
			on:error={(e) => {
				const target = e.target as HTMLImageElement;
				target.src = '/app-icon-dark.png';
			}}
		/>
	{/key}
</div>
