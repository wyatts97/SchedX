<script lang="ts">
	import { goto, refreshAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Copy from '@lucide/svelte/icons/copy';
	import Trash from '@lucide/svelte/icons/trash-2';
	import FileText from '@lucide/svelte/icons/file-text';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Play from '@lucide/svelte/icons/play';
	import Clock from '@lucide/svelte/icons/clock';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import Square from '@lucide/svelte/icons/square';
	import CheckSquare from '@lucide/svelte/icons/square-check';
	import StatusBadge from './status-badge.svelte';
	import Tweet from './tweet/tweet.svelte';
	import Menu, { type MenuItem } from './ui/menu.svelte';
	import { formatDateTime } from '#lib/shared/time.js';
	import { formatUsd } from '#lib/shared/cost.js';
	import { usePendingDeletes } from './shell/pending-deletes.svelte.js';
	import type { PostView } from '#lib/shared/compose.js';
	import { api, cn } from '#lib/utils.js';

	let {
		post,
		tz,
		selectable = false,
		// No fallback: callers bind to map entries that start out undefined (calendar list view).
		selected = $bindable(),
		class: className
	}: {
		post: PostView;
		tz: string;
		selectable?: boolean;
		selected?: boolean;
		class?: string;
	} = $props();

	const isSelected = $derived(selected ?? false);
	const first = $derived(post.items[0]);
	const posted = $derived(post.items.filter((i) => i.xPostId).length);
	const editable = $derived(
		['draft', 'scheduled', 'failed', 'paused', 'missed'].includes(post.status) && posted === 0
	);
	const xUrl = $derived(
		first?.xPostId ? `https://x.com/${post.account.username}/status/${first.xPostId}` : null
	);
	const when = $derived(post.status === 'published' ? post.publishedAt : post.scheduledAt);

	const tweetItems = $derived(
		post.items.map((i) => ({
			text: i.text,
			poll: i.poll,
			media: i.media.map((m) => ({
				url: m.url,
				thumbUrl: m.thumbUrl,
				kind: m.kind,
				alt: m.attachedAlt
			}))
		}))
	);

	/** Legacy time pill: "in 2h 5m", "Overdue", or the published/scheduled date. */
	function timeLabel(now = Date.now()): string {
		if (post.status === 'draft') return when ? `Draft for ${formatDateTime(when, tz)}` : 'Draft';
		if (!when) return '';
		if (post.status === 'published') return formatDateTime(when, tz);
		if (post.status !== 'scheduled' && post.status !== 'publishing')
			return formatDateTime(when, tz);
		const diff = when - now;
		if (diff < -60_000) return 'Overdue';
		if (diff < 60_000) return 'Now';
		const mins = Math.round(diff / 60_000);
		const d = Math.floor(mins / 1440);
		const h = Math.floor((mins % 1440) / 60);
		const m = mins % 60;
		const rel = d ? `in ${d}d ${h}h` : h ? `in ${h}h ${m}m` : `in ${m}m`;
		return post.queued ? `Est. ${rel}` : rel;
	}

	async function run(action: string, success: string) {
		try {
			const res = await api<{ id?: string }>(`/api/posts/${post.id}`, { action });
			toast.success(success);
			if (action === 'duplicate' && res.id) await goto(`/compose?edit=${res.id}`);
			else await refreshAll();
		} catch (err) {
			toast.error((err as Error).message);
		}
	}

	const pending = usePendingDeletes();

	function remove() {
		pending.schedule({
			ids: [post.id],
			label: post.status === 'published' ? 'Removed from SchedX. It stays on X.' : 'Post deleted',
			requests: [{ url: `/api/posts/${post.id}`, body: { action: 'delete' } }]
		});
	}

	const menu = $derived<(MenuItem | 'separator')[]>([
		...(['failed', 'paused', 'missed', 'draft'].includes(post.status)
			? [
					{
						label: posted ? 'Resume thread now' : 'Publish now',
						icon: Play,
						onselect: () => run('retry', 'Publishing now')
					}
				]
			: []),
		{
			label: 'Duplicate as draft',
			icon: Copy,
			onselect: () => run('duplicate', 'Copied to drafts')
		},
		...(['scheduled', 'failed', 'paused', 'missed'].includes(post.status) && !posted
			? [
					{
						label: 'Move to drafts',
						icon: FileText,
						onselect: () => run('draft', 'Moved to drafts')
					}
				]
			: []),
		...(xUrl
			? [
					{
						label: 'Open on X',
						icon: ExternalLink,
						onselect: () => window.open(xUrl, '_blank', 'noopener')
					}
				]
			: [])
	]);

	const pill =
		'inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-ink-2 shadow-sm ring-1 ring-line';
</script>

<!-- Legacy ScheduledTweets/PublishedTweets item: an action strip above a real-looking post. -->
<article
	class={cn(
		'group w-full max-w-2xl overflow-hidden rounded-xl border bg-surface shadow-sm transition-shadow hover:shadow-md',
		isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-line',
		className
	)}
>
	<div class="flex flex-wrap items-center justify-center gap-2 bg-surface-2 px-3 py-2">
		{#if selectable}
			<button
				type="button"
				onclick={() => (selected = !isSelected)}
				class="rounded p-0.5 text-muted hover:text-ink"
				aria-pressed={isSelected}
				aria-label={isSelected ? 'Deselect post' : 'Select post'}
			>
				{#if isSelected}<CheckSquare class="size-5 text-blue-500" />{:else}<Square
						class="size-5"
					/>{/if}
			</button>
		{/if}
		{#if post.status !== 'scheduled'}<StatusBadge status={post.status} />{/if}
		{#if post.queued && post.status === 'scheduled'}
			<span
				class="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-1 text-xs font-medium text-orange-600 dark:text-orange-300"
			>
				<ListOrdered class="size-3" />Queued
			</span>
		{/if}
		{#if timeLabel()}
			<span class={pill} title={when ? formatDateTime(when, tz) : undefined}>
				<Clock class="size-4 text-muted" /><span class="tnum">{timeLabel()}</span>
			</span>
		{/if}
		{#if post.recurFreq}
			<span class={pill} title="Repeats {post.recurFreq}">
				<Repeat class="size-4 text-muted" />{post.recurFreq}
			</span>
		{/if}
		{#if post.items.length > 1}
			<span class="text-xs text-muted">
				Thread of {post.items.length}{posted && posted < post.items.length
					? `, ${posted} posted`
					: ''}
			</span>
		{/if}
		{#if post.status !== 'published' && post.estCost > 0}
			<span class="text-xs text-muted tnum" title="Estimated X API cost"
				>{formatUsd(post.estCost)}</span
			>
		{/if}
		{#if editable}
			<a
				href="/compose?edit={post.id}"
				class="inline-flex items-center gap-1.5 rounded-full bg-blue-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-600 hover:shadow-md"
			>
				<Pencil class="size-4" />Edit
			</a>
		{/if}
		<button
			type="button"
			onclick={remove}
			disabled={post.status === 'publishing'}
			class="rounded-full bg-red-500 p-2 text-white shadow-sm transition hover:bg-red-600 hover:shadow-md disabled:opacity-50"
			aria-label={post.status === 'published' ? 'Remove from history' : 'Delete post'}
			title={post.status === 'published' ? 'Remove from history' : 'Delete'}
		>
			<Trash class="size-4" />
		</button>
		<Menu items={menu} />
	</div>

	{#if post.lastError && post.status !== 'published'}
		<p
			class={cn(
				'border-t border-line px-4 py-2 text-sm',
				post.status === 'failed' ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn'
			)}
		>
			{post.lastError}
		</p>
	{/if}

	<div class="[&>.tweet]:rounded-none [&>.tweet]:border-0 [&>.tweet]:shadow-none">
		<Tweet
			author={post.account}
			items={tweetItems}
			at={when}
			{tz}
			showActions={post.status === 'published'}
			showXLogo={!xUrl}
			actions={xUrl ? openOnX : undefined}
		/>
	</div>
</article>

{#snippet openOnX()}
	<a
		href={xUrl}
		target="_blank"
		rel="noopener"
		class="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-500/20 dark:text-blue-400"
	>
		<ExternalLink class="size-3.5" />Open on X
	</a>
{/snippet}
