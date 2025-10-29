<!--
  @component QuickActions
  
  Provides quick action buttons for common tasks.
  
  @example
  <QuickActions />
-->

<script lang="ts">
	import { Plus, BarChart3, MessageSquare, Repeat2 } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	function handleScheduleTweet() {
		goto('/post');
	}

	function handleCreateThread() {
		goto('/post?thread=true');
	}

	function handleViewAnalytics() {
		goto('/history');
	}

	// Reshare top performer - will be implemented later
	function handleReshareTop() {
		// TODO: Implement reshare functionality
		alert('Reshare top performer feature coming soon!');
	}
</script>

<div class="mb-6">
	<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Schedule Tweet -->
		<button
			on:click={handleScheduleTweet}
			class="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-blue-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500"
		>
			<div
				class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 transition group-hover:bg-blue-200 dark:bg-blue-900/30 dark:group-hover:bg-blue-900/50"
			>
				<Plus class="h-5 w-5 text-blue-600 dark:text-blue-400" />
			</div>
			<div class="text-left">
				<p class="font-medium text-gray-900 dark:text-white">Schedule Tweet</p>
				<p class="text-xs text-gray-500 dark:text-gray-400">Create new post</p>
			</div>
		</button>

		<!-- Create Thread -->
		<button
			on:click={handleCreateThread}
			class="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-purple-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-purple-500"
		>
			<div
				class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100 transition group-hover:bg-purple-200 dark:bg-purple-900/30 dark:group-hover:bg-purple-900/50"
			>
				<MessageSquare class="h-5 w-5 text-purple-600 dark:text-purple-400" />
			</div>
			<div class="text-left">
				<p class="font-medium text-gray-900 dark:text-white">Create Thread</p>
				<p class="text-xs text-gray-500 dark:text-gray-400">Multi-tweet post</p>
			</div>
		</button>

		<!-- View Analytics -->
		<button
			on:click={handleViewAnalytics}
			class="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-green-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-green-500"
		>
			<div
				class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-100 transition group-hover:bg-green-200 dark:bg-green-900/30 dark:group-hover:bg-green-900/50"
			>
				<BarChart3 class="h-5 w-5 text-green-600 dark:text-green-400" />
			</div>
			<div class="text-left">
				<p class="font-medium text-gray-900 dark:text-white">View Analytics</p>
				<p class="text-xs text-gray-500 dark:text-gray-400">Tweet history</p>
			</div>
		</button>

		<!-- Reshare Top Performer -->
		<button
			on:click={handleReshareTop}
			class="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-500"
		>
			<div
				class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100 transition group-hover:bg-indigo-200 dark:bg-indigo-900/30 dark:group-hover:bg-indigo-900/50"
			>
				<Repeat2 class="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
			</div>
			<div class="text-left">
				<p class="font-medium text-gray-900 dark:text-white">Reshare Top</p>
				<p class="text-xs text-gray-500 dark:text-gray-400">Best performer</p>
			</div>
		</button>
	</div>
</div>
