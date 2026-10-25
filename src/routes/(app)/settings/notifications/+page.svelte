<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { refreshAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Button from '#lib/components/ui/button.svelte';
	import Switch from '#lib/components/ui/switch.svelte';
	import { currentSubscription, pushSupported, subscribe, unsubscribe } from '#lib/push-client.js';
	import { NOTIFICATION_EVENTS } from '#lib/shared/types.js';
	import { api } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let supported = $state(true);
	let subscribed = $state(false);
	let busy = $state(false);

	onMount(async () => {
		supported = pushSupported();
		subscribed = !!(await currentSubscription());
	});

	async function toggle() {
		busy = true;
		try {
			if (subscribed) {
				await unsubscribe();
				subscribed = false;
				toast.success('This device will no longer get notifications');
			} else {
				await subscribe(data.vapidKey!);
				subscribed = true;
				toast.success('Notifications turned on for this device');
			}
			await refreshAll();
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			busy = false;
		}
	}

	async function test() {
		try {
			await api('/api/push', { test: true });
			toast.success('Test notification sent');
		} catch (err) {
			toast.error((err as Error).message);
		}
	}
</script>

<svelte:head><title>Notifications · SchedX</title></svelte:head>

<div class="grid gap-10">
	<section class="grid gap-3">
		<h2 class="text-lg font-semibold">Push notifications</h2>
		{#if !data.pushEnabled}
			<p class="text-sm text-muted">
				Push isn't set up on the server. Run <code>npm run gen:secrets</code>, put the VAPID keys in
				<code>.env</code> and restart SchedX.
			</p>
		{:else if !supported}
			<p class="text-sm text-muted">
				This browser doesn't support push. On iPhone and iPad, add SchedX to your Home Screen first,
				then open it from there.
			</p>
		{:else}
			<p class="text-sm text-muted">
				{subscribed
					? 'This device gets notifications.'
					: 'Get a notification on this device when posts go out or need attention.'}
				{data.devices} device{data.devices === 1 ? '' : 's'} subscribed in total.
			</p>
			<div class="flex gap-2">
				<Button variant={subscribed ? 'secondary' : 'primary'} disabled={busy} onclick={toggle}>
					{subscribed ? 'Turn off on this device' : 'Turn on for this device'}
				</Button>
				{#if data.devices > 0}<Button variant="ghost" onclick={test}>Send a test</Button>{/if}
			</div>
		{/if}
	</section>

	<form
		method="POST"
		class="grid gap-4"
		use:enhance={() =>
			async ({ update }) => {
				toast.success('Saved');
				await update({ reset: false });
			}}
	>
		<h2 class="text-lg font-semibold">Notify me when</h2>
		<ul class="grid divide-y divide-line rounded-panel border border-line bg-surface">
			{#each NOTIFICATION_EVENTS as e (e.id)}
				<li class="flex items-center justify-between gap-4 px-4 py-3 text-sm">
					<label for="n-{e.id}">{e.label}</label>
					<Switch id="n-{e.id}" name={e.id} checked={data.prefs[e.id]} />
				</li>
			{/each}
		</ul>
		<p class="text-sm text-muted">
			Email notifications aren't available yet. These choices will apply to email too once it is.
		</p>
		<div><Button type="submit" variant="primary">Save</Button></div>
	</form>
</div>
