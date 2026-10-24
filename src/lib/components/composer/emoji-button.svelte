<script lang="ts">
	import { Popover } from 'bits-ui';
	// Self-hosted emoji data: a hashed build asset, so the CSP can stay `connect-src 'self'`.
	import emojiData from 'emoji-picker-element-data/en/emojibase/data.json?url';
	import type { Picker } from 'emoji-picker-element';
	import { useTheme } from '../shell/theme.svelte.js';

	let { onpick, disabled = false }: { onpick: (emoji: string) => void; disabled?: boolean } =
		$props();

	const theme = useTheme();
	let open = $state(false);
	let host: HTMLDivElement | undefined = $state();
	let picker: Picker | undefined;

	$effect(() => {
		if (!open || !host) return;
		const target = host;
		void (async () => {
			if (!picker) {
				const { Picker } = await import('emoji-picker-element');
				picker = new Picker({ dataSource: emojiData, locale: 'en' });
				picker.addEventListener('emoji-click', (e) => {
					if (e.detail.unicode) onpick(e.detail.unicode);
					open = false;
				});
			}
			picker.classList.toggle('dark', theme?.resolved !== 'light');
			picker.classList.toggle('light', theme?.resolved === 'light');
			target.replaceChildren(picker);
		})();
	});
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		{disabled}
		class="flex size-8 items-center justify-center rounded-full bg-surface-2 text-xl leading-none transition-colors hover:bg-line disabled:opacity-40"
		aria-label="Add emoji"
		title="Emoji"
	>
		<span aria-hidden="true">😊</span>
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			side="bottom"
			align="end"
			sideOffset={8}
			collisionPadding={12}
			class="z-50 animate-[pop-in_0.15s_ease-out] overflow-hidden rounded-xl border border-line shadow-pop"
		>
			<div bind:this={host} class="emoji-host">
				<div
					class="grid h-[22rem] w-[min(22rem,calc(100vw-2rem))] place-items-center bg-raised text-sm text-muted"
				>
					Loading emoji…
				</div>
			</div>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

<style>
	.emoji-host :global(emoji-picker) {
		--background: var(--raised);
		--border-color: var(--line);
		--indicator-color: var(--accent);
		--input-border-color: var(--line-strong);
		--input-font-color: var(--ink);
		--input-placeholder-color: var(--muted);
		--outline-color: var(--focus);
		--category-font-color: var(--muted);
		--button-active-background: var(--surface-2);
		--button-hover-background: var(--surface-2);
		--num-columns: 8;
		--emoji-size: 1.375rem;
		width: min(22rem, calc(100vw - 2rem));
		height: 22rem;
		display: block;
	}
</style>
