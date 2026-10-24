<script lang="ts">
	import { Select } from 'bits-ui';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { cn } from '#lib/utils.js';

	let {
		value = $bindable(''),
		items,
		name,
		id,
		placeholder = 'Choose…',
		class: className,
		onchange
	}: {
		value?: string;
		items: { value: string; label: string }[];
		name?: string;
		id?: string;
		placeholder?: string;
		class?: string;
		onchange?: (value: string) => void;
	} = $props();

	const selected = $derived(items.find((i) => i.value === value));
</script>

<Select.Root type="single" bind:value {name} {items} onValueChange={(v) => onchange?.(v)}>
	<Select.Trigger
		{id}
		class={cn(
			'flex h-10 w-full items-center justify-between gap-2 rounded-ctl border border-line bg-surface px-3 text-left text-sm',
			'hover:border-line-strong data-[state=open]:border-accent',
			className
		)}
	>
		<span class={cn('truncate', !selected && 'text-muted')}>{selected?.label ?? placeholder}</span>
		<ChevronDown class="size-4 shrink-0 text-muted" />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			sideOffset={6}
			class="z-50 max-h-72 min-w-(--bits-select-anchor-width) overflow-hidden rounded-ctl border border-line bg-raised p-1 shadow-pop"
		>
			<Select.Viewport>
				{#each items as item (item.value)}
					<Select.Item
						value={item.value}
						label={item.label}
						class="flex cursor-default items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm outline-none data-highlighted:bg-surface-2"
					>
						{#snippet children({ selected })}
							<span class="truncate">{item.label}</span>
							{#if selected}<Check class="size-4 text-accent" />{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
