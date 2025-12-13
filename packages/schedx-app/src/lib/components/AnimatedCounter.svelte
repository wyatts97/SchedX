<script lang="ts">
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	export let value: number = 0;
	export let duration: number = 800;
	export let formatFn: ((n: number) => string) | null = null;

	// Create a tweened store for smooth animation
	const displayValue = tweened(0, {
		duration,
		easing: cubicOut
	});

	// Track the last target value to avoid unnecessary updates
	let lastTargetValue: number = 0;
	let mounted = false;

	onMount(() => {
		// Set initial value without animation on mount
		lastTargetValue = value;
		displayValue.set(value, { duration: 0 });
		mounted = true;
	});

	// Animate to new value when prop changes
	$: if (mounted && value !== lastTargetValue) {
		lastTargetValue = value;
		displayValue.set(value);
	}

	// Format the display value
	function formatNumber(num: number): string {
		if (formatFn) return formatFn(num);
		
		// Default formatting with K/M suffixes
		const rounded = Math.round(num);
		if (rounded >= 1000000) {
			return (rounded / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
		}
		if (rounded >= 1000) {
			return (rounded / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
		}
		return rounded.toLocaleString();
	}
</script>

<span class="inline-block tabular-nums transition-colors">
	{formatNumber($displayValue)}
</span>
