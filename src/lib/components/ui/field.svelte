<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils.js';

	let {
		label,
		for: forId,
		hint,
		error,
		class: className,
		children
	}: {
		label: string;
		for?: string;
		hint?: string;
		error?: string | null;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<div class={cn('grid gap-1.5', className)}>
	<label for={forId} class="text-sm font-medium text-ink">{label}</label>
	{@render children()}
	{#if error}
		<p class="text-sm text-bad">{error}</p>
	{:else if hint}
		<p class="text-[0.8125rem] text-muted">{hint}</p>
	{/if}
</div>
