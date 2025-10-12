<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import AppIcon from './AppIcon.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { showAdminMenu } from '$lib/stores/stores';
	import { Settings, LogOut } from 'lucide-svelte';
	import logger from '$lib/logger';

	// Get current path for active state
	$: currentPath = $page.url.pathname;

	let dropdownRef: HTMLDivElement;
	let dropdownButton: HTMLButtonElement;
	let isDropdownOpen = false;

	// Handle keyboard navigation
	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && isDropdownOpen) {
			closeDropdown();
		}
	};

	const handleDropdownKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleDropdown();
		} else if (event.key === 'ArrowDown' && isDropdownOpen) {
			event.preventDefault();
			focusFirstMenuItem();
		}
	};

	const handleMenuItemKeyDown = (event: KeyboardEvent, isLast: boolean = false) => {
		if (event.key === 'ArrowDown' && !isLast) {
			event.preventDefault();
			const nextItem = (event.target as HTMLElement).nextElementSibling as HTMLElement;
			nextItem?.focus();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			const prevItem = (event.target as HTMLElement).previousElementSibling as HTMLElement;
			if (prevItem) {
				prevItem.focus();
			} else {
				dropdownButton.focus();
			}
		} else if (event.key === 'Escape') {
			closeDropdown();
		}
	};

	const toggleDropdown = () => {
		isDropdownOpen = !isDropdownOpen;
		showAdminMenu.set(isDropdownOpen);

		if (isDropdownOpen) {
			// Focus first menu item after dropdown opens
			setTimeout(focusFirstMenuItem, 100);
		}

		logger.debug('Admin dropdown toggled', { isOpen: isDropdownOpen });
	};

	const closeDropdown = () => {
		isDropdownOpen = false;
		showAdminMenu.set(false);
		dropdownButton.focus();
	};

	const focusFirstMenuItem = () => {
		const firstMenuItem = dropdownRef?.querySelector('a') as HTMLElement;
		firstMenuItem?.focus();
	};

	// Handle logout
	const handleLogout = async (event: MouseEvent) => {
		event.preventDefault();
		closeDropdown();
		
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

	// Close dropdown when clicking outside
	const handleClickOutside = (event: MouseEvent) => {
		if (
			dropdownRef &&
			!dropdownRef.contains(event.target as Node) &&
			!dropdownButton.contains(event.target as Node)
		) {
			closeDropdown();
		}
	};

	onMount(() => {
		document.addEventListener('keydown', handleKeyDown);
		document.addEventListener('click', handleClickOutside);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('click', handleClickOutside);
		};
	});

	// Subscribe to store changes
	$: if ($showAdminMenu !== isDropdownOpen) {
		isDropdownOpen = $showAdminMenu;
	}
</script>

<!-- ========== HEADER ========== -->
<header
	class="theme-lightsout:before:bg-black sticky inset-x-0 top-6 z-50 flex w-full flex-wrap before:absolute before:inset-0 before:mx-2 before:max-w-5xl before:rounded-[26px] before:bg-white/80 before:backdrop-blur-md dark:before:bg-gray-800/30 md:flex-nowrap md:justify-start lg:before:mx-auto"
>
	<nav
		class="relative mx-2 flex w-full max-w-5xl basis-full flex-wrap items-center justify-between py-3 px-4 md:flex-nowrap lg:mx-auto"
	>
		<div class="flex items-center">
			<!-- Logo -->
			<a
				class="focus:outline-hidden inline-block flex-none rounded-md text-xl font-semibold focus:opacity-80"
				href="/"
				aria-label="SchedX"
			>
				<div class="flex items-center gap-2">
					<AppIcon className="w-8 h-8 text-gray-900 dark:text-white theme-lightsout:text-white" />
					<span class="theme-lightsout:text-white text-xl font-bold text-gray-900 dark:text-white">SchedX</span>
				</div>
			</a>
			<!-- End Logo -->
		</div>

		<!-- Button Group -->
		<div class="flex items-center gap-3">
			<!-- Theme Toggle -->
			<div>
				<ThemeToggle />
			</div>

			<!-- Admin Dropdown -->
			<div class="relative inline-flex">
				<button
					bind:this={dropdownButton}
					id="admin-dropdown-button"
					type="button"
					class="theme-lightsout:border-gray-800 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 p-0 transition-all hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-700"
					aria-haspopup="menu"
					aria-expanded={isDropdownOpen}
					aria-label="Account menu"
					on:click={toggleDropdown}
					on:keydown={handleDropdownKeyDown}
				>
					<img
						class="h-full w-full rounded-full object-cover"
						src="/avatar.png"
						alt="Admin avatar"
						loading="lazy"
					/>
				</button>

				{#if isDropdownOpen}
					<div
						bind:this={dropdownRef}
						class="theme-lightsout:border-gray-800 theme-lightsout:bg-black absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg transition-all duration-200 dark:border-gray-700 dark:bg-gray-800"
						role="menu"
						aria-orientation="vertical"
						aria-labelledby="admin-dropdown-button"
					>
						<!-- User Info Header -->
						<div
							class="theme-lightsout:border-gray-800 theme-lightsout:bg-gray-900 rounded-t-lg border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-700/50"
						>
							<p class="theme-lightsout:text-gray-400 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
								Signed in as
							</p>
							<p class="theme-lightsout:text-white truncate text-sm font-medium text-gray-900 dark:text-white">
								Administrator
							</p>
						</div>

						<!-- Menu Items -->
						<div class="py-1">
							<a
								href="/admin/settings"
								class="theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-900 flex items-center px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
								role="menuitem"
								tabindex="0"
								on:keydown={(e) => handleMenuItemKeyDown(e, false)}
								on:click={closeDropdown}
							>
								<Settings class="mr-3 size-4 text-gray-400" aria-hidden="true" />
								Admin Settings
							</a>

							<button
								type="button"
								class="theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-900 flex w-full items-center px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
								role="menuitem"
								tabindex="0"
								on:keydown={(e) => handleMenuItemKeyDown(e, true)}
								on:click={handleLogout}
							>
								<LogOut class="mr-3 size-4 text-gray-400" aria-hidden="true" />
								Sign Out
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</nav>
</header>
<!-- ========== END HEADER ========== -->
