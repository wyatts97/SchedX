<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { RefreshCw, Check } from 'lucide-svelte';

	const dispatch = createEventDispatcher();

	// Configuration
	const PULL_THRESHOLD = 60; // Reduced threshold for easier triggering
	const MAX_PULL = 100; // Maximum pull distance
	const RESISTANCE = 2.0; // Slightly less resistance for better feel
	const MIN_REFRESH_TIME = 800; // Minimum time to show refreshing state (ms)

	// State
	let pullDistance = 0;
	let isRefreshing = false;
	let isPulling = false;
	let startY = 0;
	let currentY = 0;
	let refreshComplete = false;
	let canPull = false; // Track if we started at top

	// Check if we're at the top of the page
	function isAtTop(): boolean {
		// Check both window scroll and any scrollable containers
		const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
		return scrollY <= 5; // Small tolerance for edge cases
	}

	// Check if it's a touch device or PWA
	function isTouchDevice(): boolean {
		return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	}

	// Check if running as PWA
	function isPWA(): boolean {
		return window.matchMedia('(display-mode: standalone)').matches ||
			(window.navigator as any).standalone === true;
	}

	function handleTouchStart(e: TouchEvent) {
		if (isRefreshing) return;
		
		// Only enable pulling if we start at the top
		canPull = isAtTop();
		if (!canPull) return;
		
		startY = e.touches[0].clientY;
		isPulling = true;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isPulling || isRefreshing || !canPull) {
			return;
		}

		// Re-check if we're still at top (user might have scrolled up)
		if (!isAtTop() && pullDistance === 0) {
			isPulling = false;
			return;
		}

		currentY = e.touches[0].clientY;
		const diff = currentY - startY;

		if (diff > 0) {
			// Apply resistance to make it feel natural
			pullDistance = Math.min(diff / RESISTANCE, MAX_PULL);
			
			// Prevent default scrolling when pulling down
			if (pullDistance > 5) {
				e.preventDefault();
			}
		} else {
			pullDistance = 0;
		}
	}

	async function handleTouchEnd() {
		if (!isPulling) return;
		isPulling = false;
		canPull = false;

		if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
			// Trigger refresh
			isRefreshing = true;
			refreshComplete = false;
			pullDistance = 0; // Reset pull distance, overlay will show

			try {
				// Haptic feedback if available
				if (navigator.vibrate) {
					navigator.vibrate([10, 50, 10]); // Double vibration pattern
				}

				// Dispatch event for parent components
				dispatch('refresh');

				// Start timer for minimum display time
				const startTime = Date.now();

				// Invalidate all data to refresh
				await invalidateAll();

				// Ensure minimum display time for visual feedback
				const elapsed = Date.now() - startTime;
				if (elapsed < MIN_REFRESH_TIME) {
					await new Promise(resolve => setTimeout(resolve, MIN_REFRESH_TIME - elapsed));
				}

				// Show success state briefly
				refreshComplete = true;
				await new Promise(resolve => setTimeout(resolve, 500));

			} catch (error) {
				console.error('Refresh failed:', error);
			} finally {
				isRefreshing = false;
				refreshComplete = false;
				pullDistance = 0;
			}
		} else {
			// Animate back to 0
			pullDistance = 0;
		}
	}

	onMount(() => {
		if (browser && isTouchDevice()) {
			// Use capture phase for better interception
			document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: false });
			document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: false });
			document.addEventListener('touchend', handleTouchEnd, { passive: true, capture: false });
			
			// Log PWA status for debugging
			if (isPWA()) {
				console.debug('Pull-to-refresh: Running as PWA');
			}
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
	$: pullProgress = Math.min((pullDistance / PULL_THRESHOLD) * 100, 100);
</script>

<!-- Full-screen Refreshing Overlay -->
{#if isRefreshing}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm lg:hidden"
		role="alert"
		aria-live="polite"
		aria-label="Refreshing content"
	>
		<div class="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-2xl dark:bg-gray-800 theme-lightsout:bg-gray-900">
			{#if refreshComplete}
				<!-- Success State -->
				<div class="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 theme-lightsout:bg-green-900/40">
					<Check class="h-8 w-8 text-green-600 dark:text-green-400" />
				</div>
				<span class="text-base font-medium text-green-600 dark:text-green-400">Updated!</span>
			{:else}
				<!-- Loading State -->
				<div class="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 theme-lightsout:bg-blue-900/40">
					<RefreshCw class="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
				</div>
				<span class="text-base font-medium text-gray-700 dark:text-gray-200 theme-lightsout:text-gray-100">Refreshing...</span>
			{/if}
		</div>
	</div>
{/if}

<!-- Pull Indicator (shown while pulling) -->
{#if pullDistance > 0 && !isRefreshing}
	<div
		class="fixed left-1/2 top-0 z-[9998] -translate-x-1/2 lg:hidden"
		style="transform: translateX(-50%) translateY({Math.min(pullDistance, MAX_PULL) - 20}px);"
	>
		<div
			class="flex flex-col items-center gap-2 rounded-full px-4 py-2 shadow-lg transition-all duration-150
				{isThresholdReached
					? 'bg-blue-500 text-white scale-110'
					: 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-300 theme-lightsout:bg-gray-900 theme-lightsout:text-white'}"
		>
			<div class="flex items-center gap-2">
				<RefreshCw
					class="h-5 w-5 transition-transform duration-150"
					style="transform: rotate({indicatorRotation}deg);"
				/>
				<span class="text-sm font-medium whitespace-nowrap">
					{isThresholdReached ? 'Release to refresh' : 'Pull to refresh'}
				</span>
			</div>
			<!-- Progress bar -->
			<div class="h-1 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
				<div
					class="h-full rounded-full transition-all duration-100 {isThresholdReached ? 'bg-white' : 'bg-blue-500'}"
					style="width: {pullProgress}%;"
				></div>
			</div>
		</div>
	</div>
{/if}

<!-- Visual feedback overlay when pulling -->
{#if isPulling && pullDistance > 5}
	<div
		class="pointer-events-none fixed inset-x-0 top-0 z-[9997] lg:hidden transition-opacity duration-150"
		style="height: {Math.min(pullDistance * 1.5, 150)}px; 
			   background: linear-gradient(to bottom, 
				   rgba(59, 130, 246, {0.15 * indicatorOpacity}), 
				   transparent);
			   opacity: {indicatorOpacity};"
	></div>
{/if}

<style>
	/* Smooth transitions */
	:global(.pull-refresh-transition) {
		transition: transform 0.2s ease-out, opacity 0.2s ease-out;
	}
</style>
