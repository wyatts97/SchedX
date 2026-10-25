<script lang="ts">
	import { cn } from '#lib/utils.js';

	let { size = 40, class: className }: { size?: number; class?: string } = $props();
</script>

<!-- One image per theme, picked by CSS so it is correct on the server-rendered page. -->
<span
	class={cn(
		'logo inline-block shrink-0 logo-inhale transition-[width,height] duration-300',
		className
	)}
	style="width: {size}px; height: {size}px"
>
	<img src="/icons/app-icon-light.png" alt="SchedX" class="logo-light size-full rounded-xl" />
	<img src="/icons/app-icon-dark.png" alt="SchedX" class="logo-dark size-full rounded-xl" />
	<img src="/icons/app-icon-lightsout.png" alt="SchedX" class="logo-black size-full rounded-xl" />
</span>

<style>
	.logo img {
		display: none;
	}
	:global([data-theme='light']) .logo .logo-light,
	:global([data-theme='system']) .logo .logo-light,
	:global([data-theme='dark']) .logo .logo-dark,
	:global([data-theme='black']) .logo .logo-black {
		display: block;
	}
	@media (prefers-color-scheme: dark) {
		:global([data-theme='system']) .logo .logo-light {
			display: none;
		}
		:global([data-theme='system']) .logo .logo-dark {
			display: block;
		}
	}
</style>
