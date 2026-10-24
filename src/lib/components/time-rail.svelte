<script lang="ts">
	import { onMount } from 'svelte';
	import Avatar from './avatar.svelte';
	import StatusBadge from './status-badge.svelte';
	import { formatTime, formatRelative, startOfLocalDay, DAY } from '#lib/shared/time.js';
	import { formatUsd } from '#lib/shared/cost.js';
	import type { PostView } from '#lib/shared/compose.js';

	let { posts, tz }: { posts: PostView[]; tz: string } = $props();

	let now = $state(Date.now());
	onMount(() => {
		const t = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(t);
	});

	function dayLabel(ms: number): string {
		const day = startOfLocalDay(ms, tz);
		const today = startOfLocalDay(now, tz);
		if (day === today) return 'Today';
		if (day - today <= DAY + 3_600_000 && day > today) return 'Tomorrow';
		return new Intl.DateTimeFormat(undefined, {
			timeZone: tz,
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		}).format(ms);
	}

	const groups = $derived.by(() => {
		const out: { label: string; posts: PostView[] }[] = [];
		for (const p of posts) {
			const label = dayLabel(p.scheduledAt ?? now);
			const last = out.at(-1);
			if (last?.label === label) last.posts.push(p);
			else out.push({ label, posts: [p] });
		}
		return out;
	});
</script>

<ol class="relative grid gap-6 pl-[4.75rem]" aria-label="Upcoming posts">
	<span class="absolute top-2 bottom-2 left-[4.25rem] w-px bg-rail" aria-hidden="true"></span>

	<li class="relative flex items-center gap-3 text-sm">
		<span class="absolute -left-[4.75rem] w-14 text-right font-semibold text-accent tnum"
			>{formatTime(now, tz)}</span
		>
		<span
			class="absolute -left-[0.8rem] size-2.5 rounded-full bg-accent ring-4 ring-accent-soft"
			aria-hidden="true"
		></span>
		<span class="font-medium text-accent">Now</span>
	</li>

	{#each groups as group (group.label)}
		<li class="grid gap-3">
			<h3 class="text-[0.8125rem] font-semibold text-muted">{group.label}</h3>
			<ol class="grid gap-3">
				{#each group.posts as post (post.id)}
					{@const first = post.items[0]}
					<li class="relative">
						<time
							class="absolute top-3.5 -left-[4.75rem] w-14 text-right text-sm font-semibold tnum"
							datetime={new Date(post.scheduledAt ?? now).toISOString()}
							title={formatRelative(post.scheduledAt ?? now, now)}
						>
							{formatTime(post.scheduledAt ?? now, tz)}
						</time>
						<span
							class="absolute top-[1.15rem] -left-[0.72rem] size-2 rounded-full border-2 border-rail bg-bg"
							aria-hidden="true"
						></span>
						<a
							href="/compose?edit={post.id}"
							class="block rounded-panel border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
						>
							<div class="mb-1.5 flex items-center gap-2 text-sm">
								<Avatar src={post.account.avatarUrl} name={post.account.username} size="sm" />
								<span class="truncate text-muted">@{post.account.username}</span>
								{#if post.status !== 'scheduled' || post.queued}<StatusBadge
										status={post.status}
										queued={post.queued}
									/>{/if}
								<span class="ml-auto text-[0.8125rem] text-muted tnum" title="Estimated cost"
									>{formatUsd(post.estCost)}</span
								>
							</div>
							<p class="line-clamp-2 text-[0.9375rem] break-words">
								{first?.text ||
									(first?.media.length
										? `${first.media.length} attachment${first.media.length > 1 ? 's' : ''}`
										: '')}
							</p>
							{#if post.items.length > 1}
								<p class="mt-1 text-[0.8125rem] text-muted">
									+ {post.items.length - 1} more in thread
								</p>
							{/if}
						</a>
					</li>
				{/each}
			</ol>
		</li>
	{/each}
</ol>
