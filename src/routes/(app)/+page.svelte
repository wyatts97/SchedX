<script lang="ts">
	import PenLine from '@lucide/svelte/icons/pen-line';
	import TimeRail from '#lib/components/time-rail.svelte';
	import PostCard from '#lib/components/post-card.svelte';
	import EmptyState from '#lib/components/empty-state.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import Avatar from '#lib/components/avatar.svelte';
	import { formatUsd } from '#lib/shared/cost.js';
	import { formatRelative } from '#lib/shared/time.js';
	import { usePendingDeletes } from '#lib/components/shell/pending-deletes.svelte.js';
	import { cn } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const pending = usePendingDeletes();
	const attention = $derived(pending.visible(data.attention));

	const reauth = $derived(data.accounts.filter((a) => a.status === 'needs_reauth'));
	const scheduled = $derived(data.counts.scheduled ?? 0);
	const spendPct = $derived(
		data.spend.budget > 0 ? Math.min(100, (data.spend.spent / data.spend.budget) * 100) : 0
	);
	const projectedPct = $derived(
		data.spend.budget > 0
			? Math.min(100 - spendPct, (data.spend.projected / data.spend.budget) * 100)
			: 0
	);
	const beatAge = $derived(
		data.scheduler.heartbeat ? Date.now() - data.scheduler.heartbeat.lastTick : null
	);
	const healthy = $derived(data.scheduler.running && beatAge !== null && beatAge < 2 * 60_000);
	const cycleEnd = $derived(
		new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
			data.spend.cycleEnd - 1
		)
	);
</script>

<svelte:head><title>SchedX</title></svelte:head>

<div class="mb-8 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold sm:text-[1.75rem]">
			{#if scheduled === 0}Nothing scheduled{:else}{scheduled} post{scheduled > 1 ? 's' : ''} on the way{/if}
		</h1>
		<p class="mt-1 flex items-center gap-2 text-sm text-muted">
			<span class={cn('size-2 rounded-full', healthy ? 'bg-ok' : 'bg-warn')} aria-hidden="true"
			></span>
			{#if !data.scheduler.running}
				Scheduler is turned off (SCHEDULER=off)
			{:else if beatAge === null}
				Scheduler starting…
			{:else}
				Scheduler checked {formatRelative(Date.now() - beatAge)}
			{/if}
		</p>
	</div>
	<Button href="/compose" variant="primary"><PenLine />New post</Button>
</div>

{#if data.accounts.length === 0}
	<EmptyState
		title="Connect an X account to start"
		body="SchedX posts on behalf of the accounts you connect. You can connect more than one."
	>
		<Button href="/accounts" variant="primary">Connect account</Button>
	</EmptyState>
{/if}

{#each reauth as a (a.id)}
	<div
		class="mb-4 flex flex-wrap items-center gap-3 rounded-panel border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn"
	>
		<Avatar src={a.avatarUrl} name={a.username} size="sm" />
		<span class="flex-1"
			>@{a.username} lost its connection to X. Posts for it are paused until you reconnect.</span
		>
		<Button href="/auth/x/connect" size="sm" variant="secondary" data-sveltekit-reload
			>Reconnect</Button
		>
	</div>
{/each}

<div class="grid grid-cols-1 gap-10">
	<section aria-labelledby="up-next">
		{#if data.accounts.length}<h2 id="up-next" class="mb-4 text-lg font-semibold">Up next</h2>{/if}
		{#if data.upcoming.length}
			<TimeRail posts={data.upcoming} tz={data.tz} />
			<a href="/calendar" class="mt-5 inline-block pl-[5.75rem] text-sm text-accent hover:underline"
				>See everything in the calendar</a
			>
		{:else if data.accounts.length}
			<EmptyState
				title="Your timeline is clear"
				body="Write something now, or set up queue times so posts go out on a rhythm."
			>
				<Button href="/compose" variant="primary">Write a post</Button>
				<Button href="/queue">Set up queue</Button>
			</EmptyState>
		{/if}

		{#if attention.length}
			<h2 class="mt-12 mb-4 text-lg font-semibold">Needs your attention</h2>
			<div class="grid grid-cols-1 gap-3">
				{#each attention as post (post.id)}
					<PostCard {post} tz={data.tz} />
				{/each}
			</div>
		{/if}
	</section>

	<!-- On desktop the spend meter lives in the sidebar; phones and tablets get this card. -->
	<aside class="grid max-w-md content-start gap-8 lg:hidden">
		<section aria-labelledby="spend" class="grid gap-3">
			<h2 id="spend" class="text-lg font-semibold">X API spend</h2>
			<p>
				<span class="text-3xl font-semibold tracking-tight tnum">{formatUsd(data.spend.spent)}</span
				>
				{#if data.spend.budget > 0}
					<span class="text-sm text-muted tnum"> of {formatUsd(data.spend.budget)}</span>
				{/if}
			</p>
			{#if data.spend.budget > 0}
				<div
					class="flex h-2 overflow-hidden rounded-full bg-surface-2"
					role="img"
					aria-label="{spendPct.toFixed(0)}% of budget used"
				>
					<span
						class={cn(
							'h-full',
							spendPct >= 90 ? 'bg-bad' : spendPct >= 70 ? 'bg-warn' : 'bg-accent'
						)}
						style="width: {spendPct}%"
					></span>
					<span class="h-full bg-accent/30" style="width: {projectedPct}%"></span>
				</div>
			{/if}
			<dl class="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
				<dt class="text-muted">Still scheduled this cycle</dt>
				<dd class="text-right tnum">{formatUsd(data.spend.projected)}</dd>
				<dt class="text-muted">Cycle ends</dt>
				<dd class="text-right">{cycleEnd}</dd>
			</dl>
			<p class="text-[0.8125rem] text-muted">
				Estimated from X's published prices. Your Developer Console has the exact bill.
				<a href="/settings/budget" class="text-accent hover:underline">Budget settings</a>
			</p>
		</section>
	</aside>
</div>
