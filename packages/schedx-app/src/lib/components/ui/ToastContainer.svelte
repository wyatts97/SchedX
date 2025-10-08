<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toastStore } from '$lib/stores/toastStore';
	import Toast from './Toast.svelte';

	const handleDismiss = (id: string) => {
		toastStore.remove(id);
	};
</script>

<div
	class="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 transform flex-col items-center space-y-4"
	aria-live="assertive"
	aria-label="Notifications"
>
	<div class="flex w-full flex-col items-center space-y-4">
		{#each $toastStore as toast (toast.id)}
			<div transition:fly={{ y: 100, duration: 300 }} class="pointer-events-auto w-full">
				<Toast {toast} on:dismiss={(e) => handleDismiss(e.detail)} />
			</div>
		{/each}
	</div>
</div>
