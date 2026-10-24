<script lang="ts">
	import { page } from '$app/state';
	import LogOut from '@lucide/svelte/icons/log-out';
	import PageHeader from '#lib/components/page-header.svelte';
	import { cn } from '#lib/utils.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	const tabs = [
		{ href: '/settings', label: 'General' },
		{ href: '/settings/budget', label: 'Budget' },
		{ href: '/settings/notifications', label: 'Notifications' },
		{ href: '/settings/security', label: 'Security' },
		{ href: '/settings/system', label: 'System' }
	];
</script>

<PageHeader title="Settings" />

<div class="grid gap-8 md:grid-cols-[11rem_minmax(0,1fr)]">
	<nav aria-label="Settings" class="-mx-1 flex gap-1 overflow-x-auto md:mx-0 md:flex-col">
		{#each tabs as t (t.href)}
			<a
				href={t.href}
				aria-current={page.url.pathname === t.href ? 'page' : undefined}
				class={cn(
					'shrink-0 rounded-xl px-3 py-2.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink',
					page.url.pathname === t.href &&
						'bg-nav-active font-semibold text-nav-active-ink shadow-sm'
				)}>{t.label}</a
			>
		{/each}
		<form
			method="POST"
			action="/logout"
			class="shrink-0 md:mt-4 md:border-t md:border-line md:pt-4"
		>
			<button
				class="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
			>
				<LogOut class="size-4" />Sign out
			</button>
		</form>
	</nav>
	<div class="max-w-2xl min-w-0">{@render children()}</div>
</div>
