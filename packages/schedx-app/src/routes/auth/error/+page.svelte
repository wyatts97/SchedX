<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
	<div class="max-w-md text-center">
		<h1 class="mb-6 text-4xl font-bold text-red-600 dark:text-red-400">Authentication Error</h1>
		<p class="py-6 text-gray-700 dark:text-gray-300">
			{#if $page.url.searchParams.get('error') === 'AccessDenied'}
				Your account is not authorized to use this application.
			{:else}
				There was an error during authentication. Please try again.
			{/if}
		</p>
		<a
			href="/"
			class="inline-flex items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
			>Return to Home</a
		>
	</div>
</div>
