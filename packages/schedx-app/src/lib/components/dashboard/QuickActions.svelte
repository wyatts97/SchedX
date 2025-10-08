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
				class="theme-lightsout:border-gray-800 theme-lightsout:bg-gray-800/50 theme-lightsout:hover:bg-gray-800/70 flex items-center rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
			>
				<Edit3
					class="theme-lightsout:text-blue-400 mr-3 h-5 w-5 text-primary-600 dark:text-primary-400"
				/>
				<div>
					<p class="theme-lightsout:text-white text-sm font-medium text-gray-900 dark:text-white">
						Create New Tweet
					</p>
					<p class="theme-lightsout:text-gray-300 text-sm text-gray-500 dark:text-gray-400">
						Schedule or post a new tweet
					</p>
				</div>
			</a>
			<a
				href="/accounts"
				class="theme-lightsout:border-gray-800 theme-lightsout:bg-gray-800/50 theme-lightsout:hover:bg-gray-800/70 flex items-center rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
			>
				<Users
					class="theme-lightsout:text-blue-400 mr-3 h-5 w-5 text-primary-600 dark:text-primary-400"
				/>
				<div>
					<p class="theme-lightsout:text-white text-sm font-medium text-gray-900 dark:text-white">
						Manage Accounts
					</p>
					<p class="theme-lightsout:text-gray-300 text-sm text-gray-500 dark:text-gray-400">
						View and configure Twitter accounts
					</p>
				</div>
			</a>
			<a
				href="/templates"
				class="theme-lightsout:border-gray-800 theme-lightsout:bg-gray-800/50 theme-lightsout:hover:bg-gray-800/70 flex items-center rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
			>
				<FileText
					class="theme-lightsout:text-blue-400 mr-3 h-5 w-5 text-primary-600 dark:text-primary-400"
				/>
				<div>
					<p class="theme-lightsout:text-white text-sm font-medium text-gray-900 dark:text-white">
						Templates
					</p>
					<p class="theme-lightsout:text-gray-300 text-sm text-gray-500 dark:text-gray-400">
						Create and manage tweet templates
					</p>
				</div>
			</a>
		</div>
	</div>
</div>
