<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	export let videoUrl: string = '';
	export let open: boolean = false;
	const dispatch = createEventDispatcher();
	let videoEl: HTMLVideoElement;

	function closeModal() {
		open = false;
		dispatch('close');
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeModal();
	}
	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', handleKeydown);
			return () => window.removeEventListener('keydown', handleKeydown);
		}
	});
	$: if (!open && videoEl) videoEl.pause();
</script>

{#if open}
	<div
		class="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-60 transition-opacity duration-200"
		on:click={closeModal}
	>
		<div
			class="relative aspect-video w-full max-w-3xl overflow-hidden rounded-3xl bg-black shadow-2xl"
			on:click|stopPropagation
		>
			<button
				class="absolute right-3 top-3 z-10 rounded-full bg-white p-2 shadow transition hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
				on:click={closeModal}
				aria-label="Close video"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 text-gray-700 dark:text-gray-200"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/></svg
				>
			</button>
			<video
				bind:this={videoEl}
				src={videoUrl}
				controls
				autoplay
				class="h-full w-full rounded-3xl bg-black object-contain"
			/>
		</div>
	</div>
{/if}
