<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Avatar from '../avatar.svelte';
	import type { AccountView } from '#lib/shared/compose.js';
	import { cn } from '#lib/utils.js';

	let {
		accounts,
		selected = $bindable([]),
		single = false
	}: { accounts: AccountView[]; selected?: string[]; single?: boolean } = $props();

	function toggle(id: string) {
		if (single) selected = [id];
		else selected = selected.includes(id) ? selected.filter((a) => a !== id) : [...selected, id];
	}
</script>

<!-- Legacy composer account picker: 48px avatars with a check badge and a name tooltip. -->
<div class="flex flex-wrap gap-3" role="group" aria-label="Post as">
	{#each accounts as a (a.id)}
		{@const on = selected.includes(a.id)}
		{@const blocked = a.status === 'needs_reauth'}
		<div class="group relative">
			<button
				type="button"
				onclick={() => toggle(a.id)}
				disabled={blocked}
				aria-pressed={on}
				aria-label="Post as @{a.username}"
				class="relative block rounded-full focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none disabled:opacity-40"
			>
				<Avatar
					src={a.avatarUrl}
					name={a.username}
					class={cn(
						'size-12 border-[3px] text-sm transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg',
						on ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-line'
					)}
				/>
				{#if on}
					<span
						class="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-blue-500 ring-2 ring-surface"
					>
						<Check class="size-3 text-white" strokeWidth={3} />
					</span>
				{/if}
			</button>
			<span
				role="tooltip"
				class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
			>
				{blocked ? `@${a.username} needs reconnecting` : `${a.displayName} · @${a.username}`}
				<span
					class="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-gray-900"
				></span>
			</span>
		</div>
	{/each}
</div>
