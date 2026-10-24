<script lang="ts">
	import { onMount } from 'svelte';
	import { refreshAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Trash from '@lucide/svelte/icons/trash-2';
	import PageHeader from '#lib/components/page-header.svelte';
	import DropZone from '#lib/components/drop-zone.svelte';
	import { uploadMedia } from '#lib/components/composer/upload.js';
	import { blockStrayDrops, fileDrop } from '#lib/actions/file-drop.js';
	import { formatBytes, kindForMime } from '#lib/shared/media-rules.js';
	import { api } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let uploading = $state<{ name: string; progress: number }[]>([]);
	let pageDrag = $state(false);

	onMount(() => blockStrayDrops());

	async function onFiles(files: File[]) {
		const unsupported = files.filter((f) => !kindForMime(f.type));
		for (const f of unsupported) toast.error(`${f.name}: use JPG, PNG, WebP, GIF, MP4 or MOV.`);
		const ok = files.filter((f) => kindForMime(f.type));
		if (!ok.length) return;
		const results = await Promise.allSettled(
			ok.map(async (file) => {
				uploading.push({ name: file.name, progress: 0 });
				const slot = uploading[uploading.length - 1];
				try {
					await uploadMedia(file, (p) => (slot.progress = p));
				} finally {
					uploading = uploading.filter((u) => u !== slot);
				}
			})
		);
		for (const r of results) if (r.status === 'rejected') toast.error((r.reason as Error).message);
		const done = results.filter((r) => r.status === 'fulfilled').length;
		if (done) toast.success(`Uploaded ${done} file${done > 1 ? 's' : ''}`);
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

<div
	class="relative min-h-[60dvh]"
	use:fileDrop={{ ondrop: onFiles, onover: (v) => (pageDrag = v) }}
>
	<PageHeader
		title="Media"
		description="Everything you've uploaded, ready to reuse. Descriptions you set here are filled in when you attach a file. Large images are resized to fit X's limits."
	/>

	<div class="mb-6">
		<DropZone onfiles={onFiles} maxUploadMb={data.maxUploadMb} />
	</div>

	{#if uploading.length}
		<ul class="mb-6 grid gap-3 rounded-lg border border-line bg-surface p-4">
			{#each uploading as u (u)}
				<li class="grid gap-1.5 text-sm">
					<span class="truncate">Uploading {u.name}</span>
					<span class="h-2 overflow-hidden rounded-full bg-surface-2"
						><span
							class="block h-full bg-blue-600 transition-[width] duration-300"
							style="width: {Math.round(u.progress * 100)}%"
						></span></span
					>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.media.length > 0}
		<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
			{#each data.media as m (m.id)}
				<!-- A flex column (not a grid) so a long filename can't widen the tile past its column. -->
				<li class="flex min-w-0 flex-col gap-2">
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
					<div class="flex min-w-0 items-center gap-2 text-xs text-muted">
						<span class="min-w-0 truncate" title={m.originalName}>{m.originalName}</span>
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
							placeholder="Describe this image"
							aria-label="Description for {m.originalName}"
							value={m.altText}
							onchange={(e) => saveAlt(m.id, e.currentTarget.value)}
							class="w-full min-w-0 resize-none rounded-ctl border border-line bg-surface px-2.5 py-1.5 text-base outline-none focus:border-accent sm:text-xs"
						></textarea>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if pageDrag}
		<div
			class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-[2px]"
		>
			<p
				class="rounded-xl border-2 border-dashed border-blue-500 bg-raised px-8 py-6 text-lg font-semibold text-blue-600 shadow-pop dark:text-blue-300"
			>
				Drop to upload to Media
			</p>
		</div>
	{/if}
</div>
