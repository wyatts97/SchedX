<script lang="ts">
	import { goto, refreshAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PageHeader from '#lib/components/page-header.svelte';
	import PostCalendar from '#lib/components/post-calendar.svelte';
	import PostCard from '#lib/components/post-card.svelte';
	import EmptyState from '#lib/components/empty-state.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import Select from '#lib/components/ui/select.svelte';
	import { HOUR, DAY } from '#lib/shared/time.js';
	import { api, cn } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let account = $derived(data.account);
	let selected = $state<Record<string, boolean>>({});
	const upcoming = $derived(
		data.posts.filter((p) =>
			['scheduled', 'publishing', 'paused', 'needs_verification'].includes(p.status)
		)
	);
	const selectedIds = $derived(
		Object.keys(selected).filter((id) => selected[id] && upcoming.some((p) => p.id === id))
	);

	function href(params: Record<string, string>) {
		const q = new URLSearchParams({ view: data.view, account: data.account, ...params });
		if (q.get('view') === 'calendar') q.delete('view');
		if (!q.get('account')) q.delete('account');
		const s = q.toString();
		return s ? `/calendar?${s}` : '/calendar';
	}

	async function bulk(action: 'delete' | 'shift', deltaMs?: number) {
		if (action === 'delete' && !confirm(`Delete ${selectedIds.length} post(s)?`)) return;
		try {
			const { count } = await api<{ count: number }>('/api/posts/bulk', {
				action,
				ids: selectedIds,
				deltaMs
			});
			toast.success(action === 'delete' ? `Deleted ${count}` : `Moved ${count}`);
			selected = {};
			await refreshAll();
		} catch (err) {
			toast.error((err as Error).message);
		}
	}
</script>

<svelte:head><title>Calendar · SchedX</title></svelte:head>

<PageHeader
	title="Calendar"
	description="Drag a post to move it. Click an empty day or time to write a post for it."
>
	{#snippet actions()}
		{#if data.accounts.length > 1}
			<Select
				bind:value={account}
				class="w-44"
				items={[
					{ value: '', label: 'All accounts' },
					...data.accounts.map((a) => ({ value: a.id, label: `@${a.username}` }))
				]}
				onchange={(v) => goto(href({ account: v }))}
			/>
		{/if}
		<div
			class="flex rounded-ctl border border-line bg-surface p-0.5"
			role="tablist"
			aria-label="View"
		>
			{#each [{ id: 'calendar', label: 'Calendar' }, { id: 'list', label: 'List' }] as v (v.id)}
				<a
					href={href({ view: v.id })}
					role="tab"
					aria-selected={data.view === v.id}
					class={cn(
						'rounded-[0.5rem] px-3 py-1.5 text-sm',
						data.view === v.id ? 'bg-accent-soft font-semibold' : 'text-muted hover:text-ink'
					)}>{v.label}</a
				>
			{/each}
		</div>
	{/snippet}
</PageHeader>

{#if data.view === 'calendar'}
	<PostCalendar posts={data.posts} accounts={data.accounts} tz={data.tz} />
{:else if upcoming.length === 0}
	<EmptyState
		title="Nothing scheduled"
		body="Scheduled and queued posts show up here, soonest first."
	>
		<Button href="/compose" variant="primary">Write a post</Button>
	</EmptyState>
{:else}
	{#if selectedIds.length}
		<div
			class="sticky top-14 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-panel border border-accent/40 bg-raised px-4 py-2.5 shadow-pop md:top-4"
		>
			<span class="mr-2 text-sm font-medium tnum">{selectedIds.length} selected</span>
			<Button size="sm" onclick={() => bulk('shift', HOUR)}>Later by 1 hour</Button>
			<Button size="sm" onclick={() => bulk('shift', DAY)}>Later by 1 day</Button>
			<Button size="sm" onclick={() => bulk('shift', 7 * DAY)}>Later by 1 week</Button>
			<Button size="sm" variant="danger-ghost" onclick={() => bulk('delete')}>Delete</Button>
			<Button size="sm" variant="ghost" class="ml-auto" onclick={() => (selected = {})}
				>Clear</Button
			>
		</div>
	{/if}
	<div class="grid grid-cols-1 gap-3">
		{#each upcoming as post (post.id)}
			<PostCard {post} tz={data.tz} selectable bind:selected={selected[post.id]} />
		{/each}
	</div>
{/if}
