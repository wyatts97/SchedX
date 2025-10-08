<script lang="ts">
	export let title: string = 'No Items Found';
	export let message: string = 'There are no items to display.';
	export let actionLink: string | null = null;
	export let actionText: string | null = null;
	// @ts-ignore
	import { File } from 'lucide-svelte';
</script>

<div
	class="rounded-lg border border-gray-200 bg-gray-100 shadow-lg dark:border-gray-700 dark:bg-gray-800"
>
	<div class="flex flex-col items-center py-12 text-center text-gray-900 dark:text-white">
		<File class="h-12 w-12 text-blue-500 dark:text-blue-400" aria-hidden="true" />
		<h3 class="mt-4 text-xl font-medium text-gray-900 dark:text-white">{title}</h3>
		<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{message}</p>
		{#if actionLink && actionText}
			<div class="mt-6">
				<a
					href={actionLink}
					class="inline-flex items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					{actionText}
				</a>
			</div>
		{/if}
	</div>
</div>
