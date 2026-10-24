<script lang="ts">
	import { refreshAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Upload from '@lucide/svelte/icons/upload';
	import Trash from '@lucide/svelte/icons/trash-2';
	import PageHeader from '#lib/components/page-header.svelte';
	import EmptyState from '#lib/components/empty-state.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import { uploadMedia } from '#lib/components/composer/upload.js';
	import { ACCEPTED_MIMES, formatBytes } from '#lib/shared/media-rules.js';
	import { api } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let input: HTMLInputElement | undefined = $state();
	let uploading = $state<{ name: string; progress: number }[]>([]);

	async function onFiles(files: FileList | null) {
		if (!files) return;
		await Promise.all(
			[...files].map(async (file) => {
				const entry = $state({ name: file.name, progress: 0 });
				uploading.push(entry);
				try {
					await uploadMedia(file, (p) => (entry.progress = p));
				} catch (err) {
					toast.error((err as Error).message);
				} finally {
					uploading = uploading.filter((u) => u.name !== file.name);
				}
			})
		);
		if (input) input.value = '';
		await refreshAll();
	}

	async function saveAlt(id: string, altText: string) {
		try {
			await api(`/api/media/${id}`, { altText }, 'PATCH');
			toast.success('Description saved');
		} catch (err) {
			toast.error((err as Error).message);
		}
	}

	async function remove(id: string) {
		if (!confirm('Delete this file from the library?')) return;
		try {
			await api(`/api/media/${id}`, undefined, 'DELETE');
			await refreshAll();
		} catch (err) {
			toast.error((err as Error).message);
		}
	}
</script>

<svelte:head><title>Media · SchedX</title></svelte:head>

<PageHeader
	title="Media"
	description="Everything you've uploaded, ready to reuse. Descriptions you set here are filled in when you attach a file."
>
	{#snippet actions()}
		<input
			bind:this={input}
			type="file"
			multiple
			accept={ACCEPTED_MIMES.join(',')}
			class="hidden"
			onchange={(e) => onFiles(e.currentTarget.files)}
		/>
		<Button variant="primary" onclick={() => input?.click()}><Upload />Upload</Button>
	{/snippet}
</PageHeader>

{#if uploading.length}
	<ul class="mb-6 grid gap-2">
		{#each uploading as u (u.name)}
			<li class="grid gap-1.5 text-sm">
				<span class="truncate">{u.name}</span>
				<span class="h-1 overflow-hidden rounded-full bg-surface-2"
					><span class="block h-full bg-accent" style="width: {Math.round(u.progress * 100)}%"
					></span></span
				>
			</li>
		{/each}
	</ul>
{/if}

{#if data.media.length === 0 && !uploading.length}
	<EmptyState
		title="No media yet"
		body="Images up to 5 MB, GIFs up to 15 MB and videos up to {data.maxUploadMb} MB. Large images are resized to fit X's limits."
	/>
{:else}
	<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
		{#each data.media as m (m.id)}
			<li class="grid content-start gap-2">
				<a
					href={m.url}
					target="_blank"
					rel="noopener"
					class="relative block aspect-square overflow-hidden rounded-panel border border-line bg-surface-2"
				>
					<img
						src={m.thumbUrl}
						alt={m.altText || m.originalName}
						class="size-full object-cover"
						loading="lazy"
					/>
					{#if m.kind !== 'image'}
						<span
							class="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white uppercase"
							>{m.kind}</span
						>
					{/if}
				</a>
				<div class="flex items-center gap-2 text-xs text-muted">
					<span class="truncate" title={m.originalName}>{m.originalName}</span>
					<span class="ml-auto shrink-0 tnum">{formatBytes(m.size)}</span>
					<button
						type="button"
						class="shrink-0 rounded p-1 hover:bg-bad-soft hover:text-bad disabled:opacity-40"
						aria-label="Delete {m.originalName}"
						title={m.uses ? `Used in ${m.uses} post(s)` : 'Delete'}
						disabled={m.uses > 0}
						onclick={() => remove(m.id)}
					>
						<Trash class="size-3.5" />
					</button>
				</div>
				{#if m.kind !== 'video'}
					<textarea
						rows="2"
						maxlength="1000"
						placeholder="Describe this image for people using screen readers"
						aria-label="Description for {m.originalName}"
						value={m.altText}
						onchange={(e) => saveAlt(m.id, e.currentTarget.value)}
						class="w-full resize-none rounded-ctl border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
					></textarea>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
