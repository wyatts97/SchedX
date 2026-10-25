<script lang="ts">
	import { Dialog } from 'bits-ui';
	import X from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import { cn, ignoreToastClicks } from '#lib/utils.js';

	let {
		open = $bindable(false),
		title,
		description,
		class: className,
		children,
		footer
	}: {
		open?: boolean;
		title: string;
		description?: string;
		class?: string;
		children?: Snippet;
		footer?: Snippet;
	} = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
		<Dialog.Content
			onInteractOutside={ignoreToastClicks}
			class={cn(
				'fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-panel border border-line bg-raised p-5 shadow-pop',
				'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-panel',
				className
			)}
		>
			<div class="mb-4 flex items-start justify-between gap-4">
				<div class="grid gap-1">
					<Dialog.Title class="text-lg font-semibold">{title}</Dialog.Title>
					{#if description}
						<Dialog.Description class="text-sm text-muted">{description}</Dialog.Description>
					{/if}
				</div>
				<Dialog.Close
					class="-m-1 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
					aria-label="Close"
				>
					<X class="size-5" />
				</Dialog.Close>
			</div>
			{@render children?.()}
			{#if footer}
				<div class="mt-5 flex flex-wrap justify-end gap-2">{@render footer()}</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
