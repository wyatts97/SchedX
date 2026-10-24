<script lang="ts">
	import { untrack } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Plus from '@lucide/svelte/icons/plus';
	import Eye from '@lucide/svelte/icons/eye';
	import Check from '@lucide/svelte/icons/check';
	import ItemEditor from './item-editor.svelte';
	import MediaPicker from './media-picker.svelte';
	import PostPreview from './post-preview.svelte';
	import Avatar from '../avatar.svelte';
	import Button from '../ui/button.svelte';
	import Select from '../ui/select.svelte';
	import Switch from '../ui/switch.svelte';
	import { newItem, type EditorItem } from './types.js';
	import { estimateCost, formatUsd } from '#lib/shared/cost.js';
	import { textStats } from '#lib/shared/text.js';
	import { fromLocalInput, toLocalInput, zoned, HOUR, formatDateTime } from '#lib/shared/time.js';
	import type { ComposeAction, ComposeInput, PostView } from '#lib/shared/compose.js';
	import type { PostOptions, Rates, RecurFreq, ReplySettings } from '#lib/shared/types.js';
	import type { AccountView } from '#lib/shared/compose.js';
	import { api, cn } from '#lib/utils.js';

	let {
		accounts,
		tz,
		rates,
		initial = null,
		prefill = {}
	}: {
		accounts: AccountView[];
		tz: string;
		rates: Rates;
		initial?: PostView | null;
		prefill?: { text?: string; at?: number; accountId?: string };
	} = $props();

	// ---- state (seeded once from props; the page re-keys this component per post) ----
	const boot = untrack(() => ({ initial, accounts, prefill, tz }));
	const seed = boot.initial;
	const defaultAccount = boot.accounts.find((a) => a.isDefault) ?? boot.accounts[0];
	let accountIds = $state<string[]>(
		seed
			? [seed.accountId]
			: boot.prefill.accountId
				? [boot.prefill.accountId]
				: defaultAccount
					? [defaultAccount.id]
					: []
	);
	let items = $state<EditorItem[]>(
		seed
			? seed.items.map((i) => ({
					key: crypto.randomUUID(),
					text: i.text,
					media: i.media.map((m) => ({ ...m, alt: m.attachedAlt })),
					poll: i.poll
						? { options: [...i.poll.options], durationMinutes: i.poll.durationMinutes }
						: null,
					uploads: []
				}))
			: [newItem(boot.prefill.text ?? '')]
	);
	let options = $state<PostOptions>({ ...(seed?.options ?? {}) });
	let replySetting = $state<string>(seed?.options.replySettings ?? 'everyone');
	let action = $state<ComposeAction>(
		seed
			? seed.status === 'draft'
				? 'draft'
				: seed.queued
					? 'queue'
					: 'schedule'
			: boot.prefill.at
				? 'schedule'
				: 'now'
	);
	const initialAt =
		seed?.scheduledAt && seed.scheduledAt > Date.now()
			? seed.scheduledAt
			: (boot.prefill.at ?? Date.now() + HOUR);
	let when = $state(toLocalInput(initialAt, boot.tz));
	let repeat = $state<string>(seed?.recurFreq ?? 'none');
	let repeatEvery = $state(seed?.recurInterval ?? 1);
	let repeatUntil = $state(
		seed?.recurUntil ? toLocalInput(seed.recurUntil, boot.tz).slice(0, 10) : ''
	);

	let pickerOpen = $state(false);
	let pickerTarget = $state(0);
	let editors: ItemEditor[] = $state([]);
	let busy = $state(false);
	let dirty = $state(false);
	let showPreview = $state(false);
	let focusKey = $state<string | null>(null);

	$effect(() => {
		// any edit marks the form dirty (read deeply so the effect tracks everything)
		JSON.stringify(items);
		JSON.stringify(options);
		void [accountIds.length, when, action, replySetting, repeat];
		return () => (dirty = true);
	});

	beforeNavigate((nav) => {
		if (
			dirty &&
			!busy &&
			nav.type !== 'form' &&
			!confirm('Discard this post? Your changes will be lost.')
		) {
			nav.cancel();
		}
	});

	// ---- derived ----
	const selectedAccounts = $derived(accounts.filter((a) => accountIds.includes(a.id)));
	const premium = $derived(selectedAccounts.length > 0 && selectedAccounts.every((a) => a.premium));
	const cost = $derived(
		estimateCost(
			items.map((i) => ({
				text: i.text,
				media: i.media.map((m) => ({ kind: m.kind, altText: m.alt }))
			})),
			rates
		)
	);
	const totalCost = $derived(cost.total * Math.max(1, accountIds.length));
	const scheduledAt = $derived(fromLocalInput(when, tz));
	const overLimit = $derived(items.some((i) => textStats(i.text, premium).over));
	const uploading = $derived(items.some((i) => i.uploads.length > 0));
	const missingAlt = $derived(
		items.reduce((n, i) => n + i.media.filter((m) => m.kind !== 'video' && !m.alt.trim()).length, 0)
	);
	const empty = $derived(items.every((i) => !i.text.trim() && !i.media.length));
	const canSubmit = $derived(!busy && !uploading && !overLimit && !empty && accountIds.length > 0);

	const ACTIONS: { id: ComposeAction; label: string; submit: string }[] = [
		{ id: 'now', label: 'Now', submit: 'Post now' },
		{ id: 'schedule', label: 'Schedule', submit: 'Schedule' },
		{ id: 'queue', label: 'Queue', submit: 'Add to queue' },
		{ id: 'draft', label: 'Draft', submit: 'Save draft' }
	];
	const submitLabel = $derived(
		items.length > 1
			? {
					now: 'Post thread now',
					schedule: 'Schedule thread',
					queue: 'Add thread to queue',
					draft: 'Save draft'
				}[action]
			: (ACTIONS.find((a) => a.id === action)?.submit ?? 'Save')
	);

	const REPLY: { value: ReplySettings; label: string }[] = [
		{ value: 'everyone', label: 'Everyone can reply' },
		{ value: 'following', label: 'Accounts you follow' },
		{ value: 'mentionedUsers', label: 'Only accounts you mention' },
		{ value: 'verified', label: 'Verified accounts' },
		{ value: 'subscribers', label: 'Your subscribers' }
	];

	function toggleAccount(id: string) {
		if (seed) {
			accountIds = [id];
			return;
		}
		accountIds = accountIds.includes(id) ? accountIds.filter((a) => a !== id) : [...accountIds, id];
	}

	function addItem() {
		const item = newItem();
		items.push(item);
		focusKey = item.key;
	}

	function preset(kind: 'hour' | 'evening' | 'morning') {
		const now = zoned(Date.now(), tz);
		let target = now
			.add({ hours: 1 })
			.round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'ceil' });
		if (kind === 'evening') {
			target = now.with({ hour: 19, minute: 0, second: 0, millisecond: 0 });
			if (target.epochMilliseconds <= Date.now()) target = target.add({ days: 1 });
		}
		if (kind === 'morning')
			target = now.add({ days: 1 }).with({ hour: 9, minute: 0, second: 0, millisecond: 0 });
		when = toLocalInput(target.epochMilliseconds, tz);
		action = 'schedule';
	}

	async function submit() {
		if (!canSubmit) return;
		if (
			missingAlt &&
			action !== 'draft' &&
			!confirm(
				`${missingAlt} image${missingAlt > 1 ? 's have' : ' has'} no description. Post anyway?`
			)
		)
			return;
		const input: ComposeInput = {
			id: seed?.id,
			accountIds,
			items: items.map((i, idx) => ({
				text: i.text,
				media: i.media.map((m) => ({ id: m.id, altText: m.alt })),
				poll:
					idx === 0 && i.poll
						? {
								options: i.poll.options.map((o) => o.trim()),
								durationMinutes: i.poll.durationMinutes
							}
						: null
			})),
			options: {
				...options,
				replySettings: replySetting as ReplySettings,
				communityId: options.communityId?.trim() || undefined
			},
			action,
			scheduledAt: action === 'schedule' || action === 'draft' ? scheduledAt : null,
			recurrence:
				repeat !== 'none' && (action === 'schedule' || action === 'queue')
					? {
							freq: repeat as RecurFreq,
							interval: repeatEvery,
							until: repeatUntil ? fromLocalInput(`${repeatUntil}T23:59`, tz) : null
						}
					: null
		};
		busy = true;
		try {
			const res = await api<{ ids: string[]; scheduledAt: number | null }>('/api/compose', input);
			dirty = false;
			const n = accountIds.length > 1 ? ` for ${accountIds.length} accounts` : '';
			const msg = {
				now: `Publishing${n}`,
				schedule: `Scheduled for ${formatDateTime(scheduledAt ?? Date.now(), tz)}${n}`,
				queue: `Queued for ${res.scheduledAt ? formatDateTime(res.scheduledAt, tz) : 'the next slot'}${n}`,
				draft: 'Draft saved'
			}[action];
			toast.success(msg);
			await goto(action === 'draft' ? '/drafts' : action === 'queue' ? '/queue' : '/');
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			busy = false;
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			submit();
		}
	}
</script>

<svelte:window {onkeydown} />

<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
	<section class="min-w-0" aria-label="Post content">
		<!-- Accounts -->
		{#if accounts.length > 1 || !seed}
			<div class="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Post as">
				{#each accounts as a (a.id)}
					{@const on = accountIds.includes(a.id)}
					<button
						type="button"
						onclick={() => toggleAccount(a.id)}
						aria-pressed={on}
						disabled={a.status === 'needs_reauth'}
						class={cn(
							'flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors disabled:opacity-50',
							on
								? 'border-accent bg-accent-soft text-ink'
								: 'border-line text-muted hover:border-line-strong'
						)}
						title={a.status === 'needs_reauth' ? 'Reconnect this account first' : undefined}
					>
						<Avatar src={a.avatarUrl} name={a.username} size="sm" />
						@{a.username}
						{#if on}<Check class="size-3.5 text-accent" />{/if}
					</button>
				{/each}
				{#if accountIds.length > 1}
					<span class="text-xs text-muted">Posts once to each selected account</span>
				{/if}
			</div>
		{/if}

		<div class="rounded-panel border border-line bg-surface px-4 pt-4 sm:px-5">
			{#each items as item, i (item.key)}
				<ItemEditor
					bind:this={editors[i]}
					bind:item={items[i]}
					index={i}
					total={items.length}
					{premium}
					autofocus={i === 0 ? !seed : item.key === focusKey}
					onremove={() => items.splice(i, 1)}
					onlibrary={() => {
						pickerTarget = i;
						pickerOpen = true;
					}}
				/>
			{/each}
			<button
				type="button"
				onclick={addItem}
				disabled={items.length >= 25}
				class="-mx-1 mb-3 flex items-center gap-2 rounded-md px-1 py-1.5 text-sm font-medium text-accent hover:underline disabled:opacity-50"
			>
				<Plus class="size-4" />Add another post
			</button>
		</div>

		<button
			type="button"
			class="mt-4 flex items-center gap-2 text-sm text-muted hover:text-ink lg:hidden"
			onclick={() => (showPreview = !showPreview)}
			aria-expanded={showPreview}
		>
			<Eye class="size-4" />{showPreview ? 'Hide preview' : 'Show preview'}
		</button>
		<div class={cn('mt-6', !showPreview && 'hidden lg:block')}>
			<h2 class="mb-3 text-sm font-semibold text-muted">Preview</h2>
			<div class="rounded-panel border border-line bg-surface p-4 sm:p-5">
				<PostPreview {items} account={selectedAccounts[0] ?? null} />
			</div>
		</div>
	</section>

	<aside class="grid content-start gap-6 lg:sticky lg:top-8">
		<section class="grid gap-3" aria-labelledby="when-h">
			<h2 id="when-h" class="text-sm font-semibold">When</h2>
			<div
				class="grid grid-cols-4 rounded-ctl border border-line bg-surface p-0.5"
				role="radiogroup"
				aria-label="When to post"
			>
				{#each ACTIONS as a (a.id)}
					<button
						type="button"
						role="radio"
						aria-checked={action === a.id}
						onclick={() => (action = a.id)}
						class={cn(
							'rounded-[0.5rem] py-1.5 text-sm',
							action === a.id
								? 'bg-accent-soft font-semibold text-ink'
								: 'text-muted hover:text-ink'
						)}
					>
						{a.label}
					</button>
				{/each}
			</div>

			{#if action === 'schedule'}
				<input
					type="datetime-local"
					bind:value={when}
					aria-label="Date and time"
					class="h-10 w-full rounded-ctl border border-line bg-surface px-3 text-sm tnum outline-none focus:border-accent"
				/>
				<div class="flex flex-wrap gap-1.5 text-xs">
					<button
						type="button"
						class="rounded-full border border-line px-2.5 py-1 hover:border-line-strong"
						onclick={() => preset('hour')}>In an hour</button
					>
					<button
						type="button"
						class="rounded-full border border-line px-2.5 py-1 hover:border-line-strong"
						onclick={() => preset('evening')}>This evening</button
					>
					<button
						type="button"
						class="rounded-full border border-line px-2.5 py-1 hover:border-line-strong"
						onclick={() => preset('morning')}>Tomorrow morning</button
					>
				</div>
				<p class="text-xs text-muted">Times are in {tz}.</p>
			{:else if action === 'queue'}
				<p class="text-sm text-muted">
					Goes out in the next free time slot. <a href="/queue" class="text-accent hover:underline"
						>Edit queue times</a
					>
				</p>
			{:else if action === 'now'}
				<p class="text-sm text-muted">Publishes within a few seconds.</p>
			{:else}
				<p class="text-sm text-muted">Saved without a time. Schedule it whenever you're ready.</p>
			{/if}

			{#if action === 'schedule' || action === 'queue'}
				<div class="grid grid-cols-[1fr_auto] items-center gap-2">
					<Select
						bind:value={repeat}
						items={[
							{ value: 'none', label: "Doesn't repeat" },
							{ value: 'daily', label: 'Repeats daily' },
							{ value: 'weekly', label: 'Repeats weekly' },
							{ value: 'monthly', label: 'Repeats monthly' }
						]}
					/>
					{#if repeat !== 'none'}
						<label class="flex items-center gap-1.5 text-sm text-muted">
							every
							<input
								type="number"
								min="1"
								max="30"
								bind:value={repeatEvery}
								class="h-10 w-14 rounded-ctl border border-line bg-surface px-2 text-ink tnum"
							/>
						</label>
					{/if}
				</div>
				{#if repeat !== 'none'}
					<label class="grid gap-1 text-sm text-muted">
						Stop after (optional)
						<input
							type="date"
							bind:value={repeatUntil}
							class="h-10 rounded-ctl border border-line bg-surface px-3 text-ink"
						/>
					</label>
				{/if}
			{/if}
		</section>

		<details class="group grid gap-3">
			<summary class="cursor-pointer list-none text-sm font-semibold marker:hidden">
				Post settings <span class="font-normal text-muted"
					>· {REPLY.find((r) => r.value === replySetting)?.label}</span
				>
			</summary>
			<div class="mt-3 grid gap-4">
				<label class="grid gap-1.5 text-sm">
					Who can reply
					<Select bind:value={replySetting} items={REPLY} />
				</label>
				<label class="grid gap-1.5 text-sm">
					Community ID
					<input
						bind:value={options.communityId}
						inputmode="numeric"
						placeholder="Optional"
						class="h-10 rounded-ctl border border-line bg-surface px-3 outline-none focus:border-accent"
					/>
					<span class="text-xs text-muted"
						>The number at the end of the community's URL on x.com.</span
					>
				</label>
				{#if options.communityId}
					<label class="flex items-center justify-between gap-3 text-sm"
						>Also share with followers <Switch bind:checked={options.shareWithFollowers} /></label
					>
				{/if}
				<label class="flex items-center justify-between gap-3 text-sm"
					>Made with AI <Switch bind:checked={options.madeWithAi} /></label
				>
				<label class="flex items-center justify-between gap-3 text-sm"
					>Paid partnership <Switch bind:checked={options.paidPartnership} /></label
				>
			</div>
		</details>

		<section class="grid gap-1 border-t border-line pt-4" aria-labelledby="cost-h">
			<div class="flex items-baseline justify-between">
				<h2 id="cost-h" class="text-sm font-semibold">Estimated cost</h2>
				<span class="text-lg font-semibold tnum">{formatUsd(totalCost)}</span>
			</div>
			<p class="text-xs text-muted">
				{cost.posts + cost.postsWithUrl} post{cost.posts + cost.postsWithUrl > 1 ? 's' : ''}
				{#if cost.postsWithUrl}· {cost.postsWithUrl} at the link rate ({formatUsd(
						rates.postWithUrl
					)}){/if}
				{#if cost.altTexts}· {cost.altTexts} alt text{/if}
				{#if accountIds.length > 1}· × {accountIds.length} accounts{/if}
			</p>
		</section>

		<div
			class="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0"
		>
			<Button variant="primary" size="lg" class="w-full" disabled={!canSubmit} onclick={submit}>
				{busy ? 'Saving…' : uploading ? 'Uploading…' : submitLabel}
			</Button>
			<p class="mt-2 hidden text-center text-xs text-muted md:block">Ctrl + Enter</p>
		</div>
	</aside>
</div>

<MediaPicker
	bind:open={pickerOpen}
	existing={items[pickerTarget]?.media.map((m) => m.kind) ?? []}
	onpick={(list) => editors[pickerTarget]?.addMedia(list)}
/>
