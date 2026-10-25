<script lang="ts">
	import AtSign from '@lucide/svelte/icons/at-sign';
	import Settings from '@lucide/svelte/icons/settings';
	import Logo from './logo.svelte';
	import ThemeToggle from './theme-toggle.svelte';
	import Avatar from '../avatar.svelte';
	import type { AccountView } from '#lib/shared/compose.js';

	let { account }: { account: AccountView | null } = $props();

	const iconLink =
		'inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink';
</script>

<!-- In the installed iOS app the page draws under the status bar; pad past the notch/Dynamic
     Island so the bar's controls stay visible and tappable. The inset is 0 everywhere else. -->
<header
	class="sticky inset-x-0 top-0 z-30 w-full bg-chrome/85 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden"
>
	<nav class="flex items-center justify-between px-4 py-2" aria-label="Top">
		<a href="/" class="rounded-xl" aria-label="SchedX home"><Logo size={40} /></a>
		<div class="flex items-center gap-1">
			<ThemeToggle size="md" />
			<a href="/accounts" class={iconLink} aria-label="Accounts" title="Accounts">
				{#if account}
					<Avatar src={account.avatarUrl} name={account.username} size="sm" class="size-7" />
				{:else}
					<AtSign class="size-5" />
				{/if}
			</a>
			<a href="/settings" class={iconLink} aria-label="Settings" title="Settings">
				<Settings class="size-5" />
			</a>
		</div>
	</nav>
</header>
