<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Field from '#lib/components/ui/field.svelte';
	import Input from '#lib/components/ui/input.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import { formatDateTime } from '#lib/shared/time.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	function device(ua: string | null): string {
		if (!ua) return 'Unknown device';
		const browser = /Edg\//.test(ua)
			? 'Edge'
			: /Firefox\//.test(ua)
				? 'Firefox'
				: /Chrome\//.test(ua)
					? 'Chrome'
					: /Safari\//.test(ua)
						? 'Safari'
						: 'Browser';
		const os = /iPhone|iPad/.test(ua)
			? 'iOS'
			: /Android/.test(ua)
				? 'Android'
				: /Windows/.test(ua)
					? 'Windows'
					: /Mac OS/.test(ua)
						? 'macOS'
						: /Linux/.test(ua)
							? 'Linux'
							: '';
		return os ? `${browser} on ${os}` : browser;
	}
</script>

<svelte:head><title>Security · SchedX</title></svelte:head>

<div class="grid gap-10">
	<form
		method="POST"
		action="?/password"
		class="grid gap-4"
		use:enhance={() =>
			async ({ result, update }) => {
				if (result.type === 'success')
					toast.success('Password changed. Other devices were signed out.');
				await update();
			}}
	>
		<h2 class="text-lg font-semibold">Change password</h2>
		<Field label="Current password" for="current">
			<Input id="current" name="current" type="password" autocomplete="current-password" required />
		</Field>
		<Field label="New password" for="next" hint="At least 10 characters.">
			<Input
				id="next"
				name="next"
				type="password"
				autocomplete="new-password"
				required
				minlength={10}
			/>
		</Field>
		<Field label="Confirm new password" for="confirm" error={form?.passwordError}>
			<Input id="confirm" name="confirm" type="password" autocomplete="new-password" required />
		</Field>
		<div><Button type="submit" variant="primary">Change password</Button></div>
	</form>

	<section class="grid gap-3">
		<h2 class="text-lg font-semibold">Signed-in devices</h2>
		<ul class="grid divide-y divide-line rounded-panel border border-line bg-surface">
			{#each data.sessions as s, i (i)}
				<li class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
					<span
						>{device(s.userAgent)}{#if s.current}
							<span class="text-muted">(this device)</span>{/if}</span
					>
					<span class="text-muted">since {formatDateTime(s.createdAt, data.tz)}</span>
				</li>
			{/each}
		</ul>
		{#if data.sessions.length > 1}
			<form
				method="POST"
				action="?/signOutOthers"
				use:enhance={() =>
					async ({ update }) => {
						toast.success('Signed out other devices');
						await update();
					}}
			>
				<Button type="submit" variant="danger-ghost">Sign out other devices</Button>
			</form>
		{/if}
	</section>
</div>
