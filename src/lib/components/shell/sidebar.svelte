<script lang="ts">
	import { page } from '$app/state';
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
	import Settings from '@lucide/svelte/icons/settings';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Logo from './logo.svelte';
	import ThemeToggle from './theme-toggle.svelte';
	import SpendMeter, { type Spend } from './spend-meter.svelte';
	import { SIDEBAR_NAV, isActive } from './nav.js';
	import { cn } from '#lib/utils.js';

	let {
		collapsed = $bindable(false),
		attention,
		spend
	}: { collapsed?: boolean; attention: number; spend: Spend } = $props();

	function toggle() {
		collapsed = !collapsed;
		document.cookie = `sidebar=${collapsed ? 'collapsed' : 'expanded'}; path=/; max-age=31536000; samesite=lax`;
	}

	const footerButton =
		'inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink';
</script>

<!-- Floating desktop sidebar (legacy): inset 16px from the window edges. -->
<aside
	class={cn(
		'fixed top-4 bottom-4 left-4 z-40 hidden transition-[width] duration-300 ease-in-out lg:block',
		collapsed ? 'w-16' : 'w-48'
	)}
>
	<div
		class="flex h-full flex-col overflow-hidden rounded-2xl border border-line/60 bg-chrome shadow-xl"
	>
		<div
			class={cn(
				'flex items-center justify-center border-b border-line/60 pt-4 pb-3 transition-[padding] duration-300',
				collapsed ? 'px-2' : 'px-6'
			)}
		>
			<a href="/" class="rounded-xl p-2" aria-label="SchedX home">
				<Logo size={collapsed ? 40 : 48} />
			</a>
		</div>

		<nav aria-label="Main" class="flex-1 overflow-x-hidden overflow-y-auto p-2">
			<ul class="space-y-1.5">
				{#each SIDEBAR_NAV as item (item.href)}
					{@const active = isActive(page.url.pathname, item.href)}
					<li>
						<a
							href={item.href}
							aria-current={active ? 'page' : undefined}
							title={collapsed ? item.label : undefined}
							class={cn(
								'relative flex items-center rounded-xl py-2.5 text-sm transition-colors duration-200',
								collapsed ? 'justify-center px-3' : 'gap-x-3.5 px-3',
								active
									? 'bg-nav-active font-semibold text-nav-active-ink shadow-sm'
									: 'text-ink-2 hover:bg-surface-2 hover:text-ink'
							)}
						>
							<item.icon class="size-4 shrink-0" />
							{#if !collapsed}<span class="truncate font-medium">{item.label}</span>{/if}
							{#if item.href === '/' && attention > 0}
								{#if collapsed}
									<span class="absolute top-1.5 right-2 size-2 rounded-full bg-amber-500"></span>
								{:else}
									<span
										class="ml-auto rounded-full bg-warn-soft px-1.5 text-xs font-semibold text-warn tnum"
										title="{attention} post(s) need attention">{attention}</span
									>
								{/if}
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<!-- API spend sits between the page links and the footer buttons. -->
		<div class="border-t border-line/60 p-2">
			<SpendMeter {spend} {collapsed} />
		</div>

		<div class="border-t border-line/60 px-2 py-2">
			<div class={cn('flex items-center justify-center gap-1.5', collapsed && 'flex-col gap-2')}>
				<button
					type="button"
					onclick={toggle}
					class={footerButton}
					aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					{#if collapsed}<PanelLeft class="size-4" />{:else}<PanelLeftClose class="size-4" />{/if}
				</button>
				<ThemeToggle />
				<a
					href="/settings"
					class={cn(
						footerButton,
						isActive(page.url.pathname, '/settings') && 'bg-nav-active text-nav-active-ink'
					)}
					aria-label="Settings"
					title="Settings"
				>
					<Settings class="size-4" />
				</a>
				<form method="POST" action="/logout" class="contents">
					<button class={footerButton} aria-label="Sign out" title="Sign out">
						<LogOut class="size-4" />
					</button>
				</form>
			</div>
		</div>
	</div>
</aside>
