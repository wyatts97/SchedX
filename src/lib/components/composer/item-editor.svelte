<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import Images from '@lucide/svelte/icons/images';
	import ChartBar from '@lucide/svelte/icons/chart-bar-big';
	import X from '@lucide/svelte/icons/x';
	import Trash from '@lucide/svelte/icons/trash-2';
	import Link from '@lucide/svelte/icons/link';
	import Upload from '@lucide/svelte/icons/upload';
	import EmojiButton from './emoji-button.svelte';
	import { textStats } from '#lib/shared/text.js';
	import {
		ACCEPTED_MIMES,
		kindForMime,
		validateAttachmentSet,
		formatBytes
	} from '#lib/shared/media-rules.js';
	import { fileDrop, pastedFiles } from '#lib/actions/file-drop.js';
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
		onfocus,
		autofocus = false
	}: {
		item: EditorItem;
		index: number;
		total: number;
		premium: boolean;
		onremove: () => void;
		onlibrary: () => void;
		onfocus?: () => void;
		autofocus?: boolean;
	} = $props();

	let fileInput: HTMLInputElement | undefined = $state();
	let textarea: HTMLTextAreaElement | undefined = $state();
	let dragOver = $state(false);

	const stats = $derived(textStats(item.text, premium));
	const kinds = $derived(item.media.map((m) => m.kind));
	const canAddMedia = $derived(
		!item.poll &&
			item.uploads.length === 0 &&
			(kinds.length === 0 || (kinds.every((k) => k === 'image') && kinds.length < 4))
	);

	// Legacy ring counter: blue, then yellow near the limit, amber at it, red over it.
	const RING = 2 * Math.PI * 12.75;
	const ringPct = $derived(Math.min(1, stats.weighted / stats.limit));
	const ringColor = $derived(
		stats.over
			? '#ef4444'
			: stats.remaining === 0
				? '#f59e0b'
				: stats.remaining <= 20
					? '#eab308'
					: '#3b82f6'
	);
	const nearLimit = $derived(stats.remaining <= 40);

	$effect(() => {
		if (autofocus) textarea?.focus();
	});

	// Grow the textarea with its content (also after emoji inserts, which don't fire `input`).
	$effect(() => {
		void item.text;
		if (!textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = `${textarea.scrollHeight}px`;
	});

	export function focus() {
		textarea?.focus();
	}

	export function addMedia(list: MediaInfo[]) {
		const err = validateAttachmentSet([...kinds, ...list.map((m) => m.kind)]);
		if (err) return void toast.error(err);
		item.media.push(...list.map((m) => ({ ...m, alt: m.altText })));
	}

	/** Uploads files from the picker, a drop or a paste and attaches them to this post. */
	export async function addFiles(files: File[]) {
		if (!files.length) return;
		const unsupported = files.find((f) => !kindForMime(f.type));
		if (unsupported)
			return void toast.error(`${unsupported.name}: use JPG, PNG, WebP, GIF, MP4 or MOV.`);
		if (item.poll) return void toast.error('A post cannot have both a poll and media.');
		if (item.uploads.length) return void toast.error('Wait for the current upload to finish.');
		const err = validateAttachmentSet([...kinds, ...files.map((f) => kindForMime(f.type)!)]);
		if (err) return void toast.error(err);
		await Promise.all(
			files.map(async (file) => {
				item.uploads.push({ name: file.name, progress: 0 });
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

	/** Inserts text at the caret and puts the caret after it (legacy emoji behaviour). */
	export async function insertText(text: string) {
		const start = textarea?.selectionStart ?? item.text.length;
		const end = textarea?.selectionEnd ?? item.text.length;
		item.text = item.text.slice(0, start) + text + item.text.slice(end);
		await tick();
		textarea?.focus();
		textarea?.setSelectionRange(start + text.length, start + text.length);
	}

	function onpaste(e: ClipboardEvent) {
		const files = pastedFiles(e);
		if (!files.length) return;
		e.preventDefault();
		addFiles(files);
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

	const toolButton =
		'flex size-8 items-center justify-center rounded-full bg-surface-2 text-accent transition-colors hover:bg-line disabled:opacity-40';
</script>

<div class="relative" use:fileDrop={{ ondrop: addFiles, onover: (v) => (dragOver = v) }}>
	<div class="mb-1.5 flex items-center justify-between gap-2">
		<label for="post-{item.key}" class="text-sm font-medium text-ink">
			{total > 1 ? `Post ${index + 1} of ${total}` : 'Post'}
		</label>
		<div class="flex items-center gap-2">
			{#if !nearLimit}
				<span class="text-sm text-muted tnum">{stats.weighted}/{stats.limit}</span>
			{/if}
			<span class="relative inline-flex size-7 items-center justify-center" aria-live="polite">
				<svg viewBox="0 0 28 28" class="absolute inset-0 -rotate-90" aria-hidden="true">
					<circle cx="14" cy="14" r="12.75" fill="none" stroke="var(--line)" stroke-width="2.5" />
					<circle
						cx="14"
						cy="14"
						r="12.75"
						fill="none"
						stroke={ringColor}
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-dasharray={RING}
						stroke-dashoffset={RING * (1 - ringPct)}
						class="transition-[stroke-dashoffset] duration-150 ease-out"
					/>
				</svg>
				{#if nearLimit}
					<span
						class={cn(
							'relative text-[9px] font-semibold tnum',
							stats.over ? 'text-red-500' : 'text-amber-500'
						)}>{stats.remaining}</span
					>
				{/if}
				<span class="sr-only">{stats.weighted} of {stats.limit} characters</span>
			</span>
			{#if total > 1}
				<button
					type="button"
					onclick={onremove}
					class="rounded-lg p-1 text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
					title="Remove this post"
					aria-label="Remove post {index + 1}"
				>
					<Trash class="size-4" />
				</button>
			{/if}
		</div>
	</div>

	<div class="relative">
		<textarea
			bind:this={textarea}
			id="post-{item.key}"
			bind:value={item.text}
			{onpaste}
			onfocus={() => onfocus?.()}
			rows={index === 0 ? 4 : 3}
			placeholder={index === 0 ? "What's happening?" : 'Add to the thread'}
			class="block w-full resize-none rounded-lg border-2 border-line-strong bg-surface px-3 pt-2 pb-12 text-[1.0625rem] leading-relaxed shadow-sm transition outline-none placeholder:text-muted focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:px-4 sm:pt-3"
		></textarea>

		<div class="absolute right-3 bottom-3 flex gap-1.5">
			<input
				bind:this={fileInput}
				type="file"
				accept={ACCEPTED_MIMES.join(',')}
				multiple
				class="hidden"
				onchange={(e) => addFiles(Array.from(e.currentTarget.files ?? []))}
			/>
			<button
				type="button"
				disabled={!canAddMedia}
				onclick={() => fileInput?.click()}
				class={toolButton}
				title="Upload media (or drop / paste it)"
				aria-label="Upload media"
			>
				<ImagePlus class="size-4" />
			</button>
			<button
				type="button"
				disabled={!canAddMedia}
				onclick={onlibrary}
				class={toolButton}
				title="Choose from media library"
				aria-label="Choose from media library"
			>
				<Images class="size-4" />
			</button>
			{#if index === 0}
				<button
					type="button"
					disabled={item.media.length > 0}
					onclick={togglePoll}
					class={cn(toolButton, item.poll && 'bg-accent text-white hover:bg-accent')}
					title="Poll"
					aria-label={item.poll ? 'Remove poll' : 'Add poll'}
					aria-pressed={!!item.poll}
				>
					<ChartBar class="size-4" />
				</button>
			{/if}
			<EmojiButton onpick={(emoji) => insertText(emoji)} />
		</div>

		{#if dragOver}
			<div
				class="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-500 bg-blue-500/10 text-sm font-semibold text-blue-600 backdrop-blur-[1px] dark:text-blue-300"
			>
				<Upload class="size-5" />Drop to attach
			</div>
		{/if}
	</div>

	{#if stats.urls.length}
		<p
			class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn"
		>
			<Link class="size-3.5" />Contains a link: X bills this post at the link rate
		</p>
	{/if}

	{#if item.media.length || item.uploads.length}
		<div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each item.media as m, i (m.id + i)}
				<figure class="grid gap-1.5">
					<div
						class="relative aspect-square overflow-hidden rounded-lg border border-line bg-surface-2"
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
							class="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-red-600"
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
								'w-full rounded-md border bg-surface px-2 py-1 text-xs outline-none focus:border-blue-500',
								m.alt.trim() ? 'border-line' : 'border-amber-500/60'
							)}
						/>
					{:else}
						<span class="text-xs text-muted">{formatBytes(m.size)}</span>
					{/if}
				</figure>
			{/each}
			{#each item.uploads as u (u)}
				<div
					class="grid aspect-square place-items-center rounded-lg border border-dashed border-line-strong p-3 text-center text-xs text-muted"
				>
					<div class="grid w-full gap-2">
						<span class="truncate">{u.name}</span>
						<span class="h-1.5 overflow-hidden rounded-full bg-surface-2">
							<span
								class="block h-full bg-blue-600 transition-[width] duration-300"
								style="width: {Math.round(u.progress * 100)}%"
							></span>
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if item.poll}
		<div class="mt-3 grid gap-2 rounded-lg border border-line bg-surface-2/50 p-3">
			{#each item.poll.options, i (i)}
				<div class="flex gap-2">
					<input
						bind:value={item.poll.options[i]}
						maxlength="25"
						placeholder="Choice {i + 1}"
						aria-label="Poll choice {i + 1}"
						class="h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-blue-500"
					/>
					{#if item.poll.options.length > 2}
						<button
							type="button"
							class="px-1 text-muted hover:text-red-500"
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
</div>
