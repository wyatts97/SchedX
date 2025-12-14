<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { RefreshCw } from 'lucide-svelte';

	const dispatch = createEventDispatcher();

	// Configuration
	const PULL_THRESHOLD = 80; // Pixels to pull before triggering refresh
	const MAX_PULL = 120; // Maximum pull distance
	const RESISTANCE = 2.5; // Pull resistance factor

	// State
	let pullDistance = 0;
	let isRefreshing = false;
	let isPulling = false;
	let startY = 0;
	let currentY = 0;

	// Check if we're at the top of the page
	function isAtTop(): boolean {
		return window.scrollY <= 0;
	}

	// Check if it's a touch device
	function isTouchDevice(): boolean {
		return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	}

	function handleTouchStart(e: TouchEvent) {
		if (!isAtTop() || isRefreshing) return;
		
		startY = e.touches[0].clientY;
		isPulling = true;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isPulling || isRefreshing || !isAtTop()) {
			pullDistance = 0;
			return;
		}

		currentY = e.touches[0].clientY;
		const diff = currentY - startY;

		if (diff > 0) {
			// Apply resistance to make it feel natural
			pullDistance = Math.min(diff / RESISTANCE, MAX_PULL);
			
			// Prevent default scrolling when pulling down
			if (pullDistance > 10) {
				e.preventDefault();
			}
		} else {
			pullDistance = 0;
		}
	}

	async function handleTouchEnd() {
		if (!isPulling) return;
		isPulling = false;

		if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
			// Trigger refresh
			isRefreshing = true;
			pullDistance = PULL_THRESHOLD; // Keep indicator visible

			try {
				// Haptic feedback if available
				if (navigator.vibrate) {
					navigator.vibrate(10);
				}

				// Dispatch event for parent components
				dispatch('refresh');

				// Invalidate all data to refresh
				await invalidateAll();
			} catch (error) {
				console.error('Refresh failed:', error);
			} finally {
				isRefreshing = false;
				pullDistance = 0;
			}
		} else {
			// Animate back to 0
			pullDistance = 0;
		}
	}

	onMount(() => {
		if (browser && isTouchDevice()) {
			document.addEventListener('touchstart', handleTouchStart, { passive: true });
			document.addEventListener('touchmove', handleTouchMove, { passive: false });
			document.addEventListener('touchend', handleTouchEnd, { passive: true });
		}
	});

	onDestroy(() => {
		if (browser) {
			document.removeEventListener('touchstart', handleTouchStart);
			document.removeEventListener('touchmove', handleTouchMove);
			document.removeEventListener('touchend', handleTouchEnd);
		}
	});

	// Calculate indicator opacity and rotation
	$: indicatorOpacity = Math.min(pullDistance / PULL_THRESHOLD, 1);
	$: indicatorRotation = (pullDistance / MAX_PULL) * 360;
	$: isThresholdReached = pullDistance >= PULL_THRESHOLD;
</script>

<!-- Pull to Refresh Indicator -->
{#if pullDistance > 0 || isRefreshing}
	<div
		class="fixed left-0 right-0 top-0 z-[100] flex items-center justify-center lg:hidden"
		style="transform: translateY({Math.min(pullDistance, MAX_PULL) - 50}px); opacity: {indicatorOpacity};"
	>
		<div
			class="flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-colors duration-200
				{isThresholdReached || isRefreshing
					? 'bg-blue-500 text-white'
					: 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-300 theme-lightsout:bg-gray-900 theme-lightsout:text-white'}"
		>
			<RefreshCw
				class="h-5 w-5 {isRefreshing ? 'animate-spin' : ''}"
				style="transform: rotate({isRefreshing ? 0 : indicatorRotation}deg);"
			/>
		</div>
	</div>
{/if}

<!-- Visual feedback overlay when pulling -->
{#if isPulling && pullDistance > 10}
	<div
		class="pointer-events-none fixed inset-x-0 top-0 z-[99] lg:hidden"
		style="height: {pullDistance}px; background: linear-gradient(to bottom, rgba(59, 130, 246, 0.1), transparent);"
	></div>
{/if}

<style>
	/* Smooth transitions for the indicator */
	div {
		transition: transform 0.15s ease-out, opacity 0.15s ease-out;
	}
</style>
