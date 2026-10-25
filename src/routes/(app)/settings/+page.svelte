<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Field from '#lib/components/ui/field.svelte';
	import Input from '#lib/components/ui/input.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import { timeZones } from '#lib/shared/time.js';
	import { THEME_LABELS, useTheme } from '#lib/components/shell/theme.svelte.js';
	import { cn } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const zones = timeZones();
	const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const theme = useTheme();
</script>

<svelte:head><title>Settings · SchedX</title></svelte:head>

<section class="mb-8 grid gap-3" aria-labelledby="theme-h">
	<h2 id="theme-h" class="text-sm font-medium">Theme</h2>
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-labelledby="theme-h">
		{#each ['system', 'light', 'dark', 'black'] as const as t (t)}
			<button
				type="button"
				role="radio"
				aria-checked={theme.current === t}
				onclick={() => theme.set(t)}
				class={cn(
					'rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-colors',
					theme.current === t
						? 'border-blue-500 bg-blue-500/10 text-ink'
						: 'border-line text-ink-2 hover:bg-surface-2'
				)}
			>
				{THEME_LABELS[t]}
			</button>
		{/each}
	</div>
	<p class="text-xs text-muted">The button in the sidebar cycles Light, Dim and Lights out.</p>
</section>

<form
	method="POST"
	class="grid gap-6"
	use:enhance={() =>
		async ({ result, update }) => {
			if (result.type === 'success') toast.success('Settings saved');
			await update({ reset: false });
		}}
>
	<Field
		label="Time zone"
		for="timezone"
		hint={browserTz !== data.tz
			? `This device is in ${browserTz}.`
			: 'Used for the calendar, the queue and scheduling.'}
	>
		<select
			id="timezone"
			name="timezone"
			class="h-10 rounded-ctl border border-line bg-surface px-3 text-sm"
		>
			{#each zones as z (z)}<option value={z} selected={z === data.tz}
					>{z.replaceAll('_', ' ')}</option
				>{/each}
		</select>
	</Field>
	<Field
		label="Catch-up window (minutes)"
		for="catchUp"
		hint="If SchedX was offline when a post was due, it still goes out late if it's within this window. Older posts wait for you to review them."
	>
		<Input
			id="catchUp"
			name="catchUpMinutes"
			type="number"
			min="0"
			max="1440"
			value={String(data.catchUpMinutes)}
			class="w-32"
		/>
	</Field>
	{#if form?.error}<p class="text-sm text-bad">{form.error}</p>{/if}
	<div><Button type="submit" variant="primary">Save changes</Button></div>
</form>
