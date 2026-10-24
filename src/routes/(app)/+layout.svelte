<script lang="ts">
	import AppShell from '#lib/components/app-shell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	let theme = $derived(data.theme);
</script>

<AppShell bind:theme attention={data.attention} mockMode={data.mockMode} paused={data.paused}>
	{@render children()}
</AppShell>
