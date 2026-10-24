<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { refreshAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import House from '@lucide/svelte/icons/house';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import FileText from '@lucide/svelte/icons/file-text';
	import History from '@lucide/svelte/icons/history';
	import Images from '@lucide/svelte/icons/images';
	import AtSign from '@lucide/svelte/icons/at-sign';
	import Settings from '@lucide/svelte/icons/settings';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import LogOut from '@lucide/svelte/icons/log-out';
	import ThemeMenu from './theme-menu.svelte';
	import Button from './ui/button.svelte';
	import { api, cn } from '#lib/utils.js';
	import type { Theme } from '#lib/shared/types.js';

	let {
		theme = $bindable(),
		attention,
		mockMode,
		paused,
		children
	}: {
		theme: Theme;
		attention: number;
		mockMode: boolean;
		paused: { reason: string; message?: string } | null;
		children: Snippet;
	} = $props();

	const nav = [
		{ href: '/', label: 'Home', icon: House },
		{ href: '/compose', label: 'Compose', icon: PenLine },
		{ href: '/calendar', label: 'Calendar', icon: CalendarDays },
		{ href: '/queue', label: 'Queue', icon: ListOrdered },
		{ href: '/drafts', label: 'Drafts', icon: FileText },
		{ href: '/history', label: 'History', icon: History },
		{ href: '/library', label: 'Media', icon: Images },
		{ href: '/accounts', label: 'Accounts', icon: AtSign },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];
	const mobile = [nav[0], nav[2], nav[1], nav[3]];

	const active = (href: string) =>
		href === '/'
			? page.url.pathname === '/'
			: page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);

	let moreOpen = $state(false);

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

<div class="min-h-dvh md:grid md:grid-cols-[13.5rem_1fr]">
	<!-- Desktop rail -->
	<aside class="sticky top-0 hidden h-dvh flex-col border-r border-line px-3 py-5 md:flex">
		<a href="/" class="mb-6 flex items-center gap-2.5 px-2.5">
			<img src="/icons/icon-192.png" alt="" class="size-7 rounded-lg" />
			<span class="text-lg font-semibold tracking-tight">SchedX</span>
		</a>
		<nav aria-label="Main" class="grid gap-0.5">
			{#each nav as item (item.href)}
				<a
					href={item.href}
					aria-current={active(item.href) ? 'page' : undefined}
					class={cn(
						'flex items-center gap-3 rounded-ctl px-2.5 py-2 text-[0.9375rem] text-ink-2 hover:bg-surface hover:text-ink',
						active(item.href) &&
							'bg-surface font-semibold text-ink shadow-[inset_2px_0_0_var(--accent)]'
					)}
				>
					<item.icon class="size-[1.125rem]" />
					{item.label}
					{#if item.href === '/' && attention > 0}
						<span
							class="ml-auto rounded-full bg-warn-soft px-1.5 text-xs font-semibold text-warn tnum"
							>{attention}</span
						>
					{/if}
				</a>
			{/each}
		</nav>
		<div class="mt-auto flex items-center gap-1 px-1">
			<ThemeMenu bind:theme />
			<form method="POST" action="/logout">
				<button
					class="inline-flex size-9 items-center justify-center rounded-ctl text-muted hover:bg-surface-2 hover:text-ink"
					aria-label="Sign out"
					title="Sign out"
				>
					<LogOut class="size-[1.125rem]" />
				</button>
			</form>
		</div>
	</aside>

	<div class="min-w-0 pb-24 md:pb-10">
		{#if mockMode}
			<div class="border-b border-line bg-warn-soft px-4 py-2 text-center text-sm text-warn">
				Mock mode: nothing is sent to X and nothing is billed. Set <code>X_API_MODE=live</code> to post
				for real.
			</div>
		{/if}
		{#if paused}
			<div
				class="flex flex-wrap items-center justify-center gap-3 border-b border-line bg-bad-soft px-4 py-2 text-sm text-bad"
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

		<!-- Mobile top bar -->
		<header
			class="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur md:hidden"
		>
			<a href="/" class="flex items-center gap-2">
				<img src="/icons/icon-192.png" alt="" class="size-7 rounded-lg" />
				<span class="font-semibold">SchedX</span>
			</a>
			<span class="ml-auto"><ThemeMenu bind:theme /></span>
		</header>

		<main id="main" class="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
			{@render children()}
		</main>
	</div>
</div>

<!-- Mobile tab bar -->
<nav
	aria-label="Main"
	class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
>
	{#each mobile as item (item.href)}
		<a
			href={item.href}
			aria-current={active(item.href) ? 'page' : undefined}
			class={cn(
				'relative flex flex-col items-center gap-0.5 py-2 text-[0.6875rem] text-muted',
				active(item.href) && 'text-ink',
				item.href === '/compose' && 'text-accent'
			)}
		>
			{#if item.href === '/compose'}
				<span
					class="-mt-1 flex size-10 items-center justify-center rounded-full bg-accent text-accent-ink"
				>
					<item.icon class="size-5" />
				</span>
			{:else}
				<item.icon class="size-5" />
				{item.label}
			{/if}
			{#if item.href === '/' && attention > 0}
				<span class="absolute top-1.5 left-1/2 ml-2 size-2 rounded-full bg-warn"></span>
			{/if}
		</a>
	{/each}
	<button
		class={cn(
			'flex flex-col items-center gap-0.5 py-2 text-[0.6875rem] text-muted',
			moreOpen && 'text-ink'
		)}
		onclick={() => (moreOpen = !moreOpen)}
		aria-expanded={moreOpen}
	>
		<Ellipsis class="size-5" />More
	</button>
</nav>

{#if moreOpen}
	<button
		class="fixed inset-0 z-30 bg-black/30 md:hidden"
		aria-label="Close menu"
		onclick={() => (moreOpen = false)}
	></button>
	<div
		class="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 grid gap-0.5 rounded-panel border border-line bg-raised p-2 shadow-pop md:hidden"
	>
		{#each nav.filter((n) => !mobile.includes(n)) as item (item.href)}
			<a
				href={item.href}
				onclick={() => (moreOpen = false)}
				class="flex items-center gap-3 rounded-ctl px-3 py-2.5 hover:bg-surface-2"
			>
				<item.icon class="size-[1.125rem] text-muted" />{item.label}
			</a>
		{/each}
		<form method="POST" action="/logout">
			<button class="flex w-full items-center gap-3 rounded-ctl px-3 py-2.5 hover:bg-surface-2">
				<LogOut class="size-[1.125rem] text-muted" />Sign out
			</button>
		</form>
	</div>
{/if}
