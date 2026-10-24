<script lang="ts">
	import { toast } from 'svelte-sonner';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import Images from '@lucide/svelte/icons/images';
	import ChartBar from '@lucide/svelte/icons/chart-bar-big';
	import X from '@lucide/svelte/icons/x';
	import Trash from '@lucide/svelte/icons/trash-2';
	import Link from '@lucide/svelte/icons/link';
	import { textStats } from '#lib/shared/text.js';
	import {
		ACCEPTED_MIMES,
		kindForMime,
		validateAttachmentSet,
		formatBytes
	} from '#lib/shared/media-rules.js';
	import { uploadMedia } from './upload.js';
	import type { EditorItem } from './types.js';
	import type { MediaInfo } from '#lib/shared/compose.js';
	import { cn } from '#lib/utils.js';

	let {
		item = $bindable(),
		index,
		total,
		premium,
		onremove,
		onlibrary,
		autofocus = false
	}: {
		item: EditorItem;
		index: number;
		total: number;
		premium: boolean;
		onremove: () => void;
		onlibrary: () => void;
		autofocus?: boolean;
	} = $props();

	let fileInput: HTMLInputElement | undefined = $state();
	let textarea: HTMLTextAreaElement | undefined = $state();

	const stats = $derived(textStats(item.text, premium));
	const kinds = $derived(item.media.map((m) => m.kind));
	const canAddMedia = $derived(
		!item.poll &&
			item.uploads.length === 0 &&
			(kinds.length === 0 || (kinds.every((k) => k === 'image') && kinds.length < 4))
	);
	const ringPct = $derived(Math.min(1, stats.weighted / stats.limit));
	const ringColor = $derived(
		stats.over ? 'var(--bad)' : stats.remaining <= 20 ? 'var(--warn)' : 'var(--accent)'
	);

	$effect(() => {
		if (autofocus) textarea?.focus();
	});

	function autosize(node: HTMLTextAreaElement) {
		const fit = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight}px`;
		};
		fit();
		node.addEventListener('input', fit);
		return { destroy: () => node.removeEventListener('input', fit) };
	}

	export function addMedia(list: MediaInfo[]) {
		const next = [...kinds, ...list.map((m) => m.kind)];
		const err = validateAttachmentSet(next);
		if (err) {
			toast.error(err);
			return;
		}
		item.media.push(...list.map((m) => ({ ...m, alt: m.altText })));
	}

	async function onFiles(files: FileList | null) {
		if (!files?.length) return;
		const list = [...files];
		const err = validateAttachmentSet([
			...kinds,
			...list.map((f) => kindForMime(f.type) ?? 'image')
		]);
		if (err) return toast.error(err);
		for (const f of list) {
			if (!kindForMime(f.type))
				return toast.error(`${f.name}: use JPG, PNG, WebP, GIF, MP4 or MOV.`);
		}
		await Promise.all(
			list.map(async (file) => {
				const entry = { name: file.name, progress: 0 };
				item.uploads.push(entry);
				const slot = item.uploads[item.uploads.length - 1];
				try {
					const media = await uploadMedia(file, (p) => (slot.progress = p));
					item.media.push({ ...media, alt: media.altText });
				} catch (e) {
					toast.error((e as Error).message);
				} finally {
					item.uploads = item.uploads.filter((u) => u !== slot);
				}
			})
		);
		if (fileInput) fileInput.value = '';
	}

	function togglePoll() {
		item.poll = item.poll ? null : { options: ['', ''], durationMinutes: 1440 };
	}

	const DURATIONS = [
		{ v: 60, l: '1 hour' },
		{ v: 360, l: '6 hours' },
		{ v: 1440, l: '1 day' },
		{ v: 4320, l: '3 days' },
		{ v: 10080, l: '7 days' }
	];
</script>

<div class="relative grid grid-cols-[auto_1fr] gap-x-3">
	<div class="flex flex-col items-center pt-1">
		<span
			class="flex size-7 items-center justify-center rounded-full border border-line text-xs text-muted tnum"
			aria-hidden="true">{index + 1}</span
		>
		{#if index < total - 1}<span class="mt-1 w-px flex-1 bg-rail"></span>{/if}
	</div>

	<div class="min-w-0 pb-5">
		<label for="post-{item.key}" class="sr-only"
			>{total > 1 ? `Post ${index + 1} of ${total}` : 'Post text'}</label
		>
		<textarea
			bind:this={textarea}
			id="post-{item.key}"
			bind:value={item.text}
			use:autosize
			rows="3"
			placeholder={index === 0 ? "What's happening?" : 'Add to the thread'}
			class="block min-h-20 w-full resize-none bg-transparent py-1 text-[1.0625rem] leading-relaxed outline-none placeholder:text-muted focus-visible:outline-none"
		></textarea>

		{#if stats.urls.length}
			<p
				class="mb-2 inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn"
			>
				<Link class="size-3.5" />Contains a link: X bills this post at the link rate
			</p>
		{/if}

		{#if item.media.length || item.uploads.length}
			<div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
				{#each item.media as m, i (m.id + i)}
					<figure class="grid gap-1.5">
						<div
							class="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-2"
						>
							<img src={m.thumbUrl} alt="" class="size-full object-cover" />
							{#if m.kind !== 'image'}
								<span
									class="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white uppercase"
									>{m.kind}</span
								>
							{/if}
							<button
								type="button"
								class="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-black"
								aria-label="Remove {m.originalName}"
								onclick={() => item.media.splice(i, 1)}
							>
								<X class="size-3.5" />
							</button>
						</div>
						{#if m.kind !== 'video'}
							<input
								bind:value={m.alt}
								maxlength="1000"
								placeholder="Describe this image"
								aria-label="Alt text for {m.originalName}"
								class={cn(
									'w-full rounded-md border bg-surface px-2 py-1 text-xs outline-none focus:border-accent',
									m.alt.trim() ? 'border-line' : 'border-warn/60'
								)}
							/>
						{:else}
							<span class="text-xs text-muted">{formatBytes(m.size)}</span>
						{/if}
					</figure>
				{/each}
				{#each item.uploads as u (u)}
					<div
						class="grid aspect-square place-items-center rounded-xl border border-dashed border-line-strong p-3 text-center text-xs text-muted"
					>
						<div class="grid w-full gap-2">
							<span class="truncate">{u.name}</span>
							<span class="h-1 overflow-hidden rounded-full bg-surface-2">
								<span
									class="block h-full bg-accent transition-[width]"
									style="width: {Math.round(u.progress * 100)}%"
								></span>
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if item.poll}
			<div class="mt-3 grid gap-2 rounded-xl border border-line p-3">
				{#each item.poll.options, i (i)}
					<div class="flex gap-2">
						<input
							bind:value={item.poll.options[i]}
							maxlength="25"
							placeholder="Choice {i + 1}"
							aria-label="Poll choice {i + 1}"
							class="h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-accent"
						/>
						{#if item.poll.options.length > 2}
							<button
								type="button"
								class="px-1 text-muted hover:text-bad"
								aria-label="Remove choice {i + 1}"
								onclick={() => item.poll?.options.splice(i, 1)}
							>
								<X class="size-4" />
							</button>
						{/if}
					</div>
				{/each}
				<div class="flex flex-wrap items-center gap-3 text-sm">
					{#if item.poll.options.length < 4}
						<button
							type="button"
							class="text-accent hover:underline"
							onclick={() => item.poll?.options.push('')}>Add a choice</button
						>
					{/if}
					<label class="ml-auto flex items-center gap-2 text-muted">
						Poll length
						<select
							bind:value={item.poll.durationMinutes}
							class="h-8 rounded-md border border-line bg-surface px-2 text-ink"
						>
							{#each DURATIONS as d (d.v)}<option value={d.v}>{d.l}</option>{/each}
						</select>
					</label>
				</div>
			</div>
		{/if}

		<div class="mt-3 flex items-center gap-1 border-t border-line pt-2">
			<input
				bind:this={fileInput}
				type="file"
				accept={ACCEPTED_MIMES.join(',')}
				multiple
				class="hidden"
				onchange={(e) => onFiles(e.currentTarget.files)}
			/>
			<button
				type="button"
				disabled={!canAddMedia}
				onclick={() => fileInput?.click()}
				class="rounded-md p-2 text-accent hover:bg-accent-soft disabled:opacity-40"
				title="Upload media"
				aria-label="Upload media"
			>
				<ImagePlus class="size-5" />
			</button>
			<button
				type="button"
				disabled={!canAddMedia}
				onclick={onlibrary}
				class="rounded-md p-2 text-accent hover:bg-accent-soft disabled:opacity-40"
				title="Choose from media library"
				aria-label="Choose from media library"
			>
				<Images class="size-5" />
			</button>
			{#if index === 0}
				<button
					type="button"
					disabled={item.media.length > 0}
					onclick={togglePoll}
					class={cn(
						'rounded-md p-2 text-accent hover:bg-accent-soft disabled:opacity-40',
						item.poll && 'bg-accent-soft'
					)}
					title="Poll"
					aria-label={item.poll ? 'Remove poll' : 'Add poll'}
					aria-pressed={!!item.poll}
				>
					<ChartBar class="size-5" />
				</button>
			{/if}
			{#if total > 1}
				<button
					type="button"
					onclick={onremove}
					class="rounded-md p-2 text-muted hover:bg-bad-soft hover:text-bad"
					title="Remove this post"
					aria-label="Remove post {index + 1}"
				>
					<Trash class="size-[1.125rem]" />
				</button>
			{/if}
			<div class="ml-auto flex items-center gap-2" aria-live="polite">
				{#if stats.remaining <= 20}
					<span class={cn('text-sm tnum', stats.over ? 'text-bad' : 'text-warn')}
						>{stats.remaining}</span
					>
				{/if}
				<svg
					viewBox="0 0 20 20"
					class="size-5 -rotate-90"
					role="img"
					aria-label="{stats.weighted} of {stats.limit} characters"
				>
					<circle cx="10" cy="10" r="8" fill="none" stroke="var(--line)" stroke-width="2.5" />
					<circle
						cx="10"
						cy="10"
						r="8"
						fill="none"
						stroke={ringColor}
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-dasharray={2 * Math.PI * 8}
						stroke-dashoffset={2 * Math.PI * 8 * (1 - ringPct)}
					/>
				</svg>
			</div>
		</div>
	</div>
</div>
