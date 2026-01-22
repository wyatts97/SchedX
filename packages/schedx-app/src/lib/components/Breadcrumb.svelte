<script lang="ts">
	import { page } from '$app/stores';
	import { ChevronRight, Home } from 'lucide-svelte';

	interface BreadcrumbItem {
		label: string;
		href: string;
	}

	// Route label mappings
	const routeLabels: Record<string, string> = {
		'': 'Dashboard',
		'admin': 'Admin',
		'settings': 'Settings',
		'queue': 'Queue',
		'post': 'Create Post',
		'scheduled': 'Scheduled',
		'drafts': 'Drafts',
		'history': 'History',
		'gallery': 'Gallery',
		'accounts': 'Accounts',
		'thread': 'Thread',
		'twitter-apps': 'Twitter Apps',
		'openrouter': 'OpenRouter AI',
		'tweet-data': 'Tweet Data',
		'general': 'General'
	};

	function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
		const segments = pathname.split('/').filter(Boolean);
		const breadcrumbs: BreadcrumbItem[] = [];

		// Always start with home
		breadcrumbs.push({ label: 'Home', href: '/' });

		let currentPath = '';
		for (const segment of segments) {
			currentPath += `/${segment}`;
			const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
			breadcrumbs.push({ label, href: currentPath });
		}

		return breadcrumbs;
	}

	$: breadcrumbs = generateBreadcrumbs($page.url.pathname);
	$: showBreadcrumbs = breadcrumbs.length > 2; // Only show if more than Home > Current
</script>

{#if showBreadcrumbs}
	<nav aria-label="Breadcrumb" class="mb-4">
		<ol class="flex flex-wrap items-center gap-1.5 text-sm">
			{#each breadcrumbs as crumb, index}
				<li class="flex items-center gap-1.5">
					{#if index > 0}
						<ChevronRight class="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
					{/if}
					{#if index === breadcrumbs.length - 1}
						<span 
							class="font-medium text-gray-900 dark:text-white theme-lightsout:text-gray-100"
							aria-current="page"
						>
							{crumb.label}
						</span>
					{:else}
						<a
							href={crumb.href}
							class="flex items-center gap-1 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 theme-lightsout:text-gray-400 theme-lightsout:hover:text-gray-200"
						>
							{#if index === 0}
								<Home class="h-3.5 w-3.5" aria-hidden="true" />
								<span class="sr-only sm:not-sr-only">{crumb.label}</span>
							{:else}
								{crumb.label}
							{/if}
						</a>
					{/if}
				</li>
			{/each}
		</ol>
	</nav>
{/if}
