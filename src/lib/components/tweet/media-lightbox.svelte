<script lang="ts">
	import { Dialog } from 'bits-ui';
	import X from '@lucide/svelte/icons/x';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import type { TweetMedia } from './types.js';

	let {
		open = $bindable(false),
		index = $bindable(0),
		media
	}: { open?: boolean; index?: number; media: TweetMedia[] } = $props();

	const current = $derived(media[index]);
	const step = (d: number) => (index = (index + d + media.length) % media.length);

	function onkeydown(e: KeyboardEvent) {
		if (!open || media.length < 2) return;
		if (e.key === 'ArrowRight') step(1);
		if (e.key === 'ArrowLeft') step(-1);
	}
</script>

<svelte:window {onkeydown} />

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/90" />
		<Dialog.Content
			class="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none sm:p-12"
		>
			<Dialog.Title class="sr-only">Media {index + 1} of {media.length}</Dialog.Title>
			{#if current}
				{#if current.kind === 'video'}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						src={current.url}
						poster={current.thumbUrl}
						controls
						autoplay
						playsinline
						class="max-h-full max-w-full rounded-lg"
					></video>
				{:else}
					<img
						src={current.url}
						alt={current.alt}
						class="max-h-full max-w-full rounded-lg object-contain"
					/>
				{/if}
				{#if current.alt && current.kind !== 'video'}
					<p
						class="absolute right-4 bottom-4 left-4 mx-auto max-w-2xl rounded-lg bg-black/70 px-3 py-2 text-sm text-white"
					>
						{current.alt}
					</p>
				{/if}
			{/if}
			<Dialog.Close
				class="absolute top-4 left-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
				aria-label="Close"
			>
				<X class="size-5" />
			</Dialog.Close>
			{#if media.length > 1}
				<button
					type="button"
					onclick={() => step(-1)}
					class="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
					aria-label="Previous"><ChevronLeft class="size-6" /></button
				>
				<button
					type="button"
					onclick={() => step(1)}
					class="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
					aria-label="Next"><ChevronRight class="size-6" /></button
				>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
