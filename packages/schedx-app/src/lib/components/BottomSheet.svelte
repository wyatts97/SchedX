<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { fly, fade } from 'svelte/transition';
	import { focusTrap } from '$lib/actions/focusTrap';
	import { X } from 'lucide-svelte';

	export let open: boolean = false;
	export let title: string = '';
	export let showHandle: boolean = true;
	export let closeOnBackdrop: boolean = true;
	export let closeOnEscape: boolean = true;
	export let maxHeight: string = '85vh';

	const dispatch = createEventDispatcher();

	let sheetElement: HTMLDivElement;
	let startY = 0;
	let currentY = 0;
	let isDragging = false;

	function close() {
		open = false;
		dispatch('close');
	}

	function handleBackdropClick() {
		if (closeOnBackdrop) {
			close();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && closeOnEscape) {
			close();
		}
	}

	// Touch handling for drag-to-close
	function handleTouchStart(event: TouchEvent) {
		if (!showHandle) return;
		startY = event.touches[0].clientY;
		isDragging = true;
	}

	function handleTouchMove(event: TouchEvent) {
		if (!isDragging) return;
		currentY = event.touches[0].clientY;
		const deltaY = currentY - startY;
		
		// Only allow dragging down
		if (deltaY > 0 && sheetElement) {
			sheetElement.style.transform = `translateY(${deltaY}px)`;
		}
	}

	function handleTouchEnd() {
		if (!isDragging) return;
		isDragging = false;
		
		const deltaY = currentY - startY;
		
		// Close if dragged more than 100px down
		if (deltaY > 100) {
			close();
		}
		
		// Reset position
		if (sheetElement) {
			sheetElement.style.transform = '';
		}
		
		startY = 0;
		currentY = 0;
	}

	// Lock body scroll when open
	$: if (browser && open) {
		document.body.style.overflow = 'hidden';
	} else if (browser) {
		document.body.style.overflow = '';
	}

	onDestroy(() => {
		if (browser) {
			document.body.style.overflow = '';
		}
	});
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
		transition:fade={{ duration: 200 }}
		on:click={handleBackdropClick}
		on:keydown={(e) => e.key === 'Enter' && handleBackdropClick()}
		role="button"
		tabindex="-1"
		aria-label="Close modal"
	/>

	<!-- Bottom Sheet -->
	<div
		bind:this={sheetElement}
		class="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-gray-900 theme-lightsout:bg-[#111111] md:hidden"
		style="max-height: {maxHeight};"
		transition:fly={{ y: 400, duration: 300 }}
		use:focusTrap={{ onEscape: closeOnEscape ? close : undefined }}
		on:touchstart={handleTouchStart}
		on:touchmove={handleTouchMove}
		on:touchend={handleTouchEnd}
		role="dialog"
		aria-modal="true"
		aria-labelledby={title ? 'bottom-sheet-title' : undefined}
	>
		<!-- Handle -->
		{#if showHandle}
			<div class="flex justify-center py-3">
				<div class="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />
			</div>
		{/if}

		<!-- Header -->
		{#if title}
			<div class="flex items-center justify-between border-b border-gray-200 px-4 pb-3 dark:border-gray-700">
				<h2 id="bottom-sheet-title" class="text-lg font-semibold text-gray-900 dark:text-white">
					{title}
				</h2>
				<button
					type="button"
					class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
					on:click={close}
					aria-label="Close"
				>
					<X class="h-5 w-5" />
				</button>
			</div>
		{/if}

		<!-- Content -->
		<div class="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
			<slot />
		</div>

		<!-- Footer slot -->
		{#if $$slots.footer}
			<div class="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
				<slot name="footer" />
			</div>
		{/if}

		<!-- Safe area for bottom notch on iOS -->
		<div class="h-safe-area-inset-bottom bg-white dark:bg-gray-900 theme-lightsout:bg-[#111111]" />
	</div>
{/if}

<style>
	.h-safe-area-inset-bottom {
		height: env(safe-area-inset-bottom, 0px);
	}
</style>
