<script lang="ts" module>
	export interface MenuItem {
		label: string;
		onselect: () => void;
		danger?: boolean;
		disabled?: boolean;
		icon?: import('svelte').Component<{ class?: string }>;
	}
</script>

<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import { cn } from '#lib/utils.js';

	let { items, label = 'More actions' }: { items: (MenuItem | 'separator')[]; label?: string } =
		$props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink data-[state=open]:bg-surface-2"
		aria-label={label}
	>
		<Ellipsis class="size-4" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			align="end"
			sideOffset={4}
			class="z-50 min-w-44 rounded-ctl border border-line bg-raised p-1 shadow-pop"
		>
			{#each items as item, i (i)}
				{#if item === 'separator'}
					<DropdownMenu.Separator class="my-1 h-px bg-line" />
				{:else}
					<DropdownMenu.Item
						disabled={item.disabled}
						onSelect={item.onselect}
						class={cn(
							'flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none data-disabled:opacity-50 data-highlighted:bg-surface-2',
							item.danger && 'text-bad'
						)}
					>
						{#if item.icon}<item.icon class="size-4 opacity-80" />{/if}
						{item.label}
					</DropdownMenu.Item>
				{/if}
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
