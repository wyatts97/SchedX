<script lang="ts">
	import { onMount } from 'svelte';
	import PostCard from './post-card.svelte';
	import { formatTime, formatRelative, startOfLocalDay, DAY } from '#lib/shared/time.js';
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

<ol class="relative grid gap-6 pl-[5.75rem]" aria-label="Upcoming posts">
	<span class="absolute top-2 bottom-2 left-[5.25rem] w-px bg-rail" aria-hidden="true"></span>

	<li class="relative flex items-center gap-3 text-sm">
		<span
			class="absolute -left-[5.75rem] w-[4.75rem] text-right font-semibold whitespace-nowrap text-accent tnum"
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
					<li class="relative">
						<time
							class="absolute top-3.5 -left-[5.75rem] w-[4.75rem] text-right text-sm font-semibold whitespace-nowrap tnum"
							datetime={new Date(post.scheduledAt ?? now).toISOString()}
							title={formatRelative(post.scheduledAt ?? now, now)}
						>
							{formatTime(post.scheduledAt ?? now, tz)}
						</time>
						<span
							class="absolute top-[1.15rem] -left-[0.72rem] size-2 rounded-full border-2 border-rail bg-bg"
							aria-hidden="true"
						></span>
						<PostCard {post} {tz} />
					</li>
				{/each}
			</ol>
		</li>
	{/each}
</ol>
