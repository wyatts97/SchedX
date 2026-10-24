<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils.js';

	let {
		value = $bindable(),
		class: className,
		ref = $bindable(null),
		...rest
	}: HTMLInputAttributes & { ref?: HTMLInputElement | null } = $props();
</script>

<input
	bind:this={ref}
	bind:value
	class={cn(
		'h-10 w-full rounded-ctl border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted',
		'hover:border-line-strong focus:border-accent focus:outline-none focus-visible:outline-none',
		'disabled:opacity-60 aria-invalid:border-bad',
		className
	)}
	{...rest}
/>
