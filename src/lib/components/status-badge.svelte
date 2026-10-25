<script lang="ts">
	import { STATUS_LABELS, type PostStatus } from '#lib/shared/types.js';
	import { cn } from '#lib/utils.js';

	let { status, queued = false }: { status: PostStatus; queued?: boolean } = $props();

	const tone: Record<PostStatus, string> = {
		draft: 'bg-surface-2 text-muted',
		scheduled: 'bg-accent-soft text-accent',
		publishing: 'bg-accent-soft text-accent',
		published: 'bg-ok-soft text-ok',
		failed: 'bg-bad-soft text-bad',
		needs_verification: 'bg-warn-soft text-warn',
		paused: 'bg-warn-soft text-warn',
		missed: 'bg-warn-soft text-warn'
	};
</script>

<span
	class={cn(
		'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
		tone[status]
	)}
>
	{#if status === 'publishing'}
		<span class="size-1.5 animate-pulse rounded-full bg-current"></span>
	{/if}
	{status === 'scheduled' && queued ? 'Queued' : STATUS_LABELS[status]}
</span>
