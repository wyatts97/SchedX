<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthCard from '../auth-card.svelte';
	import Field from '#lib/components/ui/field.svelte';
	import Input from '#lib/components/ui/input.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let busy = $state(false);
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
</script>

<svelte:head><title>Set up SchedX</title></svelte:head>

<AuthCard
	title="Set up SchedX"
	intro="Create the account you'll use to sign in. This is local to your server, not your X login."
>
	<form
		method="POST"
		class="grid gap-4"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update({ reset: false });
				busy = false;
			};
		}}
	>
		<input type="hidden" name="timezone" value={tz} />
		<Field label="Username" for="username" error={form?.errors?.username}>
			<Input
				id="username"
				name="username"
				autocomplete="username"
				required
				value={form?.username ?? ''}
			/>
		</Field>
		<Field
			label="Password"
			for="password"
			hint="At least 10 characters."
			error={form?.errors?.password}
		>
			<Input
				id="password"
				name="password"
				type="password"
				autocomplete="new-password"
				required
				minlength={10}
			/>
		</Field>
		<Field label="Confirm password" for="confirm" error={form?.errors?.confirm}>
			<Input id="confirm" name="confirm" type="password" autocomplete="new-password" required />
		</Field>
		<p class="text-sm text-muted">
			Times will be shown in <strong class="text-ink-2">{tz}</strong>. You can change this in
			Settings.
		</p>
		<Button type="submit" variant="primary" size="lg" disabled={busy}
			>{busy ? 'Creating…' : 'Create account'}</Button
		>
	</form>
</AuthCard>
