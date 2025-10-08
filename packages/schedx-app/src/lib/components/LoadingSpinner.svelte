<script lang="ts">
	export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
	export let message: string = 'Loading...';
	export let fullScreen: boolean = false;
	export let overlay: boolean = false;
	export let color: 'blue' | 'gray' | 'white' = 'blue';

	const sizeClasses = {
		sm: 'h-4 w-4',
		md: 'h-8 w-8',
		lg: 'h-12 w-12',
		xl: 'h-16 w-16'
	};

	const colorClasses = {
		blue: 'border-blue-500',
		gray: 'border-gray-500',
		white: 'border-white'
	};

	$: spinnerClass = `${sizeClasses[size]} ${colorClasses[color]} border-4 border-t-transparent rounded-full animate-spin`;
	$: containerClass = fullScreen
		? 'fixed inset-0 flex items-center justify-center z-50'
		: 'flex items-center justify-center p-4';
	$: backgroundClass = overlay
		? 'bg-black bg-opacity-50'
		: fullScreen
			? 'bg-white dark:bg-gray-900'
			: '';
</script>

<div
	class="{containerClass} {backgroundClass}"
	role="status"
	aria-live="polite"
	aria-label={message}
>
	<div class="flex flex-col items-center space-y-3">
		<div class={spinnerClass} aria-hidden="true"></div>

		<div class="text-sm font-medium text-gray-700 dark:text-gray-300">
			{message}
		</div>

		<!-- Screen reader only text -->
		<span class="sr-only"> Please wait while content is loading </span>
	</div>
</div>

<style>
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>
