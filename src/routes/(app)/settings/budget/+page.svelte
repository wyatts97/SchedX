<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Field from '#lib/components/ui/field.svelte';
	import Input from '#lib/components/ui/input.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import { formatUsd } from '#lib/shared/cost.js';
	import type { Rates } from '#lib/shared/types.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const RATE_LABELS: Record<keyof Rates, string> = {
		post: 'Post',
		postWithUrl: 'Post containing a link',
		mediaMetadata: 'Image description (alt text)',
		userRead: 'Account lookup',
		postRead: 'Post read',
		ownedRead: 'Reading your own posts'
	};
	const OP_LABELS: Record<string, string> = {
		'post.create': 'Posts',
		'post.create_url': 'Posts with links',
		'media.metadata': 'Image descriptions',
		'user.read': 'Account lookups',
		'post.read.owned': 'Delivery checks'
	};
	const fmtDate = (ms: number) =>
		new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
			ms
		);

	const saved =
		() =>
		async ({
			result,
			update
		}: {
			result: { type: string };
			update: (o?: { reset?: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'success') toast.success('Saved');
			await update({ reset: false });
		};
</script>

<svelte:head><title>Budget · SchedX</title></svelte:head>

<div class="grid gap-10">
	<section class="grid gap-4">
		<div>
			<h2 class="text-lg font-semibold">This billing cycle</h2>
			<p class="text-sm text-muted">
				{fmtDate(data.cycle.start)} to {fmtDate(data.cycle.end - 1)}, estimated from the rates
				below.
			</p>
		</div>
		<table class="w-full text-sm">
			<tbody class="divide-y divide-line">
				{#each data.byOp as row (row.op)}
					<tr>
						<td class="py-2">{OP_LABELS[row.op] ?? row.op}</td>
						<td class="py-2 text-right text-muted tnum">{row.units}</td>
						<td class="w-24 py-2 text-right tnum">{formatUsd(row.cost)}</td>
					</tr>
				{:else}
					<tr><td class="py-2 text-muted" colspan="3">Nothing billed yet this cycle.</td></tr>
				{/each}
			</tbody>
			<tfoot>
				<tr class="border-t-2 border-line-strong font-semibold">
					<td class="py-2">Spent</td>
					<td></td>
					<td class="py-2 text-right tnum">{formatUsd(data.spent)}</td>
				</tr>
				<tr class="text-muted">
					<td class="py-1">Still scheduled this cycle</td>
					<td></td>
					<td class="py-1 text-right tnum">{formatUsd(data.projected)}</td>
				</tr>
			</tfoot>
		</table>
		{#if data.pausedCount}
			<form
				method="POST"
				action="?/resume"
				use:enhance={() =>
					async ({ update }) => {
						toast.success('Resumed budget-paused posts');
						await update();
					}}
			>
				<Button type="submit" size="sm">Resume posts paused by the budget</Button>
			</form>
		{/if}
	</section>

	<form method="POST" action="?/budget" class="grid gap-5" use:enhance={saved}>
		<h2 class="text-lg font-semibold">Monthly budget</h2>
		<div class="grid gap-5 sm:grid-cols-3">
			<Field label="Hard cap (USD)" for="cap" hint="0 turns the cap off.">
				<Input
					id="cap"
					name="monthlyUsd"
					type="number"
					step="0.01"
					min="0"
					value={String(data.budget.monthlyUsd)}
				/>
			</Field>
			<Field label="Warn at (%)" for="warn">
				<Input
					id="warn"
					name="warnPct"
					type="number"
					min="1"
					max="100"
					value={String(data.budget.warnPct)}
				/>
			</Field>
			<Field label="Cycle starts on day" for="day" hint="Match your X billing date.">
				<Input
					id="day"
					name="cycleDay"
					type="number"
					min="1"
					max="28"
					value={String(data.budget.cycleDay)}
				/>
			</Field>
		</div>
		<p class="text-sm text-muted">
			When the next post would go over the cap, SchedX pauses it and tells you instead of spending
			more. For a second safety net, also set a spending limit in the X Developer Console.
		</p>
		{#if form?.error}<p class="text-sm text-bad">{form.error}</p>{/if}
		<div><Button type="submit" variant="primary">Save budget</Button></div>
	</form>

	<form method="POST" action="?/rates" class="grid gap-4" use:enhance={saved}>
		<div>
			<h2 class="text-lg font-semibold">X API prices</h2>
			<p class="text-sm text-muted">
				Pre-filled with X's published pay-per-use prices (October 2026). Update them if X changes
				its pricing.
			</p>
		</div>
		<div class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
			{#each Object.entries(RATE_LABELS) as [key, label] (key)}
				<label class="flex items-center justify-between gap-3 text-sm">
					{label}
					<span class="flex items-center gap-1 text-muted"
						>$<Input
							name={key}
							type="number"
							step="0.001"
							min="0"
							value={String(data.rates[key as keyof Rates])}
							class="h-9 w-24 text-right tnum"
						/></span
					>
				</label>
			{/each}
		</div>
		<div class="flex gap-2">
			<Button type="submit" variant="primary">Save prices</Button>
			<Button type="submit" variant="ghost" formaction="?/resetRates">Reset to defaults</Button>
		</div>
	</form>
</div>
