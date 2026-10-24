<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import MoonStar from '@lucide/svelte/icons/moon-star';
	import Monitor from '@lucide/svelte/icons/monitor';
	import Check from '@lucide/svelte/icons/check';
	import type { Theme } from '#lib/shared/types.js';

	let { theme = $bindable('system') }: { theme?: Theme } = $props();

	const options: { id: Theme; label: string; icon: typeof Sun }[] = [
		{ id: 'system', label: 'Match device', icon: Monitor },
		{ id: 'light', label: 'Light', icon: Sun },
		{ id: 'dark', label: 'Dim', icon: Moon },
		{ id: 'black', label: 'Lights out', icon: MoonStar }
	];
	const current = $derived(options.find((o) => o.id === theme) ?? options[0]);

	function set(next: Theme) {
		theme = next;
		document.documentElement.dataset.theme = next;
		document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class="inline-flex size-9 items-center justify-center rounded-ctl text-muted hover:bg-surface-2 hover:text-ink"
		aria-label="Theme: {current.label}"
	>
		<current.icon class="size-[1.125rem]" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			sideOffset={6}
			align="start"
			class="z-50 min-w-44 rounded-ctl border border-line bg-raised p-1 shadow-pop"
		>
			{#each options as o (o.id)}
				<DropdownMenu.Item
					onSelect={() => set(o.id)}
					class="flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none data-highlighted:bg-surface-2"
				>
					<o.icon class="size-4 opacity-80" />
					{o.label}
					{#if o.id === theme}<Check class="ml-auto size-4 text-accent" />{/if}
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
