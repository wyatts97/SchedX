<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import Zap from '@lucide/svelte/icons/zap';
	import Select from '../ui/select.svelte';
	import { toLocalInput, zoned } from '#lib/shared/time.js';

	let {
		when = $bindable(''),
		repeat = $bindable('none'),
		repeatEvery = $bindable(1),
		repeatUntil = $bindable(''),
		tz,
		onpick
	}: {
		/** `YYYY-MM-DDTHH:mm` in `tz`, or '' for "post now". */
		when?: string;
		repeat?: string;
		repeatEvery?: number;
		repeatUntil?: string;
		tz: string;
		/** Called when a time is chosen (so the composer can leave queue mode). */
		onpick?: () => void;
	} = $props();

	const field =
		'block w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:[color-scheme:dark]';

	// Legacy quick-schedule presets.
	const PRESETS: { label: string; at: () => number }[] = [
		{
			label: 'In 1 hour',
			at: () =>
				zoned(Date.now(), tz)
					.add({ hours: 1 })
					.round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'ceil' })
					.epochMilliseconds
		},
		{ label: 'Tomorrow 9 AM', at: () => tomorrowAt(9) },
		{ label: 'Tomorrow 12 PM', at: () => tomorrowAt(12) },
		{ label: 'Tomorrow 6 PM', at: () => tomorrowAt(18) },
		{
			label: 'Next Monday 9 AM',
			at: () => {
				const now = zoned(Date.now(), tz);
				return now
					.add({ days: (8 - now.dayOfWeek) % 7 || 7 })
					.with({ hour: 9, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;
			}
		}
	];

	function tomorrowAt(hour: number): number {
		return zoned(Date.now(), tz)
			.add({ days: 1 })
			.with({ hour, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;
	}

	function pick(at: number) {
		when = toLocalInput(at, tz);
		onpick?.();
	}
</script>

<div class="@container grid gap-4">
	<div class="grid gap-4 @md:grid-cols-[minmax(0,1fr)_12rem]">
		<label class="grid min-w-0 gap-1.5 text-sm font-medium">
			Date & time
			<span class="relative">
				<input
					type="datetime-local"
					bind:value={when}
					oninput={() => onpick?.()}
					class="{field} pr-10 tnum"
					aria-describedby="tz-hint"
				/>
				{#if when}
					<button
						type="button"
						onclick={() => (when = '')}
						class="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
						aria-label="Clear time (post now)"
						title="Clear time"
					>
						<X class="size-4" />
					</button>
				{/if}
			</span>
		</label>
		<div class="grid min-w-0 gap-1.5 text-sm font-medium">
			<label for="repeat-select">Repeat</label>
			<Select
				id="repeat-select"
				bind:value={repeat}
				items={[
					{ value: 'none', label: 'Does not repeat' },
					{ value: 'daily', label: 'Daily' },
					{ value: 'weekly', label: 'Weekly' },
					{ value: 'monthly', label: 'Monthly' }
				]}
				class="h-[2.625rem] shadow-sm"
			/>
		</div>
	</div>

	{#if repeat !== 'none'}
		<div class="flex flex-wrap items-end gap-4 text-sm">
			<label class="grid gap-1.5 font-medium">
				Every
				<span class="flex items-center gap-2 font-normal text-muted">
					<input
						type="number"
						min="1"
						max="30"
						bind:value={repeatEvery}
						class="{field} w-20 tnum"
					/>
					{repeat === 'daily' ? 'days' : repeat === 'weekly' ? 'weeks' : 'months'}
				</span>
			</label>
			<label class="grid gap-1.5 font-medium">
				Stop after <span class="sr-only">(optional)</span>
				<input type="date" bind:value={repeatUntil} class="{field} w-44" />
			</label>
		</div>
	{/if}

	<div>
		<p class="mb-2 text-xs font-medium text-muted">Quick schedule</p>
		<div class="flex flex-wrap gap-2">
			{#each PRESETS as p (p.label)}
				<button
					type="button"
					onclick={() => pick(p.at())}
					class="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-line hover:text-ink"
				>
					<Zap class="size-3" />{p.label}
				</button>
			{/each}
		</div>
		<p id="tz-hint" class="mt-2 text-xs text-muted">
			{when ? `Times are in ${tz}.` : 'No time picked: the post goes out as soon as you post it.'}
		</p>
	</div>
</div>
