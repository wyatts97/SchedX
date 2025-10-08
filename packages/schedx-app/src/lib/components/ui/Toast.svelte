<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-svelte';
	import type { ToastMessage } from '$lib/types';

	export let toast: ToastMessage;

	const dispatch = createEventDispatcher<{
		dismiss: string;
	}>();

	const icons = {
		success: CheckCircle,
		error: XCircle,
		warning: AlertTriangle,
		info: Info
	};

	const colorClasses = {
		success:
			'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200',
		error:
			'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200',
		warning:
			'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200',
		info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200'
	};

	const iconColorClasses = {
		success: 'text-green-400',
		error: 'text-red-400',
		warning: 'text-yellow-400',
		info: 'text-blue-400'
	};

	let timeoutId: NodeJS.Timeout;

	const handleDismiss = () => {
		dispatch('dismiss', toast.id);
	};

	onMount(() => {
		if (toast.duration && toast.duration > 0) {
			timeoutId = setTimeout(() => {
				handleDismiss();
			}, toast.duration);
		}

		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	});

	$: IconComponent = icons[toast.type];
</script>

<div
	class="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border shadow-lg {colorClasses[
		toast.type
	]}"
	role="alert"
	aria-live="assertive"
	aria-atomic="true"
>
	<div class="p-4">
		<div class="flex items-start">
			<div class="flex-shrink-0">
				<IconComponent class="h-5 w-5 {iconColorClasses[toast.type]}" aria-hidden="true" />
			</div>
			<div class="ml-3 w-0 flex-1 pt-0.5">
				<p class="text-sm font-medium">
					{toast.title}
				</p>
				{#if toast.message}
					<p class="mt-1 text-sm opacity-90">
						{toast.message}
					</p>
				{/if}
				{#if toast.actions && toast.actions.length > 0}
					<div class="mt-3 flex gap-2">
						{#each toast.actions as action}
							<a
								href={action.url}
								target={action.target || '_blank'}
								rel="noopener noreferrer"
								class="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors
									{action.variant === 'secondary'
									? 'border-current/20 border bg-white/20 hover:bg-white/30'
									: 'bg-current/10 hover:bg-current/20'}"
							>
								{action.label}
							</a>
						{/each}
					</div>
				{/if}
			</div>
			{#if toast.dismissible !== false}
				<div class="ml-4 flex flex-shrink-0">
					<button
						class="inline-flex items-center justify-center rounded-md p-1 transition-opacity hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-0"
						on:click={handleDismiss}
						aria-label="Dismiss notification"
					>
						<X class="h-4 w-4" aria-hidden="true" />
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>
