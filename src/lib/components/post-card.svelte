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
	import Avatar from './avatar.svelte';
	import StatusBadge from './status-badge.svelte';
	import Menu, { type MenuItem } from './ui/menu.svelte';
	import { formatDateTime } from '#lib/shared/time.js';
	import { formatUsd } from '#lib/shared/cost.js';
	import type { PostView } from '#lib/shared/compose.js';
	import { api, cn } from '#lib/utils.js';

	let {
		post,
		tz,
		selectable = false,
		selected = $bindable(false),
		class: className
	}: {
		post: PostView;
		tz: string;
		selectable?: boolean;
		selected?: boolean;
		class?: string;
	} = $props();

	const first = $derived(post.items[0]);
	const posted = $derived(post.items.filter((i) => i.xPostId).length);
	const media = $derived(post.items.flatMap((i) => i.media).slice(0, 4));
	const editable = $derived(
		['draft', 'scheduled', 'failed', 'paused', 'missed'].includes(post.status) && posted === 0
	);
	const xUrl = $derived(
		first?.xPostId ? `https://x.com/${post.account.username}/status/${first.xPostId}` : null
	);
	const when = $derived(post.status === 'published' ? post.publishedAt : post.scheduledAt);

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

	const items = $derived<(MenuItem | 'separator')[]>([
		...(editable
			? [{ label: 'Edit', icon: Pencil, onselect: () => goto(`/compose?edit=${post.id}`) }]
			: []),
		...(['failed', 'paused', 'missed'].includes(post.status)
			? [
					{
						label: posted ? 'Resume thread now' : 'Publish now',
						icon: Play,
						onselect: () => run('retry', 'Publishing now')
					}
				]
			: []),
		...(post.status === 'draft'
			? [{ label: 'Publish now', icon: Play, onselect: () => run('retry', 'Publishing now') }]
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
			: []),
		'separator',
		{
			label: post.status === 'published' ? 'Remove from history' : 'Delete',
			icon: Trash,
			danger: true,
			disabled: post.status === 'publishing',
			onselect: () => {
				if (
					confirm(
						post.status === 'published' ? 'Remove from SchedX? It stays on X.' : 'Delete this post?'
					)
				) {
					run('delete', 'Deleted');
				}
			}
		}
	]);
</script>

<article
	class={cn(
		'group relative grid gap-3 rounded-panel border border-line bg-surface p-4 transition-colors',
		selected && 'border-accent',
		className
	)}
>
	<div class="flex items-center gap-2.5">
		{#if selectable}
			<input
				type="checkbox"
				bind:checked={selected}
				class="size-4 accent-(--accent)"
				aria-label="Select post"
			/>
		{/if}
		<Avatar src={post.account.avatarUrl} name={post.account.username} size="sm" />
		<span class="truncate text-sm font-medium">@{post.account.username}</span>
		<StatusBadge status={post.status} queued={post.queued} />
		{#if post.recurFreq}
			<span
				class="inline-flex items-center gap-1 text-xs text-muted"
				title="Repeats {post.recurFreq}"
			>
				<Repeat class="size-3.5" />{post.recurFreq}
			</span>
		{/if}
		<span class="ml-auto"><Menu {items} /></span>
	</div>

	{#if first?.text}
		<p class="line-clamp-4 text-[0.9375rem] break-words whitespace-pre-line">{first.text}</p>
	{/if}

	{#if media.length}
		<div class="flex gap-2">
			{#each media as m (m.id)}
				<img
					src={m.thumbUrl}
					alt={m.attachedAlt || m.originalName}
					class="size-14 rounded-lg border border-line object-cover"
					loading="lazy"
				/>
			{/each}
		</div>
	{/if}

	{#if first?.poll}
		<p class="text-sm text-muted">Poll · {first.poll.options.length} options</p>
	{/if}

	{#if post.lastError && post.status !== 'published'}
		<p
			class={cn(
				'rounded-lg px-3 py-2 text-sm',
				post.status === 'failed' ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn'
			)}
		>
			{post.lastError}
		</p>
	{/if}

	<footer class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted">
		{#if when}
			<time class="tnum" datetime={new Date(when).toISOString()}>{formatDateTime(when, tz)}</time>
		{/if}
		{#if post.items.length > 1}
			<span
				>Thread of {post.items.length}{posted && posted < post.items.length
					? `, ${posted} posted`
					: ''}</span
			>
		{/if}
		{#if post.status !== 'published' && post.estCost > 0}
			<span class="ml-auto tnum" title="Estimated X API cost">{formatUsd(post.estCost)}</span>
		{/if}
		{#if xUrl}
			<a href={xUrl} target="_blank" rel="noopener" class="ml-auto text-accent hover:underline"
				>View on X</a
			>
		{/if}
	</footer>
</article>
