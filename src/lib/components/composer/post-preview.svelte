<script lang="ts">
	import Avatar from '../avatar.svelte';
	import type { EditorItem } from './types.js';
	import { cn } from '#lib/utils.js';

	let {
		items,
		account
	}: {
		items: EditorItem[];
		account: { username: string; displayName: string; avatarUrl: string | null } | null;
	} = $props();

	const TOKEN = /(https?:\/\/[^\s]+|(?:^|\s)[@#][\w]+)/g;

	function parts(text: string) {
		const out: { t: string; link: boolean }[] = [];
		let last = 0;
		for (const m of text.matchAll(TOKEN)) {
			if (m.index! > last) out.push({ t: text.slice(last, m.index), link: false });
			out.push({ t: m[0], link: true });
			last = m.index! + m[0].length;
		}
		if (last < text.length) out.push({ t: text.slice(last), link: false });
		return out;
	}
</script>

<div class="grid">
	{#each items as item, i (item.key)}
		<article class="grid grid-cols-[auto_1fr] gap-x-3">
			<div class="flex flex-col items-center">
				<Avatar src={account?.avatarUrl} name={account?.username ?? 'you'} />
				{#if i < items.length - 1}<span class="mt-1 w-0.5 flex-1 bg-line"></span>{/if}
			</div>
			<div class="min-w-0 pb-5">
				<p class="flex gap-1.5 text-[0.9375rem]">
					<span class="truncate font-semibold">{account?.displayName ?? 'Your account'}</span>
					<span class="truncate text-muted">@{account?.username ?? 'handle'}</span>
				</p>
				{#if item.text}
					<p class="text-[0.9375rem] break-words whitespace-pre-wrap">
						{#each parts(item.text) as p, j (j)}{#if p.link}<span class="text-accent">{p.t}</span
								>{:else}{p.t}{/if}{/each}
					</p>
				{:else if !item.media.length}
					<p class="text-muted italic">Empty post</p>
				{/if}
				{#if item.media.length}
					<div
						class={cn(
							'mt-2 grid gap-0.5 overflow-hidden rounded-2xl border border-line',
							item.media.length > 1 && 'grid-cols-2'
						)}
					>
						{#each item.media as m, k (m.id + k)}
							<img
								src={m.thumbUrl}
								alt={m.alt}
								class={cn(
									'w-full object-cover',
									item.media.length === 1 ? 'max-h-80' : 'aspect-square',
									item.media.length === 3 && k === 0 && 'row-span-2 h-full'
								)}
							/>
						{/each}
					</div>
				{/if}
				{#if item.poll}
					<div class="mt-2 grid gap-1.5">
						{#each item.poll.options as o, k (k)}
							<span
								class="rounded-full border border-accent/50 px-3 py-1.5 text-center text-sm font-medium text-accent"
								>{o || `Choice ${k + 1}`}</span
							>
						{/each}
					</div>
				{/if}
			</div>
		</article>
	{/each}
</div>
