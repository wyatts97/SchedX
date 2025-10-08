<script lang="ts">
	export let currentPage: number;
	export let totalPages: number;
	export let basePath: string;
</script>

{#if totalPages > 1}
	<div class="mt-8 flex items-center justify-center space-x-2">
		{#if currentPage > 1}
			<a
				href="{basePath}?page={currentPage - 1}"
				class="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
			>
				Previous
			</a>
		{/if}

		{#each Array(totalPages) as _, i}
			{@const pageNum = i + 1}
			<a
				href="{basePath}?page={pageNum}"
				class="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 {pageNum ===
				currentPage
					? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600 focus:ring-blue-500'
					: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
			>
				{pageNum}
			</a>
		{/each}

		{#if currentPage < totalPages}
			<a
				href="{basePath}?page={currentPage + 1}"
				class="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
			>
				Next
			</a>
		{/if}
	</div>
{/if}
