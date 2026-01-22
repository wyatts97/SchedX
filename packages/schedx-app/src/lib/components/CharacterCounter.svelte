<script lang="ts">
	export let current: number = 0;
	export let max: number = 280;
	export let warningThreshold: number = 260;
	export let dangerThreshold: number = 280;

	$: percentage = Math.min((current / max) * 100, 100);
	$: remaining = max - current;
	$: isWarning = current >= warningThreshold && current < dangerThreshold;
	$: isDanger = current >= dangerThreshold;
	$: isOverLimit = current > max;

	// SVG circle calculations
	const size = 28;
	const strokeWidth = 2.5;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	$: dashOffset = circumference - (percentage / 100) * circumference;

	// Colors based on state
	$: strokeColor = isOverLimit 
		? '#ef4444' // red-500
		: isDanger 
			? '#f59e0b' // amber-500
			: isWarning 
				? '#eab308' // yellow-500
				: '#3b82f6'; // blue-500

	$: textColor = isOverLimit 
		? 'text-red-500' 
		: isDanger 
			? 'text-amber-500' 
			: isWarning 
				? 'text-yellow-600 dark:text-yellow-400' 
				: 'text-gray-500 dark:text-gray-400';
</script>

<div class="flex items-center gap-2">
	<!-- Circular progress indicator -->
	<div class="relative" style="width: {size}px; height: {size}px;">
		<svg
			class="transform -rotate-90"
			width={size}
			height={size}
			viewBox="0 0 {size} {size}"
		>
			<!-- Background circle -->
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke="currentColor"
				stroke-width={strokeWidth}
				class="text-gray-200 dark:text-gray-700"
			/>
			<!-- Progress circle -->
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke={strokeColor}
				stroke-width={strokeWidth}
				stroke-linecap="round"
				stroke-dasharray={circumference}
				stroke-dashoffset={dashOffset}
				class="transition-all duration-150 ease-out"
			/>
		</svg>
		
		<!-- Show remaining count when near limit -->
		{#if current >= warningThreshold - 20}
			<span 
				class="absolute inset-0 flex items-center justify-center text-[9px] font-semibold {textColor}"
			>
				{remaining}
			</span>
		{/if}
	</div>

	<!-- Text counter (shown when not near limit) -->
	{#if current < warningThreshold - 20}
		<span class="text-sm {textColor}">
			{current}/{max}
		</span>
	{/if}
</div>
