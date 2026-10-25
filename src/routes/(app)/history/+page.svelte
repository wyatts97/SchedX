<script lang="ts">
	import { goto } from '$app/navigation';
	import PageHeader from '#lib/components/page-header.svelte';
	import PostCard from '#lib/components/post-card.svelte';
	import EmptyState from '#lib/components/empty-state.svelte';
	import Select from '#lib/components/ui/select.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import { usePendingDeletes } from '#lib/components/shell/pending-deletes.svelte.js';
	import { cn } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const pending = usePendingDeletes();
	const posts = $derived(pending.visible(data.posts));

	function href(params: Record<string, string | number>) {
		const q = new URLSearchParams({ tab: data.tab, account: data.account, page: '1' });
		for (const [k, v] of Object.entries(params)) q.set(k, String(v));
		if (!q.get('account')) q.delete('account');
		if (q.get('page') === '1') q.delete('page');
		return `/history?${q}`;
	}

	let account = $derived(data.account);
	const accountItems = $derived([
		{ value: '', label: 'All accounts' },
		...data.accounts.map((a) => ({ value: a.id, label: `@${a.username}` }))
	]);
</script>

<svelte:head><title>History · SchedX</title></svelte:head>

<PageHeader title="History" description="What went out, and what didn't.">
	{#snippet actions()}
		{#if data.accounts.length > 1}
			<Select
				bind:value={account}
				items={accountItems}
				class="w-48"
				onchange={(v) => goto(href({ account: v }))}
			/>
		{/if}
	{/snippet}
</PageHeader>

<nav class="mb-5 flex gap-1 border-b border-line" aria-label="History tabs">
	{#each [{ id: 'published', label: 'Published' }, { id: 'failed', label: 'Failed & missed' }] as t (t.id)}
		<a
			href={href({ tab: t.id })}
			aria-current={data.tab === t.id ? 'page' : undefined}
			class={cn(
				'-mb-px border-b-2 px-3 py-2 text-sm',
				data.tab === t.id
					? 'border-accent font-semibold text-ink'
					: 'border-transparent text-muted hover:text-ink'
			)}>{t.label}</a
		>
	{/each}
</nav>

{#if posts.length}
	<div class="grid grid-cols-1 gap-3">
		{#each posts as post (post.id)}
			<PostCard {post} tz={data.tz} />
		{/each}
	</div>
	{#if data.pages > 1}
		<nav class="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
			<Button
				size="sm"
				href={data.page > 1 ? href({ page: data.page - 1 }) : undefined}
				disabled={data.page <= 1}>Newer</Button
			>
			<span class="text-muted tnum">Page {data.page} of {data.pages}</span>
			<Button
				size="sm"
				href={data.page < data.pages ? href({ page: data.page + 1 }) : undefined}
				disabled={data.page >= data.pages}>Older</Button
			>
		</nav>
	{/if}
{:else if data.tab === 'published'}
	<EmptyState
		title="Nothing published yet"
		body="Posts appear here with a link to X once they go out."
	/>
{:else}
	<EmptyState
		title="No failures"
		body="If X rejects a post, it lands here with the reason and a one-click retry."
	/>
{/if}
