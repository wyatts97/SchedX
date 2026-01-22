<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import ThemeToggle from './ThemeToggle.svelte';
	import { Settings } from 'lucide-svelte';

	// Get current path for active state
	$: currentPath = $page.url.pathname;

	// Track current theme for logo switching
	let currentTheme = 'light';

	// Map theme to icon path
	const themeIcons: Record<string, string> = {
		light: '/app-icon-light.png',
		dark: '/app-icon-dark.png',
		lightsout: '/app-icon-lightsout.png'
	};

	$: logoSrc = themeIcons[currentTheme] || themeIcons.light;

	onMount(() => {
		if (browser) {
			// Get initial theme
			const savedTheme = localStorage.getItem('theme') || 'light';
			currentTheme = savedTheme;

			// Listen for theme changes
			const handleThemeChange = (e: CustomEvent<{ theme: string }>) => {
				currentTheme = e.detail.theme;
			};

			window.addEventListener('theme-change', handleThemeChange as EventListener);

			return () => {
				window.removeEventListener('theme-change', handleThemeChange as EventListener);
			};
		}
	});

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
	class="sticky inset-x-0 top-0 z-50 w-full bg-white/80 backdrop-blur-md dark:bg-[#15202B]/90 theme-lightsout:bg-black/90"
>
	<nav
		class="relative mx-auto flex w-full items-center justify-between px-4 py-2"
	>
		<!-- Logo -->
		<a
			class="focus:outline-hidden inline-flex flex-none items-center rounded-xl focus:opacity-80"
			href="/"
			aria-label="SchedX - Click to refresh"
			on:click={handleLogoClick}
		>
			<img 
				src={logoSrc}
				alt="SchedX Logo"
				class="logo-inhale h-10 w-10 rounded-xl object-contain"
			/>
		</a>

		<!-- Button Group -->
		<div class="flex items-center gap-2">
			<!-- Theme Toggle -->
			<ThemeToggle />

			<!-- Admin Settings Link -->
			<a
				href="/admin/settings"
				class="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 focus:outline-none dark:hover:bg-gray-700 theme-lightsout:hover:bg-gray-800"
				aria-label="Admin Settings"
				title="Admin Settings"
			>
				<Settings class="h-5 w-5 text-gray-500 dark:text-gray-400 theme-lightsout:text-white" />
			</a>
		</div>
	</nav>
</header>
<!-- ========== END HEADER ========== -->
