<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toastStore';

	export let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right';

	$: positionClasses = {
		'top-right': 'top-4 right-4',
		'top-left': 'top-4 left-4',
		'bottom-right': 'bottom-4 right-4',
		'bottom-left': 'bottom-4 left-4'
	}[position];

	function getIcon(type: string) {
		switch (type) {
			case 'success':
				return CheckCircle;
			case 'error':
				return XCircle;
			case 'warning':
				return AlertCircle;
			case 'info':
			default:
				return Info;
		}
	}

	function getColorClasses(type: string) {
		switch (type) {
			case 'success':
				return 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800';
			case 'error':
				return 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800';
			case 'warning':
				return 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-200 dark:border-yellow-800';
			case 'info':
			default:
				return 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800';
		}
	}

	function dismiss(id: string) {
		toastStore.remove(id);
	}
</script>

<div class="pointer-events-none fixed z-50 flex flex-col gap-2 {positionClasses}">
	{#each $toastStore as toast (toast.id)}
		<div
			transition:fly={{ x: position.includes('right') ? 100 : -100, duration: 300 }}
			class="pointer-events-auto w-96 max-w-full"
		>
			<div
				class="flex items-start gap-3 rounded-lg border p-4 shadow-lg {getColorClasses(toast.type)}"
			>
				<!-- Icon -->
				<div class="flex-shrink-0">
					<svelte:component this={getIcon(toast.type)} class="h-5 w-5" />
				</div>

				<!-- Content -->
				<div class="flex-1 min-w-0">
					{#if toast.title}
						<h4 class="font-semibold mb-1">{toast.title}</h4>
					{/if}
					<p class="text-sm">{toast.message}</p>
					{#if toast.correlationId}
						<p class="mt-1 text-xs opacity-75">
							ID: <code class="rounded bg-black/10 px-1 py-0.5">{toast.correlationId}</code>
						</p>
					{/if}
				</div>

				<!-- Close Button -->
				<button
					on:click={() => dismiss(toast.id)}
					class="flex-shrink-0 rounded p-1 transition-colors hover:bg-black/10"
					aria-label="Dismiss"
				>
					<X class="h-4 w-4" />
				</button>
			</div>
		</div>
	{/each}
</div>
