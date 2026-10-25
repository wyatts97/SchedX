<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto, refreshAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Plus from '@lucide/svelte/icons/plus';
	import PenSquare from '@lucide/svelte/icons/square-pen';
	import Upload from '@lucide/svelte/icons/upload';
	import { MOBILE_LEFT, MOBILE_RIGHT, isActive, type NavItem } from './nav.js';
	import { uploadMedia } from '../composer/upload.js';
	import { ACCEPTED_MIMES } from '#lib/shared/media-rules.js';
	import { cn } from '#lib/utils.js';

	let { attention }: { attention: number } = $props();

	let hidden = $state(false);
	let open = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();

	onMount(() => {
		// Legacy behaviour: slide the bar away at the bottom of a scrollable page so it never
		// covers the last row of content.
		const onScroll = () => {
			const doc = document.documentElement;
			const scrollable = doc.scrollHeight > doc.clientHeight + 80;
			const atBottom = window.scrollY + doc.clientHeight >= doc.scrollHeight - 10;
			hidden = scrollable && atBottom && !open;
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	async function upload(files: FileList | null) {
		open = false;
		if (!files?.length) return;
		const list = [...files];
		const id = toast.loading(`Uploading ${list.length} file${list.length > 1 ? 's' : ''}…`);
		const results = await Promise.allSettled(list.map((f) => uploadMedia(f, () => {})));
		const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
		const done = list.length - failed.length;
		if (failed.length) toast.error((failed[0].reason as Error).message, { id });
		if (done) {
			toast.success(`Uploaded ${done} file${done > 1 ? 's' : ''} to Media`, {
				id: failed.length ? undefined : id,
				action: { label: 'View', onClick: () => goto('/library') }
			});
		}
		if (fileInput) fileInput.value = '';
		if (page.url.pathname === '/library') await refreshAll();
	}
</script>

{#snippet tab(item: NavItem)}
	{@const active = isActive(page.url.pathname, item.href)}
	<a
		href={item.href}
		aria-current={active ? 'page' : undefined}
		class={cn(
			'relative inline-flex flex-1 flex-col items-center justify-center gap-1 py-2.5 font-medium transition-colors duration-200',
			active ? 'text-tab-active' : 'text-muted hover:text-tab-active'
		)}
	>
		<item.icon class="size-5" strokeWidth={active ? 2.5 : 2} />
		<span class={cn('text-[10px]', active && 'font-semibold')}>{item.label}</span>
		{#if active}
			<span class="absolute bottom-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-tab-active"
			></span>
		{/if}
		{#if item.href === '/' && attention > 0}
			<span
				class="absolute top-1.5 left-1/2 ml-2 size-2 rounded-full bg-amber-500"
				title="{attention} post(s) need attention"
			></span>
		{/if}
	</a>
{/snippet}

{#if open}
	<button
		class="fixed inset-0 z-30 cursor-default lg:hidden"
		aria-label="Close menu"
		onclick={() => (open = false)}
	></button>
{/if}

<nav
	aria-label="Main"
	class={cn(
		'fixed bottom-4 left-1/2 z-40 w-11/12 max-w-md -translate-x-1/2 pb-[env(safe-area-inset-bottom)] transition-[translate,opacity] duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] lg:hidden',
		hidden && 'pointer-events-none translate-y-[calc(100%+2rem)] opacity-0'
	)}
>
	<div
		class="relative flex w-full overflow-hidden rounded-3xl border border-line/50 bg-chrome/90 shadow-xl backdrop-blur-md"
	>
		{#each MOBILE_LEFT as item (item.href)}{@render tab(item)}{/each}
		<div class="flex-1" aria-hidden="true"></div>
		{#each MOBILE_RIGHT as item (item.href)}{@render tab(item)}{/each}
	</div>

	<div class="absolute -top-6 left-1/2 z-10 -translate-x-1/2">
		{#if open}
			<div
				class="absolute bottom-full left-1/2 mb-4 -translate-x-1/2 animate-[pop-in_0.15s_ease-out] overflow-hidden rounded-2xl border border-line/50 bg-chrome/95 shadow-xl backdrop-blur-md"
			>
				<a
					href="/compose"
					onclick={() => (open = false)}
					class="flex items-center gap-3 px-6 py-3 text-sm font-medium whitespace-nowrap text-ink-2 hover:bg-surface-2"
				>
					<PenSquare class="size-5 text-blue-500" />New post
				</a>
				<div class="h-px bg-line"></div>
				<button
					type="button"
					onclick={() => fileInput?.click()}
					class="flex w-full items-center gap-3 px-6 py-3 text-sm font-medium whitespace-nowrap text-ink-2 hover:bg-surface-2"
				>
					<Upload class="size-5 text-green-500" />Upload media
				</button>
			</div>
		{/if}
		<button
			type="button"
			onclick={() => (open = !open)}
			class={cn(
				'rounded-full border-4 border-bg bg-primary p-3 text-white shadow-lg transition-transform duration-200 hover:scale-110 active:scale-95',
				open && 'rotate-45'
			)}
			aria-expanded={open}
			aria-label={open ? 'Close create menu' : 'Create'}
		>
			<Plus class="size-8" />
		</button>
	</div>
	<input
		bind:this={fileInput}
		type="file"
		multiple
		accept={ACCEPTED_MIMES.join(',')}
		class="hidden"
		onchange={(e) => upload(e.currentTarget.files)}
	/>
</nav>
