<script lang="ts">
	import { page } from '$app/state';
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
					'shrink-0 rounded-ctl px-3 py-2 text-sm text-ink-2 hover:bg-surface hover:text-ink',
					page.url.pathname === t.href && 'bg-surface font-semibold text-ink'
				)}>{t.label}</a
			>
		{/each}
	</nav>
	<div class="max-w-2xl min-w-0">{@render children()}</div>
</div>
