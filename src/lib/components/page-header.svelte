<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, description, actions }: { title: string; description?: string; actions?: Snippet } =
		$props();
</script>

<header class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div class="grid gap-1">
		<h1 class="text-[1.875rem] leading-9 font-bold text-ink">{title}</h1>
		{#if description}<p class="max-w-prose text-sm text-muted">{description}</p>{/if}
	</div>
	{#if actions}<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>{/if}
</header>
