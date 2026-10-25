<script lang="ts">
	import { cn } from '#lib/utils.js';

	let {
		src,
		name,
		size = 'md',
		class: className
	}: { src?: string | null; name: string; size?: 'sm' | 'md' | 'lg'; class?: string } = $props();

	let failed = $state(false);
	const initials = $derived(name.replace(/^@/, '').slice(0, 2).toUpperCase());
	const dims = { sm: 'size-6 text-[0.625rem]', md: 'size-9 text-xs', lg: 'size-12 text-sm' };
</script>

{#if src && !failed}
	<img
		{src}
		alt=""
		class={cn('shrink-0 rounded-full bg-surface-2 object-cover', dims[size], className)}
		onerror={() => (failed = true)}
	/>
{:else}
	<span
		class={cn(
			'inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent',
			dims[size],
			className
		)}
		aria-hidden="true">{initials}</span
	>
{/if}
