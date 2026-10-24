<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import type { TweetMedia } from './types.js';
	import { cn } from '#lib/utils.js';

	let {
		media,
		onopen,
		class: className
	}: { media: TweetMedia[]; onopen?: (index: number) => void; class?: string } = $props();

	const n = $derived(media.length);
</script>

<!-- X-style media grid (legacy TweetPreview): 1 = wide, 2/4 = squares, 3 = tall first tile. -->
<div
	class={cn(
		'overflow-hidden rounded-2xl border border-line',
		n > 1 && 'grid grid-cols-2 gap-0.5',
		className
	)}
>
	{#each media as m, i (m.url + i)}
		<button
			type="button"
			onclick={() => onopen?.(i)}
			class={cn(
				'relative block w-full overflow-hidden bg-surface-2 p-0',
				n === 1 ? 'aspect-video' : 'aspect-square',
				n === 3 && i === 0 && 'row-span-2 aspect-auto h-full'
			)}
			aria-label={m.kind === 'video' ? 'Play video' : `View image${m.alt ? `: ${m.alt}` : ''}`}
		>
			<img src={m.thumbUrl} alt={m.alt} class="size-full object-cover" loading="lazy" />
			{#if m.kind === 'video'}
				<span class="absolute inset-0 flex items-center justify-center bg-black/20">
					<span
						class="flex size-12 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-lg"
					>
						<Play class="ml-0.5 size-5 fill-current" />
					</span>
				</span>
			{:else if m.kind === 'gif'}
				<span
					class="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[0.6875rem] font-bold text-white"
					>GIF</span
				>
			{/if}
		</button>
	{/each}
</div>
