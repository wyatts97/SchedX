<script lang="ts" module>
	export interface Spend {
		spent: number;
		budget: number;
		projected: number;
		cycleEnd: number;
	}
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { formatUsd } from '#lib/shared/cost.js';
	import { cn } from '#lib/utils.js';

	let { spend, collapsed = false }: { spend: Spend; collapsed?: boolean } = $props();

	const capped = $derived(spend.budget > 0);
	const pct = $derived(capped ? Math.min(100, (spend.spent / spend.budget) * 100) : 0);
	const projectedPct = $derived(
		capped ? Math.min(100 - pct, (spend.projected / spend.budget) * 100) : 0
	);
	const tone = $derived(pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-accent');
	const stroke = $derived(pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : 'var(--accent)');
	const cycleEnd = $derived(
		new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
			spend.cycleEnd - 1
		)
	);
	const summary = $derived(
		`X API spend: ${formatUsd(spend.spent)}${capped ? ` of ${formatUsd(spend.budget)}` : ' this cycle'}` +
			(spend.projected > 0 ? `, ${formatUsd(spend.projected)} more scheduled` : '') +
			`. Cycle ends ${cycleEnd}.`
	);
	// A string, not markup: Svelte trims the leading space of an element's text.
	const ofBudget = $derived(capped ? ` / ${formatUsd(spend.budget)}` : ' this cycle');
	const active = $derived(page.url.pathname === '/settings/budget');
	const RING = 2 * Math.PI * 15;
</script>

<a
	href="/settings/budget"
	title={summary}
	aria-label={summary}
	class={cn(
		'block rounded-xl transition-colors hover:bg-surface-2',
		collapsed ? 'mx-auto w-fit p-1.5' : 'px-3 py-2.5',
		active && 'bg-nav-active'
	)}
>
	{#if collapsed}
		<!-- Ring meter for the icon-only sidebar -->
		<span class="relative flex size-9 items-center justify-center">
			<svg viewBox="0 0 36 36" class="absolute inset-0 -rotate-90" aria-hidden="true">
				<circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" stroke-width="3" />
				{#if capped}
					<circle
						cx="18"
						cy="18"
						r="15"
						fill="none"
						{stroke}
						stroke-width="3"
						stroke-linecap="round"
						stroke-dasharray={RING}
						stroke-dashoffset={RING * (1 - pct / 100)}
					/>
				{/if}
			</svg>
			<span class="relative text-[0.625rem] font-semibold text-ink-2 tnum" aria-hidden="true">
				{capped ? `${Math.round(pct)}%` : '$'}
			</span>
		</span>
	{:else}
		<span class="block text-xs font-medium text-muted" aria-hidden="true">X API spend</span>
		<span class="mt-0.5 block text-sm font-semibold text-ink tnum" aria-hidden="true">
			{formatUsd(spend.spent)}<span class="font-normal text-muted">{ofBudget}</span>
		</span>
		{#if capped}
			<span class="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
				<span class={cn('h-full', tone)} style="width: {pct}%"></span>
				<span class="h-full bg-accent/30" style="width: {projectedPct}%"></span>
			</span>
		{/if}
		{#if spend.projected > 0}
			<span class="mt-1.5 block text-xs text-muted tnum" aria-hidden="true">
				+{formatUsd(spend.projected)} scheduled
			</span>
		{/if}
	{/if}
</a>
