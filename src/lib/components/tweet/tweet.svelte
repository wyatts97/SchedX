<script lang="ts">
	import type { Snippet } from 'svelte';
	import Reply from '@lucide/svelte/icons/reply';
	import Repeat2 from '@lucide/svelte/icons/repeat-2';
	import Heart from '@lucide/svelte/icons/heart';
	import Views from '@lucide/svelte/icons/chart-no-axes-column';
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Avatar from '../avatar.svelte';
	import TweetMedia from './tweet-media.svelte';
	import MediaLightbox from './media-lightbox.svelte';
	import { tokenize, type TweetAuthor, type TweetItem } from './types.js';
	import { cn } from '#lib/utils.js';

	let {
		author,
		items,
		at = null,
		tz,
		showXLogo = false,
		showActions = false,
		actions,
		class: className
	}: {
		author: TweetAuthor;
		items: TweetItem[];
		/** Time shown under the first post (scheduled or published time). */
		at?: number | null;
		tz: string;
		showXLogo?: boolean;
		/** X's reply/repost/like row. Legacy hid it for posts that aren't live yet. */
		showActions?: boolean;
		/** Replaces the X logo in the header (legacy action badges). */
		actions?: Snippet;
		class?: string;
	} = $props();

	const first = $derived(items[0]);
	const rest = $derived(items.slice(1));

	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);
	let lightboxMedia = $state<TweetItem['media']>([]);
	function openMedia(media: TweetItem['media'], index: number) {
		lightboxMedia = media;
		lightboxIndex = index;
		lightboxOpen = true;
	}

	// "10:30 AM · Oct 24, 2026", as on an X post page.
	const stamp = $derived.by(() => {
		const ms = at ?? Date.now();
		const time = new Intl.DateTimeFormat(undefined, {
			timeZone: tz,
			hour: 'numeric',
			minute: '2-digit'
		}).format(ms);
		const date = new Intl.DateTimeFormat(undefined, {
			timeZone: tz,
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(ms);
		return `${time} · ${date}`;
	});

	const ACTIONS = [
		{ icon: Reply, label: 'Reply', hover: 'group-hover:text-blue-500' },
		{ icon: Repeat2, label: 'Repost', hover: 'group-hover:text-green-500' },
		{ icon: Heart, label: 'Like', hover: 'group-hover:text-pink-500' },
		{ icon: Views, label: 'Views', hover: 'group-hover:text-blue-400' },
		{ icon: Bookmark, label: 'Bookmark', hover: 'group-hover:text-yellow-500' },
		{ icon: Share2, label: 'Share', hover: 'group-hover:text-blue-400' }
	];
</script>

{#snippet body(item: TweetItem, large: boolean)}
	{#if item.text}
		<p
			class={cn(
				'break-words whitespace-pre-line text-ink',
				large ? 'mt-3 text-xl leading-snug' : 'text-[0.9375rem] leading-normal'
			)}
		>
			{#each tokenize(item.text) as t, i (i)}{#if t.highlight}<span class="text-accent"
						>{t.text}</span
					>{:else}{t.text}{/if}{/each}
		</p>
	{/if}
	{#if item.media.length}
		<TweetMedia media={item.media} class="mt-3" onopen={(i) => openMedia(item.media, i)} />
	{/if}
	{#if item.poll}
		<div class="mt-3 grid gap-2">
			{#each item.poll.options as option, i (i)}
				<span
					class="rounded-full border border-accent px-4 py-1.5 text-center text-[0.9375rem] font-semibold text-accent"
					>{option || `Choice ${i + 1}`}</span
				>
			{/each}
			<span class="text-sm text-muted">
				0 votes · {item.poll.durationMinutes >= 1440
					? `${Math.round(item.poll.durationMinutes / 1440)} day${item.poll.durationMinutes >= 2880 ? 's' : ''} left`
					: `${Math.round(item.poll.durationMinutes / 60)} hours left`}
			</span>
		</div>
	{/if}
{/snippet}

<article
	class={cn(
		'tweet relative flex w-full flex-col rounded-xl border border-line bg-surface p-4 shadow-sm',
		className
	)}
>
	<header class="flex justify-between gap-3">
		<div class="flex min-w-0 items-center">
			<Avatar src={author.avatarUrl} name={author.username} class="size-11 text-sm" />
			<div class="ml-2 min-w-0 text-sm leading-tight">
				<p class="truncate font-semibold text-ink">{author.displayName}</p>
				<p class="truncate text-muted">@{author.username}</p>
			</div>
		</div>
		{#if actions}
			<div class="flex shrink-0 items-start gap-1 sm:gap-2">{@render actions()}</div>
		{:else if showXLogo}
			<svg viewBox="0 0 1200 1227" class="size-7 shrink-0 fill-ink" aria-label="X">
				<path
					d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"
				/>
			</svg>
		{/if}
	</header>

	{#if first}{@render body(first, true)}{/if}

	<p class="mt-3 text-[0.9375rem] text-muted tnum">{stamp}</p>

	{#if showActions}
		<div class="mt-3 flex justify-between border-t border-line pt-3 text-muted">
			{#each ACTIONS as a (a.label)}
				<span class="group flex items-center" title={a.label}>
					<a.icon class={cn('size-5 transition-colors', a.hover)} />
					<span class="sr-only">{a.label}</span>
				</span>
			{/each}
		</div>
	{/if}

	{#if rest.length}
		<!-- Following posts of the thread, in X's timeline style with a connecting line. -->
		<ol class="mt-3 border-t border-line pt-3">
			{#each rest as item, i (i)}
				<li class="grid grid-cols-[2.5rem_1fr] gap-x-3">
					<div class="flex flex-col items-center">
						<Avatar src={author.avatarUrl} name={author.username} class="size-10" />
						{#if i < rest.length - 1}<span class="mt-1 w-0.5 flex-1 bg-line"></span>{/if}
					</div>
					<div class="min-w-0 pb-4">
						<p class="flex min-w-0 gap-1 text-[0.9375rem] leading-tight">
							<span class="truncate font-semibold text-ink">{author.displayName}</span>
							<span class="truncate text-muted">@{author.username}</span>
						</p>
						<div class="mt-0.5">{@render body(item, false)}</div>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</article>

<MediaLightbox bind:open={lightboxOpen} bind:index={lightboxIndex} media={lightboxMedia} />
