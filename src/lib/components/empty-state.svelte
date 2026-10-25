<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, body, children }: { title: string; body?: string; children?: Snippet } = $props();
</script>

<div
	class="grid justify-items-start gap-2 rounded-panel border border-dashed border-line-strong px-5 py-8"
>
	<p class="font-medium">{title}</p>
	{#if body}<p class="max-w-prose text-sm text-muted">{body}</p>{/if}
	{#if children}<div class="mt-2 flex flex-wrap gap-2">{@render children()}</div>{/if}
</div>
