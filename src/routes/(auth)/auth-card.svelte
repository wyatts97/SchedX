<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, intro, children }: { title: string; intro: string; children: Snippet } = $props();
</script>

<main class="grid min-h-dvh place-items-center px-4 py-10">
	<div class="w-full max-w-sm">
		<div class="mb-8 flex items-center gap-3">
			<img src="/icons/icon-192.png" alt="" class="size-10 rounded-xl" />
			<span class="text-xl font-semibold tracking-tight">SchedX</span>
		</div>
		<h1 class="text-2xl font-semibold">{title}</h1>
		<p class="mt-1.5 mb-7 text-sm text-muted">{intro}</p>
		{@render children()}
	</div>
</main>
