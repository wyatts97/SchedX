<script lang="ts">
	import { goto, refreshAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import PageHeader from '#lib/components/page-header.svelte';
	import EmptyState from '#lib/components/empty-state.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import Select from '#lib/components/ui/select.svelte';
	import Avatar from '#lib/components/avatar.svelte';
	import { WEEKDAYS, formatDateTime, minutesToHHMM, hhmmToMinutes } from '#lib/shared/time.js';
	import { formatUsd } from '#lib/shared/cost.js';
	import { api, cn } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Slots grouped by time of day: one row per time, with the weekdays it applies to.
	type Row = { time: string; days: number[] };
	function toRows(slots: { weekday: number; minutes: number }[]): Row[] {
		const byTime = new Map<number, number[]>();
		for (const s of slots) byTime.set(s.minutes, [...(byTime.get(s.minutes) ?? []), s.weekday]);
		return [...byTime.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([m, days]) => ({ time: minutesToHHMM(m), days }));
	}

	let rows = $state<Row[]>([]);
	let order = $state<string[]>([]);
	let savingSlots = $state(false);
	let accountSel = $state('');
	$effect.pre(() => {
		rows = toRows(data.slots);
		order = data.queue.map((p) => p.id);
		accountSel = data.accountId ?? '';
	});

	const byId = $derived(new Map(data.queue.map((p) => [p.id, p])));
	const times = $derived(data.queue.map((p) => p.scheduledAt!).sort((a, b) => a - b));
	const account = $derived(data.accounts.find((a) => a.id === data.accountId));
	const dirtySlots = $derived(JSON.stringify(rows) !== JSON.stringify(toRows(data.slots)));

	function toggleDay(row: Row, day: number) {
		row.days = row.days.includes(day)
			? row.days.filter((d) => d !== day)
			: [...row.days, day].sort();
	}

	async function saveSlots() {
		const slots = rows.flatMap((r) => {
			const minutes = hhmmToMinutes(r.time);
			return minutes === null ? [] : r.days.map((weekday) => ({ weekday, minutes }));
		});
		savingSlots = true;
		try {
			await api(`/api/queue/${data.accountId}`, { action: 'slots', slots });
			toast.success('Queue times saved');
			await refreshAll();
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			savingSlots = false;
		}
	}

	async function persistOrder(next: string[]) {
		order = next;
		try {
			await api(`/api/queue/${data.accountId}`, { action: 'reorder', ids: next });
			await refreshAll();
		} catch (err) {
			toast.error((err as Error).message);
		}
	}

	function move(i: number, delta: number) {
		const next = [...order];
		const [it] = next.splice(i, 1);
		next.splice(i + delta, 0, it);
		persistOrder(next);
	}

	async function shuffle() {
		await api(`/api/queue/${data.accountId}`, { action: 'shuffle' });
		toast.success('Queue shuffled');
		await refreshAll();
	}

	let dragFrom = $state<number | null>(null);
</script>

<svelte:head><title>Queue · SchedX</title></svelte:head>

<PageHeader
	title="Queue"
	description="Pick the times you like to post. Anything you add to the queue takes the next free time."
>
	{#snippet actions()}
		{#if data.accounts.length > 1}
			<Select
				bind:value={accountSel}
				class="w-48"
				items={data.accounts.map((a) => ({ value: a.id, label: `@${a.username}` }))}
				onchange={(v) => goto(`/queue?account=${v}`)}
			/>
		{/if}
		<Button href="/compose" variant="primary"><Plus />Add to queue</Button>
	{/snippet}
</PageHeader>

{#if !data.accountId}
	<EmptyState title="Connect an account first" body="Queue times are set per X account.">
		<Button href="/accounts" variant="primary">Connect account</Button>
	</EmptyState>
{:else}
	<div class="grid gap-10 lg:grid-cols-[22rem_minmax(0,1fr)]">
		<section aria-labelledby="slots-h" class="grid content-start gap-4">
			<div>
				<h2 id="slots-h" class="font-semibold">
					Posting times{account ? ` for @${account.username}` : ''}
				</h2>
				<p class="text-sm text-muted">In {data.tz}.</p>
			</div>
			{#each rows as row, i (i)}
				<div class="grid gap-2 rounded-panel border border-line bg-surface p-3">
					<div class="flex items-center gap-2">
						<input
							type="time"
							bind:value={row.time}
							aria-label="Time"
							class="h-9 rounded-ctl border border-line bg-surface px-2 text-sm tnum outline-none focus:border-accent"
						/>
						<button
							type="button"
							class="ml-auto rounded-md p-1.5 text-muted hover:bg-bad-soft hover:text-bad"
							aria-label="Remove time"
							onclick={() => rows.splice(i, 1)}
						>
							<X class="size-4" />
						</button>
					</div>
					<div class="grid grid-cols-7 gap-1" role="group" aria-label="Days">
						{#each WEEKDAYS as d (d.id)}
							{@const on = row.days.includes(d.id)}
							<button
								type="button"
								aria-pressed={on}
								title={d.long}
								onclick={() => toggleDay(row, d.id)}
								class={cn(
									'rounded-md py-1.5 text-xs font-medium',
									on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted hover:text-ink'
								)}
							>
								{d.short.slice(0, 2)}
							</button>
						{/each}
					</div>
				</div>
			{/each}
			<div class="flex flex-wrap gap-2">
				<Button size="sm" onclick={() => rows.push({ time: '12:00', days: [1, 2, 3, 4, 5] })}
					><Plus />Add a time</Button
				>
				<Button
					size="sm"
					variant="primary"
					disabled={!dirtySlots || savingSlots}
					onclick={saveSlots}>Save times</Button
				>
			</div>
			{#if data.nextSlot}
				<p class="text-sm text-muted">
					Next free time: <span class="text-ink tnum">{formatDateTime(data.nextSlot, data.tz)}</span
					>
				</p>
			{/if}
		</section>

		<section aria-labelledby="queue-h" class="min-w-0">
			<div class="mb-4 flex items-center justify-between gap-3">
				<h2 id="queue-h" class="font-semibold">
					In the queue <span class="font-normal text-muted tnum">({order.length})</span>
				</h2>
				{#if order.length > 1}<Button size="sm" variant="ghost" onclick={shuffle}
						><Shuffle />Shuffle</Button
					>{/if}
			</div>
			{#if order.length === 0}
				<EmptyState
					title="The queue is empty"
					body={data.slots.length
						? 'Choose Queue in the composer to line posts up here.'
						: 'Add posting times first, then choose Queue in the composer.'}
				/>
			{:else}
				<ol class="grid gap-2">
					{#each order as id, i (id)}
						{@const post = byId.get(id)}
						{#if post}
							<li
								draggable="true"
								ondragstart={() => (dragFrom = i)}
								ondragover={(e) => e.preventDefault()}
								ondrop={() => {
									if (dragFrom === null || dragFrom === i) return;
									const next = [...order];
									const [it] = next.splice(dragFrom, 1);
									next.splice(i, 0, it);
									dragFrom = null;
									persistOrder(next);
								}}
								class="grid grid-cols-[auto_8.5rem_1fr_auto] items-center gap-3 rounded-panel border border-line bg-surface px-3 py-2.5"
							>
								<GripVertical class="size-4 cursor-grab text-muted" aria-hidden="true" />
								<time class="text-sm font-semibold tnum">{formatDateTime(times[i], data.tz)}</time>
								<a href="/compose?edit={post.id}" class="min-w-0">
									<p class="truncate text-sm">{post.items[0]?.text || 'Media post'}</p>
									<p class="text-xs text-muted">
										<Avatar
											src={post.account.avatarUrl}
											name={post.account.username}
											size="sm"
											class="mr-1 inline-flex size-4 align-[-3px]"
										/>
										{post.items.length > 1 ? `Thread of ${post.items.length} · ` : ''}<span
											class="tnum">{formatUsd(post.estCost)}</span
										>
									</p>
								</a>
								<div class="flex">
									<Button
										size="icon-sm"
										variant="ghost"
										aria-label="Move up"
										disabled={i === 0}
										onclick={() => move(i, -1)}><ArrowUp /></Button
									>
									<Button
										size="icon-sm"
										variant="ghost"
										aria-label="Move down"
										disabled={i === order.length - 1}
										onclick={() => move(i, 1)}><ArrowDown /></Button
									>
								</div>
							</li>
						{/if}
					{/each}
				</ol>
			{/if}
		</section>
	</div>
{/if}
