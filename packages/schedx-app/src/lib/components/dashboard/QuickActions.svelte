<script lang="ts">
	import { Edit3, Users, FileText } from 'lucide-svelte';
</script>

<div class="theme-lightsout:bg-gray-900 rounded-lg bg-white shadow dark:bg-gray-800">
	<div class="px-4 py-5 sm:p-6">
		<h3
			class="theme-lightsout:text-white mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-white"
		>
			Quick Actions
		</h3>
		<div class="grid grid-cols-1 gap-4">
			<a
				href="/post"
				class="group flex items-center rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
			>
				<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 transition-colors group-hover:bg-blue-100 dark:bg-blue-900/20 dark:group-hover:bg-blue-900/30">
					<Edit3 class="h-6 w-6 text-blue-600 dark:text-blue-400" />
				</div>
				<div class="ml-4 flex-1">
					<p class="text-sm font-semibold text-gray-900 dark:text-white">
						Create New Tweet
					</p>
					<p class="text-sm text-gray-500 dark:text-gray-400">
						Schedule or post a new tweet
					</p>
				</div>
				<svg class="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</a>
			<a
				href="/accounts"
				class="group flex items-center rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-purple-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-purple-600"
			>
				<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 transition-colors group-hover:bg-purple-100 dark:bg-purple-900/20 dark:group-hover:bg-purple-900/30">
					<Users class="h-6 w-6 text-purple-600 dark:text-purple-400" />
				</div>
				<div class="ml-4 flex-1">
					<p class="text-sm font-semibold text-gray-900 dark:text-white">
						Manage Accounts
					</p>
					<p class="text-sm text-gray-500 dark:text-gray-400">
						View and configure Twitter accounts
					</p>
				</div>
				<svg class="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</a>
			<a
				href="/templates"
				class="group flex items-center rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-green-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-green-600"
			>
				<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 transition-colors group-hover:bg-green-100 dark:bg-green-900/20 dark:group-hover:bg-green-900/30">
					<FileText class="h-6 w-6 text-green-600 dark:text-green-400" />
				</div>
				<div class="ml-4 flex-1">
					<p class="text-sm font-semibold text-gray-900 dark:text-white">
						Templates
					</p>
					<p class="text-sm text-gray-500 dark:text-gray-400">
						Create and manage tweet templates
					</p>
				</div>
				<svg class="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</a>
		</div>
	</div>
</div>
