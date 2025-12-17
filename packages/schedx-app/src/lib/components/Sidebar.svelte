<script lang="ts">
	import { page } from '$app/stores';
	import ThemeToggle from './ThemeToggle.svelte';
	import { navigationConfig } from '$lib/config/navigation';

	// Get current path for active state
	$: currentPath = $page.url.pathname;
</script>

<!-- Desktop Sidebar Only -->
<div class="fixed start-4 top-4 z-50 hidden w-48 lg:block">
	<!-- Floating Sidebar -->
	<div id="hs-application-sidebar" class="w-full" role="navigation" aria-label="Main navigation">
		<!-- Floating Sidebar Content -->
		<div class="relative z-40 flex flex-col">
			<!-- Floating Sidebar Panel -->
			<div
				class="sidebar h-full w-48 flex flex-col bg-white shadow-sidebar dark:bg-[#15202B] theme-lightsout:bg-[#111111] relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 shadow-xl backdrop-blur-md dark:border-gray-700/50 dark:bg-gray-800/80 dark:shadow-gray-900/20 theme-lightsout:border-gray-800/50"
			>
				<div class="relative flex flex-col overflow-visible">
					<!-- Header -->
					<div
						class="theme-lightsout:border-gray-800/50 flex flex-col items-center justify-center border-b border-gray-200/50 px-6 pb-3 pt-4 dark:border-gray-700/50"
					>
						<!-- Logo -->
						<a
							class="group flex items-center rounded-lg px-3 py-2 focus:opacity-90 focus:outline-none"
							href="/"
							aria-label="SchedX"
						>
							<span class="schedx-logo text-2xl text-[#1DA1F2] dark:text-[#f8fbffcf] theme-lightsout:text-white">
								SCHEDX
							</span>
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
												? 'bg-blue-100 text-blue-700 font-semibold shadow-sm dark:bg-gray-700/50 dark:text-gray-200 theme-lightsout:!bg-[#222222] theme-lightsout:!text-gray-100 theme-lightsout:!shadow-none'
												: 'text-gray-700 hover:bg-gray-100/80 focus:bg-gray-100/80 dark:text-gray-300 dark:hover:bg-gray-700/80 dark:focus:bg-gray-700/80 theme-lightsout:!bg-transparent theme-lightsout:!text-gray-300 theme-lightsout:hover:!bg-[#222222] theme-lightsout:focus:!bg-[#222222]'}"
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
						class="theme-lightsout:border-gray-800/50 border-t border-gray-200/50 px-2 py-2 dark:border-gray-700/50"
					>
						<div class="flex w-full items-center justify-center gap-1.5">
							<!-- Theme Toggle -->
							<ThemeToggle />

							<!-- Admin Settings Link -->
							<a
								href="/admin/settings"
								class="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-all hover:bg-gray-100 focus:outline-none dark:hover:bg-gray-700 theme-lightsout:hover:bg-gray-800"
								aria-label="Admin Settings"
								title="Admin Settings"
							>
								<svg
									class="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 theme-lightsout:text-white"
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
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
<!-- End Desktop Sidebar -->
