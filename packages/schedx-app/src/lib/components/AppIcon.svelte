<script lang="ts">
	import { onMount } from 'svelte';

	export let className: string = 'w-8 h-8';

	let theme: string = 'dark';

	$: if (typeof window !== 'undefined') {
		theme = document.documentElement.getAttribute('data-theme') || 'dark';
	}

	onMount(() => {
		const observer = new MutationObserver(() => {
			const newTheme = document.documentElement.getAttribute('data-theme') || 'dark';
			if (newTheme !== theme) theme = newTheme;
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});
		return () => observer.disconnect();
	});
</script>

<div class={`app-icon-container relative ${className}`}>
	<img
		src={`/app-icon-${theme === 'lightsout' ? 'lightsout' : theme}.png`}
		alt="SchedX App Icon"
		class="h-full w-full object-contain transition-all duration-300"
		on:error={(e) => {
			const target = e.target as HTMLImageElement;
			target.src = '/app-icon-dark.png';
		}}
	/>
</div>
