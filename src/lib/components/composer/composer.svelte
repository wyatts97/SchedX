<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { DropdownMenu } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import Plus from '@lucide/svelte/icons/plus';
	import Eye from '@lucide/svelte/icons/eye';
	import Send from '@lucide/svelte/icons/send';
	import Calendar from '@lucide/svelte/icons/calendar';
	import ListPlus from '@lucide/svelte/icons/list-plus';
	import Save from '@lucide/svelte/icons/save';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Loader from '@lucide/svelte/icons/loader-circle';
	import ItemEditor from './item-editor.svelte';
	import MediaPicker from './media-picker.svelte';
	import PostPreview from './post-preview.svelte';
	import AccountPicker from './account-picker.svelte';
	import ScheduleFields from './schedule-fields.svelte';
	import Select from '../ui/select.svelte';
	import Switch from '../ui/switch.svelte';
	import { newItem, type EditorItem } from './types.js';
	import { blockStrayDrops, fileDrop } from '#lib/actions/file-drop.js';
	import { estimateCost, formatUsd } from '#lib/shared/cost.js';
	import { textStats } from '#lib/shared/text.js';
	import { fromLocalInput, toLocalInput, formatDateTime } from '#lib/shared/time.js';
	import type { AccountView, ComposeAction, ComposeInput, PostView } from '#lib/shared/compose.js';
	import type { PostOptions, Rates, RecurFreq, ReplySettings } from '#lib/shared/types.js';
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
	const seedAt =
		seed && !seed.queued && seed.scheduledAt && seed.scheduledAt > Date.now()
			? seed.scheduledAt
			: (boot.prefill.at ?? null);
	/** '' means "no time picked": the primary button posts right away. */
	let when = $state(seedAt ? toLocalInput(seedAt, boot.tz) : '');
	/** Editing a queued post keeps it in the queue until a specific time is picked. */
	let queueMode = $state(!!seed?.queued);
	let repeat = $state<string>(seed?.recurFreq ?? 'none');
	let repeatEvery = $state(seed?.recurInterval ?? 1);
	let repeatUntil = $state(
		seed?.recurUntil ? toLocalInput(seed.recurUntil, boot.tz).slice(0, 10) : ''
	);

	let pickerOpen = $state(false);
	let pickerTarget = $state(0);
	let focusIndex = $state(0);
	let editors: ItemEditor[] = $state([]);
	let busy = $state(false);
	let dirty = $state(false);
	let showPreview = $state(false);
	let focusKey = $state<string | null>(null);
	let cardDragOver = $state(false);

	$effect(() => {
		// any edit marks the form dirty (read deeply so the effect tracks everything)
		JSON.stringify(items);
		JSON.stringify(options);
		void [accountIds.length, when, replySetting, repeat, queueMode];
		return () => (dirty = true);
	});

	beforeNavigate((nav) => {
		if (dirty && !busy && !confirm('Discard this post? Your changes will be lost.')) nav.cancel();
	});

	onMount(() => blockStrayDrops());

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
	const scheduledAt = $derived(when ? fromLocalInput(when, tz) : null);
	const overLimit = $derived(items.some((i) => textStats(i.text, premium).over));
	const uploading = $derived(items.some((i) => i.uploads.length > 0));
	const missingAlt = $derived(
		items.reduce((n, i) => n + i.media.filter((m) => m.kind !== 'video' && !m.alt.trim()).length, 0)
	);
	const empty = $derived(items.every((i) => !i.text.trim() && !i.media.length));
	const canSubmit = $derived(!busy && !uploading && !overLimit && !empty && accountIds.length > 0);
	const thread = $derived(items.length > 1);

	const primary = $derived<ComposeAction>(queueMode ? 'queue' : scheduledAt ? 'schedule' : 'now');
	const LABELS = $derived<Record<ComposeAction, string>>({
		now: thread ? 'Post thread now' : 'Post now',
		schedule:
			seed?.status === 'scheduled' ? 'Update schedule' : thread ? 'Schedule thread' : 'Schedule',
		queue: seed?.queued ? 'Update queue' : thread ? 'Add thread to queue' : 'Add to queue',
		draft: 'Save draft'
	});
	const MORE = $derived(
		(
			[
				{ id: 'now', icon: Send, tone: 'green', hint: 'Publish within seconds' },
				{ id: 'schedule', icon: Calendar, tone: 'blue', hint: 'At the time you picked' },
				{ id: 'queue', icon: ListPlus, tone: 'orange', hint: 'Next free queue time' },
				{ id: 'draft', icon: Save, tone: 'purple', hint: 'Keep it for later' }
			] as const
		).filter((a) => a.id !== primary && (a.id !== 'schedule' || scheduledAt))
	);
	const TONES = {
		green: 'bg-green-500/15 text-green-600 dark:text-green-400',
		blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
		orange: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
		purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
	};

	const REPLY: { value: ReplySettings; label: string }[] = [
		{ value: 'everyone', label: 'Everyone can reply' },
		{ value: 'following', label: 'Accounts you follow' },
		{ value: 'mentionedUsers', label: 'Only accounts you mention' },
		{ value: 'verified', label: 'Verified accounts' },
		{ value: 'subscribers', label: 'Your subscribers' }
	];

	function addItem() {
		const item = newItem();
		items.push(item);
		focusKey = item.key;
	}

	async function submit(action: ComposeAction) {
		if (!canSubmit) return;
		if (action === 'schedule' && !scheduledAt)
			return void toast.error('Pick a date and time first.');
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
			submit(primary);
		}
	}
</script>

<svelte:window {onkeydown} />

<div class="flex w-full flex-col gap-8 md:flex-row md:items-start">
	<!-- Composer card (legacy /post) -->
	<section
		class="relative w-full min-w-0 rounded-lg border border-line bg-surface p-4 shadow-sm sm:p-6 md:flex-1"
		aria-label="Post content"
		use:fileDrop={{
			ondrop: (files) => editors[Math.min(focusIndex, items.length - 1)]?.addFiles(files),
			onover: (v) => (cardDragOver = v)
		}}
	>
		{#if accounts.length > 1 || !seed}
			<div class="mb-6">
				<p class="mb-3 text-sm font-medium">
					Post as
					{#if accountIds.length > 1}
						<span class="font-normal text-muted">· once to each selected account</span>
					{/if}
				</p>
				<AccountPicker {accounts} bind:selected={accountIds} single={!!seed} />
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-5">
			{#each items as item, i (item.key)}
				<ItemEditor
					bind:this={editors[i]}
					bind:item={items[i]}
					index={i}
					total={items.length}
					{premium}
					autofocus={i === 0 ? !seed : item.key === focusKey}
					onfocus={() => (focusIndex = i)}
					onremove={() => items.splice(i, 1)}
					onlibrary={() => {
						pickerTarget = i;
						pickerOpen = true;
					}}
				/>
			{/each}
		</div>

		<button
			type="button"
			onclick={addItem}
			disabled={items.length >= 25}
			class="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-strong bg-surface-2/60 px-4 py-3 text-sm font-medium text-ink-2 transition-all duration-200 hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-600 disabled:opacity-50 dark:hover:text-blue-400"
		>
			<Plus class="size-4" />Add another post to the thread
		</button>

		<div class="mt-6 border-t border-line pt-6">
			<ScheduleFields
				bind:when
				bind:repeat
				bind:repeatEvery
				bind:repeatUntil
				{tz}
				onpick={() => (queueMode = false)}
			/>
		</div>

		<details class="group mt-6 rounded-lg border border-line">
			<summary
				class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium marker:hidden"
			>
				<span>
					Post settings
					<span class="font-normal text-muted">
						· {REPLY.find((r) => r.value === replySetting)?.label}
					</span>
				</span>
				<ChevronDown class="size-4 text-muted transition-transform group-open:rotate-180" />
			</summary>
			<div class="grid gap-4 border-t border-line px-4 py-4">
				<label class="grid gap-1.5 text-sm" for="reply-select">
					Who can reply
					<Select id="reply-select" bind:value={replySetting} items={REPLY} />
				</label>
				<label class="grid gap-1.5 text-sm">
					Community ID
					<input
						bind:value={options.communityId}
						inputmode="numeric"
						placeholder="Optional"
						class="h-10 rounded-lg border border-line bg-surface px-3 outline-none focus:border-blue-500"
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

		<div class="mt-6 flex items-baseline justify-between gap-3 text-sm">
			<p class="text-muted">
				Estimated cost:
				{cost.posts + cost.postsWithUrl} post{cost.posts + cost.postsWithUrl > 1 ? 's' : ''}
				{#if cost.postsWithUrl}· {cost.postsWithUrl} at the link rate{/if}
				{#if cost.altTexts}· {cost.altTexts} image description{cost.altTexts > 1 ? 's' : ''}{/if}
				{#if accountIds.length > 1}· × {accountIds.length} accounts{/if}
			</p>
			<span class="text-lg font-semibold tnum">{formatUsd(totalCost)}</span>
		</div>

		<div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
			<button
				type="button"
				disabled={!canSubmit}
				onclick={() => submit(primary)}
				class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-primary-hover hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if busy}
					<Loader class="size-5 animate-spin" />Saving…
				{:else if uploading}
					<Loader class="size-5 animate-spin" />Uploading…
				{:else}
					{#if primary === 'schedule'}<Calendar
							class="size-5"
						/>{:else if primary === 'queue'}<ListPlus class="size-5" />{:else}<Send
							class="size-5"
						/>{/if}
					{LABELS[primary]}
				{/if}
			</button>

			<DropdownMenu.Root>
				<DropdownMenu.Trigger
					disabled={!canSubmit}
					class="group inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-line-strong bg-surface px-4 py-3 text-sm font-medium text-ink-2 shadow-sm transition-colors hover:bg-surface-2 disabled:opacity-50 sm:w-auto"
				>
					More actions
					<ChevronDown class="size-4 transition-transform group-data-[state=open]:rotate-180" />
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content
						align="end"
						sideOffset={8}
						class="z-50 w-60 animate-[pop-in_0.15s_ease-out] rounded-xl border border-line bg-raised p-1 shadow-pop"
					>
						{#each MORE as a (a.id)}
							<DropdownMenu.Item
								onSelect={() => submit(a.id)}
								class="flex cursor-default items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-highlighted:bg-surface-2"
							>
								<span
									class={cn(
										'flex size-8 shrink-0 items-center justify-center rounded-lg',
										TONES[a.tone]
									)}
								>
									<a.icon class="size-4" />
								</span>
								<span class="grid">
									<span class="font-medium text-ink">{LABELS[a.id]}</span>
									<span class="text-xs text-muted">{a.hint}</span>
								</span>
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		</div>
		<p class="mt-2 hidden text-xs text-muted sm:block">
			Ctrl + Enter to {LABELS[primary].toLowerCase()}
		</p>

		{#if cardDragOver}
			<div
				class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-500 bg-blue-500/5 text-sm font-semibold text-blue-600 dark:text-blue-300"
			>
				Drop to attach to post {Math.min(focusIndex, items.length - 1) + 1}
			</div>
		{/if}
	</section>

	<!-- Live preview (legacy right column) -->
	<aside class="w-full md:sticky md:top-6 md:w-[20rem] md:shrink-0 xl:w-[26rem]">
		<button
			type="button"
			class="mb-3 flex items-center gap-2 text-sm text-muted hover:text-ink md:hidden"
			onclick={() => (showPreview = !showPreview)}
			aria-expanded={showPreview}
		>
			<Eye class="size-4" />{showPreview ? 'Hide preview' : 'Show preview'}
		</button>
		<div class={cn(!showPreview && 'hidden md:block')}>
			<h2 class="mb-3 hidden text-sm font-medium text-muted md:block">Preview</h2>
			<PostPreview {items} account={selectedAccounts[0] ?? null} at={scheduledAt} {tz} />
		</div>
	</aside>
</div>

<MediaPicker
	bind:open={pickerOpen}
	existing={items[pickerTarget]?.media.map((m) => m.kind) ?? []}
	onpick={(list) => editors[pickerTarget]?.addMedia(list)}
/>
