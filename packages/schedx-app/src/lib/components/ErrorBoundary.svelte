<script lang="ts">
	import { onMount } from 'svelte';
	import { AlertTriangle, RefreshCw, Home } from 'lucide-svelte';
	import logger from '$lib/logger';

	export let fallback: boolean = false;
	export let error: Error | null = null;
	export let errorId: string = '';

	let hasError = false;
	let errorDetails = '';
	let retryCount = 0;
	const maxRetries = 3;

	$: if (error) {
		hasError = true;
		errorDetails = error.message || 'An unexpected error occurred';

		// Log error with context
		logger.error('Component error caught by ErrorBoundary', {
			error: error.message,
			stack: error.stack,
			errorId,
			retryCount,
			timestamp: new Date().toISOString(),
			userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
		});
	}

	const handleRetry = () => {
		if (retryCount < maxRetries) {
			retryCount++;
			hasError = false;
			error = null;

			// Trigger a re-render by dispatching a custom event
			if (typeof window !== 'undefined') {
				window.location.reload();
			}
		}
	};

	const handleReportError = () => {
		// In a real app, this would send to an error reporting service
		logger.error('User reported error', {
			error: errorDetails,
			errorId,
			retryCount,
			timestamp: new Date().toISOString()
		});

		// Show user feedback
		if (typeof window !== 'undefined') {
			alert('Error reported. Thank you for helping us improve!');
		}
	};

	onMount(() => {
		// Global error handler for unhandled promise rejections
		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			logger.error('Unhandled promise rejection', {
				reason: event.reason,
				errorId: `unhandled-${Date.now()}`,
				timestamp: new Date().toISOString()
			});
		};

		window.addEventListener('unhandledrejection', handleUnhandledRejection);

		return () => {
			window.removeEventListener('unhandledrejection', handleUnhandledRejection);
		};
	});
</script>

{#if hasError || fallback}
	<div
		class="flex min-h-[400px] items-center justify-center p-6"
		role="alert"
		aria-live="assertive"
		aria-labelledby="error-title"
		aria-describedby="error-description"
	>
		<div
			class="w-full max-w-md rounded-lg border border-red-200 bg-white shadow-lg dark:border-red-800 dark:bg-gray-800"
		>
			<div class="p-6 text-center">
				<div
					class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20"
				>
					<AlertTriangle class="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
				</div>

				<h3 id="error-title" class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
					Something went wrong
				</h3>

				<p id="error-description" class="mb-6 text-sm text-gray-600 dark:text-gray-400">
					{errorDetails || 'We encountered an unexpected error. Please try again.'}
				</p>

				{#if errorId}
					<p class="mb-4 font-mono text-xs text-gray-500 dark:text-gray-500">
						Error ID: {errorId}
					</p>
				{/if}

				<div class="flex flex-col justify-center gap-3 sm:flex-row">
					{#if retryCount < maxRetries}
						<button
							on:click={handleRetry}
							class="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
							aria-label="Retry the failed operation"
						>
							<RefreshCw class="mr-2 h-4 w-4" aria-hidden="true" />
							Retry ({maxRetries - retryCount} left)
						</button>
					{/if}

					<a
						href="/"
						class="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						aria-label="Go back to homepage"
					>
						<Home class="mr-2 h-4 w-4" aria-hidden="true" />
						Go Home
					</a>

					<button
						on:click={handleReportError}
						class="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						aria-label="Report this error to help us improve"
					>
						Report Error
					</button>
				</div>
			</div>
		</div>
	</div>
{:else}
	<slot />
{/if}
