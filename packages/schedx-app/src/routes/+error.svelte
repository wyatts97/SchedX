<script lang="ts">
	import { page } from '$app/stores';
	import { AlertCircle, Home, RefreshCw } from 'lucide-svelte';

	$: error = $page.error;
	$: status = $page.status;
	$: correlationId = $page.data?.correlationId;

	function reload() {
		window.location.reload();
	}

	function goHome() {
		window.location.href = '/';
	}

	// Get user-friendly error message
	function getErrorMessage(status: number): string {
		switch (status) {
			case 400:
				return 'Bad Request - The request could not be understood.';
			case 401:
				return 'Unauthorized - Please log in to continue.';
			case 403:
				return 'Forbidden - You don\'t have permission to access this resource.';
			case 404:
				return 'Page Not Found - The page you\'re looking for doesn\'t exist.';
			case 429:
				return 'Too Many Requests - Please slow down and try again later.';
			case 500:
				return 'Internal Server Error - Something went wrong on our end.';
			case 502:
				return 'Bad Gateway - The server is temporarily unavailable.';
			case 503:
				return 'Service Unavailable - The service is temporarily down for maintenance.';
			default:
				return 'An unexpected error occurred.';
		}
	}
</script>

<svelte:head>
	<title>Error {status} - SchedX</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
	<div class="w-full max-w-md text-center">
		<!-- Error Icon -->
		<div class="mb-6 flex justify-center">
			<div class="rounded-full bg-red-100 p-6 dark:bg-red-900/20">
				<AlertCircle class="h-16 w-16 text-red-600 dark:text-red-400" />
			</div>
		</div>

		<!-- Error Status -->
		<h1 class="mb-2 text-6xl font-bold text-gray-900 dark:text-white">
			{status}
		</h1>

		<!-- Error Message -->
		<h2 class="mb-4 text-2xl font-semibold text-gray-800 dark:text-gray-200">
			{getErrorMessage(status)}
		</h2>

		<!-- Error Details (Development Only) -->
		{#if error?.message && import.meta.env.DEV}
			<div class="mb-6 rounded-lg bg-red-50 p-4 text-left dark:bg-red-900/10">
				<p class="text-sm font-mono text-red-800 dark:text-red-300">
					{error.message}
				</p>
			</div>
		{/if}

		<!-- Correlation ID -->
		{#if correlationId}
			<p class="mb-6 text-sm text-gray-500 dark:text-gray-400">
				Error ID: <code class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">{correlationId}</code>
			</p>
		{/if}

		<!-- Action Buttons -->
		<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
			<button
				on:click={reload}
				class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
			>
				<RefreshCw class="h-4 w-4" />
				Try Again
			</button>
			<button
				on:click={goHome}
				class="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-200 px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
			>
				<Home class="h-4 w-4" />
				Go Home
			</button>
		</div>

		<!-- Help Text -->
		<p class="mt-8 text-sm text-gray-600 dark:text-gray-400">
			If this problem persists, please contact support
			{#if correlationId}
				and provide the error ID above.
			{/if}
		</p>
	</div>
</div>
