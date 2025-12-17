<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import Header from '$lib/components/Header.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MobileNavbar from '$lib/components/MobileNavbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import { Toaster } from 'svelte-sonner';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { queryClient } from '$lib/query/queryClient';
	import logger from '$lib/logger';
	import { syncTimezone } from '$lib/utils/timezone';

	let theme: string = 'light';

	onMount(() => {
		if (browser) {
			// Initialize Preline v3
			const initPreline = async () => {
				try {
					let attempts = 0;
					while (typeof window === 'undefined' || !window.HSStaticMethods) {
						await new Promise((resolve) => setTimeout(resolve, 100));
						attempts++;
						if (attempts > 50) {
							logger.error('Preline not loaded after 5 seconds');
							return;
						}
					}
					if (window.HSStaticMethods) {
						logger.debug('Initializing Preline v3...');
						window.HSStaticMethods.autoInit();
						setTimeout(() => {
							if (window.HSStaticMethods) {
								window.HSStaticMethods.autoInit();
							}
						}, 500);
					}
				} catch (error) {
					logger.error('Error initializing Preline');
				}
			};
			setTimeout(initPreline, 100);
			setTimeout(initPreline, 1000);
		}

		// Auto-detect and sync timezone (runs once on first load)
		const timezoneKey = 'timezone_synced';
		if (!sessionStorage.getItem(timezoneKey)) {
			syncTimezone().then(() => {
				sessionStorage.setItem(timezoneKey, 'true');
				logger.debug('Timezone synced');
			}).catch((err) => {
				logger.error('Failed to sync timezone:', err);
			});
		}

		// Theme logic
		const getCookie = (name: string) => {
			const value = `; ${document.cookie}`;
			const parts = value.split(`; ${name}=`);
			if (parts.length === 2) return parts.pop()?.split(';').shift();
			return null;
		};
		const setCookie = (name: string, value: string, days = 365) => {
			const expires = new Date(Date.now() + days * 864e5).toUTCString();
			document.cookie = `${name}=${value}; expires=${expires}; path=/`;
		};

		const savedTheme = getCookie('theme') || localStorage.getItem('theme') || 'light';
		theme = savedTheme;
		const html = document.documentElement;
		html.classList.remove('theme-dark', 'theme-lightsout');
		if (theme === 'light') {
			html.setAttribute('data-theme', 'light');
			setCookie('theme', 'light');
			localStorage.setItem('theme', 'light');
		} else if (theme === 'dark') {
			html.classList.add('theme-dark');
			html.setAttribute('data-theme', 'dark');
			setCookie('theme', 'dark');
			localStorage.setItem('theme', 'dark');
		} else if (theme === 'lightsout') {
			html.classList.add('theme-lightsout');
			html.setAttribute('data-theme', 'lightsout');
			setCookie('theme', 'lightsout');
			localStorage.setItem('theme', 'lightsout');
		}
	});
</script>

<QueryClientProvider client={queryClient}>
<div class="theme-lightsout:bg-black flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
	<!-- Check if we're on authentication pages -->
	{#if $page.url.pathname !== '/login' && !$page.url.pathname.startsWith('/auth/') && $page.url.pathname !== '/signin' && $page.url.pathname !== '/signout' && !$page.url.pathname.startsWith('/admin/login') && $page.url.pathname !== '/logout'}
		<!-- Skip to main content link for accessibility -->
		<a
			href="#main-content"
			class="sr-only z-50 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
		>
			Skip to main content
		</a>

		<!-- Pull to Refresh for PWA -->
		<PullToRefresh />

		<!-- Header with Floating Navbar - Hidden on Desktop -->
		<div class="lg:hidden">
			<Header />
		</div>

		<!-- Desktop Sidebar -->
		<Sidebar />

		<!-- Main Content -->
		<main
			id="main-content"
			class="min-w-0 flex-1 lg:pl-56 lg:pt-4"
			aria-label="Main content"
		>
			<div class="max-w-full px-4 py-6 sm:px-6 lg:px-8">
				<!-- Mobile-friendly container with proper spacing -->
				<div class="w-full max-w-none">
					<slot />
				</div>
			</div>
		</main>

		<!-- Mobile Navigation -->
		<MobileNavbar />

		<!-- Footer -->
		<Footer />

		<!-- Mobile menu overlay for better UX -->
		<div
			class="fixed inset-0 z-40 lg:hidden"
			class:hidden={true}
			role="dialog"
			aria-modal="true"
			aria-label="Mobile menu"
		>
			<!-- Backdrop -->
			<div class="fixed inset-0 bg-black bg-opacity-25"></div>
		</div>
	{:else}
		<!-- Login page - no sidebar, navbar, or footer -->
		<main
			aria-label="Authentication"
			class="flex min-h-screen items-center justify-center"
		>
			<div class="w-full max-w-md px-4">
				<slot />
			</div>
		</main>
	{/if}

	<!-- Global Toaster (svelte-sonner) -->
	<Toaster richColors position="top-right" />
</div>
</QueryClientProvider>

<!-- Global styles for mobile responsiveness -->
<style>
	:global(html) {
		/* Prevent horizontal scrolling on mobile */
		overflow-x: hidden;
	}

	:global(body) {
		/* Improve text rendering on mobile */
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		/* Prevent zoom on input focus on iOS */
		-webkit-text-size-adjust: 100%;
	}

	/* Improve touch targets on mobile */
	:global(button, a, input, select, textarea) {
		min-height: 44px;
		min-width: 44px;
	}

	/* Better focus indicators for keyboard navigation */
	:global(*:focus-visible) {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	/* Improve table responsiveness */
	:global(.table-responsive) {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	/* Better mobile typography */
	@media (max-width: 640px) {
		:global(h1) {
			font-size: 1.875rem;
			line-height: 2.25rem;
		}

		:global(h2) {
			font-size: 1.5rem;
			line-height: 2rem;
		}

		:global(h3) {
			font-size: 1.25rem;
			line-height: 1.75rem;
		}
	}

	/* Improve mobile form elements */
	:global(input, select, textarea) {
		font-size: 16px; /* Prevent zoom on iOS */
	}

	/* Better mobile spacing */
	@media (max-width: 640px) {
		:global(.mobile-spacing) {
			padding-left: 1rem;
			padding-right: 1rem;
		}
	}

	/* Improve mobile card layouts */
	:global(.mobile-card) {
		@media (max-width: 640px) {
			margin-left: -1rem;
			margin-right: -1rem;
			border-radius: 0;
		}
	}

	/* Better mobile navigation */
	:global(.mobile-nav-item) {
		@media (max-width: 640px) {
			padding: 0.75rem 1rem;
			font-size: 1rem;
		}
	}

	/* Improve mobile modals */
	:global(.mobile-modal) {
		@media (max-width: 640px) {
			margin: 0;
			height: 100vh;
			max-height: 100vh;
			border-radius: 0;
		}
	}

	/* Better mobile tables */
	:global(.mobile-table) {
		@media (max-width: 640px) {
			font-size: 0.875rem;
		}

		@media (max-width: 640px) {
			:global(.mobile-table th),
			:global(.mobile-table td) {
				padding: 0.5rem 0.25rem;
			}
		}
	}

	/* Improve mobile button groups */
	:global(.mobile-button-group) {
		@media (max-width: 640px) {
			flex-direction: column;
			gap: 0.5rem;
		}

		@media (max-width: 640px) {
			:global(.mobile-button-group button) {
				width: 100%;
			}
		}
	}
</style>
