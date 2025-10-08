<script lang="ts">
	import type { ButtonProps } from '$lib/types';
	import { createEventDispatcher } from 'svelte';
	import logger from '$lib/logger';

	type $$Props = ButtonProps & {
		onClick?: () => void | Promise<void>;
	};

	export let variant: ButtonProps['variant'] = 'primary';
	export let size: ButtonProps['size'] = 'md';
	export let disabled: boolean = false;
	export let loading: boolean = false;
	export let type: ButtonProps['type'] = 'button';
	export let href: string | undefined = undefined;
	export let target: string | undefined = undefined;
	export let onClick: (() => void | Promise<void>) | undefined = undefined;

	// Component props
	let className: string = '';
	export { className as class };
	export let dataTestId: string | undefined = undefined;

	const dispatch = createEventDispatcher<{
		click: MouseEvent;
	}>();

	const baseClasses =
		'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

	const variantClasses = {
		primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm',
		secondary:
			'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600',
		danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm',
		ghost:
			'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 dark:text-gray-300 dark:hover:bg-gray-800',
		link: 'text-blue-600 hover:text-blue-700 underline focus:ring-blue-500 dark:text-blue-400 dark:hover:text-blue-300'
	};

	const sizeClasses = {
		xs: 'px-2.5 py-1.5 text-xs rounded',
		sm: 'px-3 py-2 text-sm rounded-md',
		md: 'px-4 py-2 text-sm rounded-md',
		lg: 'px-4 py-2 text-base rounded-md',
		xl: 'px-6 py-3 text-base rounded-md'
	};

	$: buttonClasses = [
		baseClasses,
		variantClasses[variant || 'primary'],
		variant !== 'link' ? sizeClasses[size || 'md'] : '',
		className
	]
		.filter(Boolean)
		.join(' ');

	const handleClick = async (event: MouseEvent) => {
		if (disabled || loading) {
			event.preventDefault();
			return;
		}

		dispatch('click', event);

		if (onClick) {
			try {
				await onClick();
			} catch (error) {
				logger.error('Button onClick error:', error);
			}
		}
	};
</script>

{#if href}
	<a
		{href}
		{target}
		class={buttonClasses}
		class:pointer-events-none={disabled || loading}
		data-testid={dataTestId}
		role="button"
		tabindex={disabled ? -1 : 0}
		aria-disabled={disabled || loading}
		on:click={handleClick}
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleClick(e as any);
			}
		}}
	>
		{#if loading}
			<svg
				class="mr-2 h-4 w-4 animate-spin"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
		{/if}
		<slot />
	</a>
{:else}
	<button
		{type}
		class={buttonClasses}
		{disabled}
		data-testid={dataTestId}
		aria-disabled={disabled || loading}
		on:click={handleClick}
	>
		{#if loading}
			<svg
				class="mr-2 h-4 w-4 animate-spin"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
		{/if}
		<slot />
	</button>
{/if}

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
