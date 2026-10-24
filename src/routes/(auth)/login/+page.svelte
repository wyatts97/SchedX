<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthCard from '../auth-card.svelte';
	import Field from '#lib/components/ui/field.svelte';
	import Input from '#lib/components/ui/input.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Sign in · SchedX</title></svelte:head>

<AuthCard title="Sign in" intro="Your scheduled posts are waiting.">
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
		<Field label="Username" for="username">
			<Input
				id="username"
				name="username"
				autocomplete="username"
				required
				value={form?.username ?? ''}
			/>
		</Field>
		<Field label="Password" for="password" error={form?.error}>
			<Input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				aria-invalid={!!form?.error}
			/>
		</Field>
		<Button type="submit" variant="primary" size="lg" disabled={busy}
			>{busy ? 'Signing in…' : 'Sign in'}</Button
		>
	</form>
</AuthCard>
