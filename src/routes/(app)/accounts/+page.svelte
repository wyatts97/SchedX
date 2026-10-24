<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '#lib/components/page-header.svelte';
	import Avatar from '#lib/components/avatar.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import Switch from '#lib/components/ui/switch.svelte';
	import Dialog from '#lib/components/ui/dialog.svelte';
	import EmptyState from '#lib/components/empty-state.svelte';
	import type { AccountView } from '#lib/shared/compose.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let confirmFor = $state<AccountView | null>(null);
	let confirmOpen = $state(false);

	onMount(() => {
		const connected = page.url.searchParams.get('connected');
		const error = page.url.searchParams.get('error');
		if (connected) toast.success(`Connected @${connected}`);
		if (error && error !== 'not_configured') toast.error(error);
		if (connected || error) history.replaceState(history.state, '', '/accounts');
	});

	const welcome = $derived(page.url.searchParams.has('welcome'));
</script>

<svelte:head><title>Accounts · SchedX</title></svelte:head>

<PageHeader
	title="Accounts"
	description="The X accounts SchedX can post as. Each one signs in through X; your password never reaches SchedX."
>
	{#snippet actions()}
		{#if data.configured}
			<Button href="/auth/x/connect" variant="primary" data-sveltekit-reload
				><Plus />Connect account</Button
			>
		{/if}
	{/snippet}
</PageHeader>

{#if !data.configured}
	<section class="mb-8 grid gap-3 rounded-panel border border-line bg-surface p-5">
		<h2 class="font-semibold">Connect SchedX to your X developer app</h2>
		<ol class="grid list-decimal gap-2 pl-5 text-sm text-ink-2">
			<li>
				Open <a
					class="text-accent hover:underline"
					href="https://console.x.com"
					target="_blank"
					rel="noopener">the X Developer Console</a
				> and create an app (or open your existing one).
			</li>
			<li>
				Under <em>User authentication settings</em>, choose <strong>Web App</strong> with
				<strong>Read and write</strong> permissions.
			</li>
			<li>
				Add this callback URL: <code
					class="rounded bg-surface-2 px-1.5 py-0.5 text-[0.8125rem] break-all"
					>{data.callback}</code
				>
			</li>
			<li>
				Copy the OAuth 2.0 <strong>Client ID</strong> and <strong>Client Secret</strong> into
				<code>X_CLIENT_ID</code>
				and <code>X_CLIENT_SECRET</code> in your <code>.env</code>, then restart SchedX.
			</li>
		</ol>
		<p class="text-sm text-muted">
			Want to try SchedX first without posting anything? Set <code>X_API_MODE=mock</code>.
		</p>
	</section>
{/if}

{#if data.accounts.length === 0}
	{#if data.configured}
		<EmptyState
			title={welcome ? "You're set up. Now connect an X account" : 'No accounts connected'}
			body={data.mock
				? 'Mock mode creates a pretend account so you can explore safely.'
				: "You'll be sent to X to approve access, then brought back here."}
		>
			<Button href="/auth/x/connect" variant="primary" data-sveltekit-reload>Connect account</Button
			>
		</EmptyState>
	{/if}
{:else}
	<ul class="grid gap-3">
		{#each data.accounts as a (a.id)}
			<li
				class="grid gap-4 rounded-panel border border-line bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-center"
			>
				<div class="flex min-w-0 items-center gap-3">
					<Avatar src={a.avatarUrl} name={a.username} size="lg" />
					<div class="min-w-0">
						<p class="flex flex-wrap items-center gap-2 font-semibold">
							<span class="truncate">{a.displayName}</span>
							{#if a.isDefault}<span
									class="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent"
									>Default</span
								>{/if}
							{#if a.status === 'needs_reauth'}<span
									class="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn"
									>Needs reconnect</span
								>{/if}
						</p>
						<p class="truncate text-sm text-muted">
							@{a.username} · {data.pending[a.id] ?? 0} pending post{data.pending[a.id] === 1
								? ''
								: 's'}
						</p>
						{#if a.status === 'needs_reauth' && a.lastError}<p class="mt-1 text-sm text-warn">
								{a.lastError}
							</p>{/if}
					</div>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<form
						method="POST"
						action="?/premium"
						use:enhance
						class="mr-2 flex items-center gap-2 text-sm text-muted"
					>
						<input type="hidden" name="id" value={a.id} />
						<input type="hidden" name="premium" value="off" />
						<label for="prem-{a.id}" title="Premium accounts can post up to 25,000 characters"
							>Long posts (Premium)</label
						>
						<Switch
							id="prem-{a.id}"
							checked={a.premium}
							onchange={async (on) => {
								const form = document.getElementById(`prem-${a.id}`)?.closest('form');
								const field = form?.querySelector<HTMLInputElement>('input[name=premium]');
								if (!form || !field) return;
								field.value = on ? 'on' : 'off';
								form.requestSubmit();
								toast.success(
									on ? `Long posts on for @${a.username}` : `Long posts off for @${a.username}`
								);
							}}
						/>
					</form>
					{#if a.status === 'needs_reauth'}
						<Button href="/auth/x/connect" size="sm" variant="primary" data-sveltekit-reload
							>Reconnect</Button
						>
					{/if}
					{#if !a.isDefault}
						<form method="POST" action="?/default" use:enhance>
							<input type="hidden" name="id" value={a.id} />
							<Button type="submit" size="sm" variant="ghost">Make default</Button>
						</form>
					{/if}
					<Button
						size="sm"
						variant="danger-ghost"
						onclick={() => {
							confirmFor = a;
							confirmOpen = true;
						}}>Disconnect</Button
					>
				</div>
			</li>
		{/each}
	</ul>
	<p class="mt-4 text-sm text-muted">
		To connect a different X account, sign out of X in this browser first (or use a private window),
		then choose Connect account.
	</p>
{/if}

<Dialog
	bind:open={confirmOpen}
	title="Disconnect @{confirmFor?.username}?"
	description="SchedX revokes its access on X and deletes this account's {data.pending[
		confirmFor?.id ?? ''
	] ?? 0} pending post(s), drafts included. Published posts stay on X."
>
	{#snippet footer()}
		<Button onclick={() => (confirmOpen = false)}>Cancel</Button>
		<form
			method="POST"
			action="?/disconnect"
			use:enhance={() =>
				async ({ update }) => {
					confirmOpen = false;
					toast.success(`Disconnected @${confirmFor?.username}`);
					await update();
				}}
		>
			<input type="hidden" name="id" value={confirmFor?.id} />
			<Button type="submit" variant="danger">Disconnect</Button>
		</form>
	{/snippet}
</Dialog>
