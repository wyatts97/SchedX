<script lang="ts">
	import { page } from '$app/stores';
	import AppIcon from './AppIcon.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { navigationConfig } from '$lib/config/navigation';
	import { adminProfile } from './adminProfile';
	import { Settings } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import logger from '$lib/logger';

	// Get current path for active state
	$: currentPath = $page.url.pathname;

	let isAccountMenuOpen = false;
	let accountDropdownRef: HTMLDivElement | null = null;
	const toggleAccountMenu = () => {
		isAccountMenuOpen = !isAccountMenuOpen;
	};
	const closeAccountMenu = () => {
		isAccountMenuOpen = false;
	};

	// Handle logout
	const handleLogout = async (event: MouseEvent) => {
		event.preventDefault();
		closeAccountMenu();
		
		try {
			const response = await fetch('/logout', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				// Redirect to home page after successful logout
				window.location.href = '/';
			} else {
				logger.error('Logout failed');
			}
		} catch (error) {
			logger.error('Logout error');
		}
	};

	onMount(() => {
		const handleDocumentClick = (e: MouseEvent) => {
			const target = e.target as Node;
			if (accountDropdownRef && !accountDropdownRef.contains(target)) {
				closeAccountMenu();
			}
		};
		const handleDocumentKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') closeAccountMenu();
		};
		document.addEventListener('click', handleDocumentClick);
		document.addEventListener('keydown', handleDocumentKeydown);
		return () => {
			document.removeEventListener('click', handleDocumentClick);
			document.removeEventListener('keydown', handleDocumentKeydown);
		};
	});
</script>

<!-- Desktop Sidebar Only -->
<div class="fixed start-4 top-4 z-50 hidden w-64 lg:block">
	<!-- Floating Sidebar -->
	<div id="hs-application-sidebar" class="w-full" role="navigation" aria-label="Main navigation">
		<!-- Floating Sidebar Content -->
		<div class="relative z-40 flex flex-col">
			<!-- Floating Sidebar Panel -->
			<div
				class="sidebar h-full w-64 flex flex-col border-r border-gray-200 bg-white shadow-sidebar dark:bg-[#15202B] theme-lightsout:bg-[#111111] relative w-64 overflow-visible rounded-2xl border border-gray-200/50 bg-white/80 shadow-xl backdrop-blur-md dark:border-gray-700/50 dark:bg-gray-800/80 dark:shadow-gray-900/20"
			>
				<div class="relative flex flex-col overflow-visible">
					<!-- Header -->
					<div
						class="theme-lightsout:border-gray-800/50 flex flex-col items-center justify-center border-b border-gray-200/50 px-6 pb-3 pt-4 dark:border-gray-700/50"
					>
						<!-- Logo -->
						<a
							class="group flex flex-col items-center gap-1.5 rounded-lg px-3 py-2 transition-all duration-200 hover:bg-gray-100/50 focus:opacity-90 focus:outline-none dark:hover:bg-gray-700/50"
							href="/"
							aria-label="SchedX"
						>
							<AppIcon className="w-10 h-10 rounded-none transition-transform duration-200 group-hover:scale-105" />
							<span
								class="theme-lightsout:text-white text-sm font-semibold tracking-tight text-gray-900 dark:text-white"
								>SchedX</span
							>
						</a>
						<!-- End Logo -->
					</div>

					<!-- Content -->
					<div class="flex flex-col overflow-y-auto">
						<nav
							class="hs-accordion-group flex w-full flex-col flex-wrap p-3"
							data-hs-accordion-always-open
						>
							<ul class="space-y-1.5">
								{#each navigationConfig.main as item}
									<li>
										<a
											class="focus:outline-hidden flex items-center gap-x-3.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 {currentPath ===
											item.href
												? 'bg-blue-100 text-blue-700 font-semibold shadow-sm dark:bg-gray-700/50 dark:text-gray-200 theme-lightsout:!bg-[#2a2a2a] theme-lightsout:!text-white theme-lightsout:!shadow-none'
												: 'text-gray-700 hover:bg-gray-100/80 focus:bg-gray-100/80 dark:text-gray-300 dark:hover:bg-gray-700/80 dark:focus:bg-gray-700/80 theme-lightsout:!text-gray-100 theme-lightsout:hover:!bg-[#1a1a1a] theme-lightsout:focus:!bg-[#1a1a1a]'}"
											href={item.href}
											title={item.description}
										>
											<svg
												class="size-4 shrink-0"
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
												{@html item.icon}
											</svg>
											<span class="font-medium">{item.label}</span>
										</a>
									</li>
								{/each}
							</ul>
						</nav>
					</div>

					<!-- Footer -->
					<div
						class="theme-lightsout:border-gray-800/50 border-t border-gray-200/50 p-4 dark:border-gray-700/50"
					>
						<div class="flex items-center justify-between">
							<!-- Theme Toggle -->
							<ThemeToggle />

							<!-- Admin Dropdown -->
							<div class="relative z-50 inline-flex" bind:this={accountDropdownRef}>
								<button
									id="account-dropdown-trigger"
									type="button"
									class="focus:outline-hidden theme-lightsout:text-white inline-flex size-8 items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-gray-700 disabled:pointer-events-none disabled:opacity-50 dark:bg-gray-700 theme-lightsout:bg-surface-2"
									aria-haspopup="menu"
									aria-expanded={isAccountMenuOpen}
									aria-controls="account-dropdown-menu"
									aria-label="Account dropdown"
									tabindex="0"
									on:click={toggleAccountMenu}
									on:keydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											toggleAccountMenu();
										}
									}}
								>
									<img class="size-8 shrink-0 rounded-full" src={$adminProfile.avatar || '/avatar.png'} alt="{$adminProfile.username || 'Admin'} avatar" />
								</button>

								<div
									id="account-dropdown-menu"
									class="theme-lightsout:bg-gray-900 theme-lightsout:border-gray-800 absolute bottom-12 right-0 z-50 min-w-60 rounded-lg bg-white shadow-md transition-opacity duration-150 dark:divide-gray-700 dark:border dark:border-gray-700 dark:bg-gray-800 {isAccountMenuOpen
										? 'opacity-100'
										: 'pointer-events-none opacity-0'} dropdown-content avatar-dropdown theme-lightsout:bg-gray-900"
									role="menu"
									aria-orientation="vertical"
									aria-labelledby="account-dropdown-trigger"
								>
									<div
										class="theme-lightsout:bg-gray-800 rounded-t-lg bg-gray-100 px-5 py-3 dark:bg-gray-700 dropdown-header theme-lightsout:bg-gray-900"
									>
										<p
											class="theme-lightsout:text-gray-300 text-sm text-gray-500 dark:text-gray-400"
										>
											Signed in as
										</p>
										<p
											class="theme-lightsout:text-white text-sm font-medium text-gray-800 dark:text-white"
										>
											{$adminProfile.username || 'Administrator'}
										</p>
									</div>
									<div class="space-y-0.5 p-1.5">
										<a
											class="focus:outline-hidden theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-800 theme-lightsout:hover:text-white theme-lightsout:focus:bg-gray-800 theme-lightsout:focus:text-white flex items-center gap-x-3.5 rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 dark:focus:bg-gray-700 dark:focus:text-gray-300"
											href="/admin/settings"
										>
											<Settings class="size-4 shrink-0" />
											Admin Settings
										</a>
										<button
											type="button"
											class="focus:outline-hidden theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-800 theme-lightsout:hover:text-white theme-lightsout:focus:bg-gray-800 theme-lightsout:focus:text-white flex w-full items-center gap-x-3.5 rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 dark:focus:bg-gray-700 dark:focus:text-gray-300"
											on:click={handleLogout}
										>
											<svg
												class="size-4 shrink-0"
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
												<path d="M9,21H5a2,2 0 0,1 -2,-2V5a2,2 0 0,1 2,-2h4" />
												<polyline points="16,17 21,12 16,7" />
												<line x1="21" y1="12" x2="9" y2="12" />
											</svg>
											Sign Out
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
<!-- End Desktop Sidebar -->
