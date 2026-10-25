<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';
	import { invalidate, refreshAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Sidebar from './shell/sidebar.svelte';
	import type { Spend } from './shell/spend-meter.svelte';
	import MobileHeader from './shell/mobile-header.svelte';
	import MobileNavbar from './shell/mobile-navbar.svelte';
	import { provideTheme } from './shell/theme.svelte.js';
	import { providePendingDeletes } from './shell/pending-deletes.svelte.js';
	import Button from './ui/button.svelte';
	import { api, cn } from '#lib/utils.js';
	import type { Theme } from '#lib/shared/types.js';
	import type { AccountView } from '#lib/shared/compose.js';

	let {
		theme,
		sidebarCollapsed,
		attention,
		mockMode,
		paused,
		accounts,
		spend,
		children
	}: {
		theme: Theme;
		sidebarCollapsed: boolean;
		attention: number;
		mockMode: boolean;
		paused: { reason: string; message?: string } | null;
		accounts: AccountView[];
		spend: Spend;
		children: Snippet;
	} = $props();

	// Seeded once from the server-rendered cookie values; the controls own them afterwards.
	const themeController = provideTheme(untrack(() => theme));
	let collapsed = $state(untrack(() => sidebarCollapsed));
	const defaultAccount = $derived(accounts.find((a) => a.isDefault) ?? accounts[0] ?? null);

	onMount(() => themeController.listen());

	const pendingDeletes = providePendingDeletes();
	onMount(() => pendingDeletes.listen());

	// Keep the spend meter, attention badge and post statuses current while the app is open:
	// re-check every minute when the tab is visible, and right away when you come back to it.
	onMount(() => {
		const refresh = () => {
			if (document.visibilityState === 'visible') void invalidate('app:status');
		};
		const timer = setInterval(refresh, 60_000);
		document.addEventListener('visibilitychange', refresh);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', refresh);
		};
	});

	async function resume() {
		try {
			const { resumed } = await api<{ resumed: number }>('/api/scheduler/resume');
			toast.success(
				resumed ? `Resumed ${resumed} post${resumed > 1 ? 's' : ''}` : 'Publishing resumed'
			);
			await refreshAll();
		} catch (err) {
			toast.error((err as Error).message);
		}
	}
</script>

<a
	href="#main"
	class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-raised focus:px-3 focus:py-2"
>
	Skip to content
</a>

<Sidebar bind:collapsed {attention} {spend} />

<div
	class={cn(
		'min-h-dvh min-w-0 transition-[padding] duration-300 ease-in-out',
		collapsed ? 'lg:pl-24' : 'lg:pl-56'
	)}
>
	<MobileHeader account={defaultAccount} />

	<div class="lg:pt-4 lg:pr-4">
		{#if mockMode}
			<div
				class="border-b border-warn/30 bg-warn-soft px-4 py-2 text-center text-sm text-warn lg:rounded-xl lg:border"
			>
				Mock mode: nothing is sent to X and nothing is billed. Set <code>X_API_MODE=live</code> to post
				for real.
			</div>
		{/if}
		{#if paused}
			<div
				class="flex flex-wrap items-center justify-center gap-3 border-b border-bad/30 bg-bad-soft px-4 py-2 text-sm text-bad lg:mt-2 lg:rounded-xl lg:border"
			>
				<span>
					Publishing is paused{paused.reason === 'credits'
						? ' because X reported a billing problem'
						: ''}.
					{paused.reason === 'credits'
						? 'Top up credits in the X Developer Console, then resume.'
						: ''}
				</span>
				<Button size="sm" variant="secondary" onclick={resume}>Resume publishing</Button>
			</div>
		{/if}
	</div>

	<main id="main" class="mx-auto w-full max-w-6xl px-4 pt-6 pb-36 sm:px-6 lg:px-8 lg:pt-6 lg:pb-12">
		{@render children()}
	</main>
</div>

<MobileNavbar {attention} />

<!-- Legacy theme-change wash -->
<div
	aria-hidden="true"
	class={cn(
		'theme-overlay pointer-events-none fixed inset-0 z-[9999] transition-opacity duration-300',
		themeController.changing ? 'opacity-100' : 'opacity-0'
	)}
></div>
