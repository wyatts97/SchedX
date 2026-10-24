<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Button from '#lib/components/ui/button.svelte';
	import { formatBytes } from '#lib/shared/media-rules.js';
	import { formatDateTime, formatRelative } from '#lib/shared/time.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let importing = $state(false);
	// SvelteKit's default version name is the build timestamp.
	const build = $derived(
		/^\d{12,}$/.test(data.info.version)
			? formatDateTime(Number(data.info.version), data.tz)
			: data.info.version
	);
</script>

<svelte:head><title>System · SchedX</title></svelte:head>

<div class="grid gap-10">
	<section class="grid gap-3">
		<h2 class="text-lg font-semibold">Status</h2>
		<dl class="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
			<dt class="text-muted">Scheduler</dt>
			<dd>
				{#if !data.scheduler.running}Off (SCHEDULER=off){:else if data.scheduler.heartbeat}Running,
					last check {formatRelative(data.scheduler.heartbeat.lastTick)}{:else}Starting{/if}
			</dd>
			<dt class="text-muted">Last post sent</dt>
			<dd>
				{data.scheduler.heartbeat?.lastPublished
					? formatDateTime(data.scheduler.heartbeat.lastPublished, data.tz)
					: 'Not yet'}
			</dd>
			<dt class="text-muted">X API</dt>
			<dd>{data.info.xMode === 'mock' ? 'Mock (nothing is posted or billed)' : 'Live'}</dd>
			<dt class="text-muted">Data folder</dt>
			<dd class="break-all"><code>{data.info.dataDir}</code></dd>
			<dt class="text-muted">Build</dt>
			<dd class="tnum">
				{build} · Node {data.info.node}
			</dd>
		</dl>
	</section>

	<section class="grid gap-3">
		<div>
			<h2 class="text-lg font-semibold">Backups</h2>
			<p class="text-sm text-muted">
				SchedX copies its database to <code>backups/</code> in the data folder every night at 03:30
				and keeps the last 7. Media files aren't included; back up the <code>uploads/</code> folder separately.
			</p>
		</div>
		{#if data.backups.length}
			<ul class="grid divide-y divide-line rounded-panel border border-line bg-surface text-sm">
				{#each data.backups as b (b.name)}
					<li class="flex justify-between gap-3 px-4 py-2.5">
						<span class="tnum">{b.name}</span><span class="text-muted tnum"
							>{formatBytes(b.size)}</span
						>
					</li>
				{/each}
			</ul>
		{/if}
		<form
			method="POST"
			action="?/backup"
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type === 'success') toast.success('Backup created');
					await update();
				}}
		>
			<Button type="submit">Back up now</Button>
		</form>
	</section>

	<form
		method="POST"
		action="?/import"
		enctype="multipart/form-data"
		class="grid gap-3"
		use:enhance={() => {
			importing = true;
			return async ({ update }) => {
				await update();
				importing = false;
			};
		}}
	>
		<div>
			<h2 class="text-lg font-semibold">Import posts from CSV</h2>
			<p class="text-sm text-muted">
				Use a header row with <code>text</code>, and optionally <code>scheduled_at</code> and
				<code>account</code>. Dates can be ISO 8601 or <code>2026-11-02 09:30</code> in your time zone.
				Rows without a date go into the queue.
			</p>
		</div>
		<input
			type="file"
			name="csv"
			accept=".csv,text/csv"
			required
			class="text-sm file:mr-3 file:rounded-ctl file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-ink"
		/>
		<div>
			<Button type="submit" disabled={importing}>{importing ? 'Importing…' : 'Import'}</Button>
		</div>
		{#if form?.importError}<p class="text-sm text-bad">{form.importError}</p>{/if}
		{#if form?.imported !== undefined}
			<p class="text-sm">Imported {form.imported} post{form.imported === 1 ? '' : 's'}.</p>
			{#if form.importErrors?.length}
				<ul class="grid gap-1 rounded-panel bg-bad-soft p-3 text-sm text-bad">
					{#each form.importErrors as e, i (i)}<li>{e}</li>{/each}
				</ul>
			{/if}
		{/if}
	</form>
</div>
