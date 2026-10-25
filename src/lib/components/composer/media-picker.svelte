<script lang="ts">
	import Dialog from '../ui/dialog.svelte';
	import Button from '../ui/button.svelte';
	import EmptyState from '../empty-state.svelte';
	import { validateAttachmentSet } from '#lib/shared/media-rules.js';
	import type { MediaInfo } from '#lib/shared/compose.js';
	import type { MediaKind } from '#lib/shared/types.js';
	import { cn } from '#lib/utils.js';

	let {
		open = $bindable(false),
		existing,
		onpick
	}: { open?: boolean; existing: MediaKind[]; onpick: (media: MediaInfo[]) => void } = $props();

	let library = $state<MediaInfo[] | null>(null);
	let picked = $state<string[]>([]);
	let error = $state('');

	$effect(() => {
		if (open) {
			picked = [];
			fetch('/api/media')
				.then((r) => r.json())
				.then((d: { media: MediaInfo[] }) => (library = d.media))
				.catch(() => (library = []));
		}
	});

	function toggle(m: MediaInfo) {
		const next = picked.includes(m.id) ? picked.filter((id) => id !== m.id) : [...picked, m.id];
		const kinds = [...existing, ...next.map((id) => library!.find((x) => x.id === id)!.kind)];
		error = validateAttachmentSet(kinds) ?? '';
		if (!error) picked = next;
	}

	function confirm() {
		onpick(picked.map((id) => library!.find((m) => m.id === id)!));
		open = false;
	}
</script>

<Dialog
	bind:open
	title="Media library"
	description="Pick files you've uploaded before."
	class="sm:max-w-2xl"
>
	{#if library === null}
		<p class="py-8 text-center text-sm text-muted">Loading…</p>
	{:else if library.length === 0}
		<EmptyState
			title="No media yet"
			body="Upload images or videos from the composer and they'll appear here for reuse."
		/>
	{:else}
		<div class="grid max-h-[55dvh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
			{#each library as m (m.id)}
				{@const on = picked.includes(m.id)}
				<button
					type="button"
					onclick={() => toggle(m)}
					aria-pressed={on}
					class={cn(
						'relative aspect-square overflow-hidden rounded-xl border-2 bg-surface-2',
						on ? 'border-accent' : 'border-transparent hover:border-line-strong'
					)}
				>
					<img
						src={m.thumbUrl}
						alt={m.altText || m.originalName}
						class="size-full object-cover"
						loading="lazy"
					/>
					{#if m.kind !== 'image'}
						<span
							class="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white uppercase"
							>{m.kind}</span
						>
					{/if}
					{#if on}
						<span
							class="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-ink tnum"
						>
							{picked.indexOf(m.id) + 1}
						</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
	{#if error}<p class="mt-3 text-sm text-bad">{error}</p>{/if}
	{#snippet footer()}
		<Button onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" disabled={!picked.length} onclick={confirm}>
			Attach {picked.length || ''}
		</Button>
	{/snippet}
</Dialog>
