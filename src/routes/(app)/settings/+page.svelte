<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Field from '#lib/components/ui/field.svelte';
	import Input from '#lib/components/ui/input.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import { timeZones } from '#lib/shared/time.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const zones = timeZones();
	const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
</script>

<svelte:head><title>Settings · SchedX</title></svelte:head>

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
