<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import ThemeToggle from './ThemeToggle.svelte';

	// Get current path for active state
	$: currentPath = $page.url.pathname;

	// Handle logo click - refresh page for PWA users
	function handleLogoClick(event: MouseEvent) {
		// If already on home page, refresh the data
		if (currentPath === '/') {
			event.preventDefault();
			invalidateAll();
		}
	}
</script>

<!-- ========== HEADER ========== -->
<header
	class="theme-lightsout:bg-black sticky inset-x-0 top-0 z-50 w-full bg-gray-50 dark:bg-gray-900 lg:top-6 lg:before:absolute lg:before:inset-0 lg:before:mx-2 lg:before:max-w-5xl lg:before:rounded-[26px] lg:before:bg-white/80 lg:before:backdrop-blur-md lg:dark:before:bg-gray-800/30 lg:theme-lightsout:before:bg-black"
>
	<nav
		class="relative mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 lg:mx-2 lg:px-4"
	>
		<div class="flex items-center gap-2.5">
			<!-- Logo -->
			<a
				class="focus:outline-hidden inline-flex flex-none items-center rounded-md focus:opacity-80"
				href="/"
				aria-label="SchedX - Click to refresh"
				on:click={handleLogoClick}
			>
				<span class="schedx-logo text-2xl text-[#1DA1F2] dark:text-gray-300 theme-lightsout:text-white">
					SCHEDX
				</span>
			</a>
			<!-- End Logo -->
		</div>

		<!-- Button Group -->
		<div class="flex items-center gap-2.5">
			<!-- Theme Toggle -->
			<div>
				<ThemeToggle />
			</div>

			<!-- Admin Settings Link -->
			<a
				href="/admin/settings"
				class="inline-flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:hover:bg-gray-700 theme-lightsout:hover:bg-gray-800"
				aria-label="Admin Settings"
				title="Admin Settings"
			>
				<svg
					class="h-5 w-5 text-gray-500 dark:text-gray-400 theme-lightsout:text-white"
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
					<circle cx="12" cy="12" r="3"/>
				</svg>
			</a>
		</div>
	</nav>
</header>
<!-- ========== END HEADER ========== -->
