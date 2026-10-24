<script lang="ts">
	import AppShell from '#lib/components/app-shell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<AppShell
	theme={data.theme}
	sidebarCollapsed={data.sidebarCollapsed}
	attention={data.attention}
	mockMode={data.mockMode}
	paused={data.paused}
	accounts={data.accounts}
>
	{@render children()}
</AppShell>
