<script lang="ts" module>
	/** A queue time nobody has taken yet. */
	export interface OpenSlot {
		accountId: string;
		at: number;
	}
</script>

<script lang="ts">
	import { Dialog } from 'bits-ui';
	import X from '@lucide/svelte/icons/x';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import Plus from '@lucide/svelte/icons/plus';
	import { Temporal } from 'temporal-polyfill';
	import PostCard from '#lib/components/post-card.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import { formatUsd } from '#lib/shared/cost.js';
	import { formatTime, fromLocal, zoned, MINUTE, HOUR } from '#lib/shared/time.js';
	import type { AccountView, PostView } from '#lib/shared/compose.js';
	import { cn, ignoreToastClicks } from '#lib/utils.js';

	let {
		open = $bindable(false),
		date,
		highlightId = null,
		posts,
		slots,
		accounts,
		tz
	}: {
		open?: boolean;
		/** Local calendar date, YYYY-MM-DD. */
		date: string | null;
		highlightId?: string | null;
		posts: PostView[];
		slots: OpenSlot[];
		accounts: AccountView[];
		tz: string;
	} = $props();

	const when = (p: PostView) => (p.status === 'published' ? p.publishedAt : p.scheduledAt);

	const bounds = $derived.by(() => {
		if (!date) return null;
		const next = Temporal.PlainDate.from(date).add({ days: 1 }).toString();
		return { start: fromLocal(date, 0, tz), end: fromLocal(next, 0, tz) };
	});

	const dayPosts = $derived(
		bounds
			? posts
					.filter((p) => {
						const t = when(p);
						return t !== null && t >= bounds.start && t < bounds.end;
					})
					.sort((a, b) => when(a)! - when(b)!)
			: []
	);
	const daySlots = $derived(
		bounds ? slots.filter((s) => s.at >= bounds.start && s.at < bounds.end) : []
	);
	const cost = $derived(dayPosts.reduce((sum, p) => sum + p.estCost, 0));
	const summary = $derived(
		dayPosts.length
			? `${dayPosts.length} post${dayPosts.length > 1 ? 's' : ''}` +
					(cost > 0 ? `, about ${formatUsd(cost)} in API fees` : '')
			: 'Nothing planned'
	);
	const usernames = $derived(new Map(accounts.map((a) => [a.id, a.username])));

	const heading = $derived.by(() => {
		if (!bounds) return '';
		const sameYear = zoned(bounds.start, tz).year === zoned(Date.now(), tz).year;
		return new Intl.DateTimeFormat(undefined, {
			timeZone: tz,
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: sameYear ? undefined : 'numeric'
		}).format(bounds.start);
	});

	/** Today: the next round hour (if it's still today). Later days: 9:00. Past days: none. */
	const newPostAt = $derived.by(() => {
		if (!bounds || !date) return null;
		const now = Date.now();
		if (bounds.end <= now) return null;
		if (bounds.start > now) return fromLocal(date, 9 * 60, tz);
		let next = zoned(now, tz).round({
			smallestUnit: 'hour',
			roundingMode: 'ceil'
		}).epochMilliseconds;
		if (next - now < 10 * MINUTE) next += HOUR;
		return next < bounds.end ? next : now + 10 * MINUTE;
	});

	// Bring the post that was clicked in the calendar into view once the sheet has opened.
	$effect(() => {
		if (!open || !highlightId) return;
		const id = `day-post-${highlightId}`;
		const raf = requestAnimationFrame(() =>
			document.getElementById(id)?.scrollIntoView({ block: 'nearest' })
		);
		return () => cancelAnimationFrame(raf);
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] lg:bg-black/25" />
		<!-- Bottom sheet on phones, a floating right-hand sheet (like the sidebar) on desktop. -->
		<Dialog.Content
			onInteractOutside={ignoreToastClicks}
			class={cn(
				'fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl border border-line/60 bg-raised pb-[env(safe-area-inset-bottom)] shadow-pop outline-none',
				'lg:inset-x-auto lg:top-4 lg:right-4 lg:bottom-4 lg:max-h-none lg:w-[28rem] lg:rounded-2xl lg:pb-0'
			)}
		>
			<div class="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line lg:hidden"></div>
			<header class="flex items-start justify-between gap-4 border-b border-line/60 px-5 pt-3 pb-4">
				<div class="grid gap-1">
					<Dialog.Title class="text-lg font-semibold">{heading}</Dialog.Title>
					<Dialog.Description class="text-sm text-muted">
						{summary}
					</Dialog.Description>
				</div>
				<Dialog.Close
					class="-m-1 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
					aria-label="Close"
				>
					<X class="size-5" />
				</Dialog.Close>
			</header>

			<div class="grid flex-1 content-start gap-5 overflow-y-auto overscroll-contain px-4 py-4">
				{#if newPostAt || daySlots.length}
					<div class="grid gap-3">
						{#if newPostAt}
							<Button
								href="/compose?at={newPostAt}"
								variant="primary"
								size="sm"
								class="justify-self-start"><PenLine />New post on this day</Button
							>
						{/if}
						{#if daySlots.length}
							<div class="grid gap-2">
								<h3 class="text-sm font-medium text-ink-2">Open queue times</h3>
								<ul class="flex flex-wrap gap-2">
									{#each daySlots as slot (slot.accountId + slot.at)}
										<li>
											<a
												href="/compose?at={slot.at}&account={slot.accountId}"
												class="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 py-1 text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent"
												title="Write a post for this queue time"
											>
												<Plus class="size-3.5" /><span class="tnum">{formatTime(slot.at, tz)}</span>
												{#if accounts.length > 1}
													<span class="text-muted">@{usernames.get(slot.accountId)}</span>
												{/if}
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				{/if}

				{#if dayPosts.length}
					<div class="grid gap-3">
						{#each dayPosts as post (post.id)}
							<div id="day-post-{post.id}" class="scroll-my-4">
								<PostCard
									{post}
									{tz}
									class={post.id === highlightId
										? 'border-accent ring-2 ring-accent/40'
										: undefined}
								/>
							</div>
						{/each}
					</div>
				{:else}
					<p
						class="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted"
					>
						{newPostAt ? 'Nothing is planned for this day yet.' : 'Nothing went out on this day.'}
					</p>
				{/if}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
