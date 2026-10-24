<script lang="ts">
	import Sun from '@lucide/svelte/icons/sun';
	import Circle from '@lucide/svelte/icons/circle';
	import Moon from '@lucide/svelte/icons/moon';
	import { THEME_LABELS, useTheme } from './theme.svelte.js';
	import { cn } from '#lib/utils.js';

	let { size = 'sm' }: { size?: 'sm' | 'md' } = $props();
	const theme = useTheme();
	const next = $derived(theme.nextAfter(theme.resolved));
</script>

<button
	type="button"
	onclick={() => theme.cycle()}
	class={cn(
		'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg transition-colors hover:bg-surface-2',
		size === 'sm' ? 'size-7' : 'size-9'
	)}
	aria-label="Theme: {THEME_LABELS[theme.resolved]}. Switch to {THEME_LABELS[next]}"
	title="Switch to {THEME_LABELS[next]}"
>
	{#key theme.resolved}
		<span class="animate-[icon-in_0.2s_ease-out]">
			{#if theme.resolved === 'light'}
				<Sun class={size === 'sm' ? 'size-4' : 'size-5'} color="#eab308" />
			{:else if theme.resolved === 'dark'}
				<Circle class={size === 'sm' ? 'size-4' : 'size-5'} color="#3b82f6" />
			{:else}
				<Moon class={cn(size === 'sm' ? 'size-4' : 'size-5', 'text-ink')} />
			{/if}
		</span>
	{/key}
</button>
