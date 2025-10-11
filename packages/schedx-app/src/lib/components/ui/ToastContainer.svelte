<script lang="ts">
	import { fly, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { toastStore } from '$lib/stores/toastStore';
	import Toast from './Toast.svelte';

	const handleDismiss = (id: string) => {
		toastStore.remove(id);
	};
</script>

<!-- Desktop: Top-right, Mobile: Bottom-center -->
<div
	class="pointer-events-none fixed z-50 flex w-full flex-col items-end gap-3 p-4 
		   sm:right-0 sm:top-0 sm:max-w-md
		   max-sm:bottom-0 max-sm:left-1/2 max-sm:max-w-md max-sm:-translate-x-1/2"
	aria-live="polite"
	aria-label="Notifications"
>
	{#each $toastStore as toast (toast.id)}
		<div
			transition:fly={{ 
				x: window.innerWidth > 640 ? 400 : 0, 
				y: window.innerWidth > 640 ? 0 : 100, 
				duration: 400, 
				easing: quintOut 
			}}
			class="pointer-events-auto w-full"
		>
			<Toast {toast} on:dismiss={(e) => handleDismiss(e.detail)} />
		</div>
	{/each}
</div>
