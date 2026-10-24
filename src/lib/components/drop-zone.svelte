<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import { fileDrop } from '#lib/actions/file-drop.js';
	import { ACCEPTED_MIMES } from '#lib/shared/media-rules.js';
	import { cn } from '#lib/utils.js';

	let {
		onfiles,
		maxUploadMb,
		disabled = false
	}: { onfiles: (files: File[]) => void; maxUploadMb: number; disabled?: boolean } = $props();

	let input: HTMLInputElement | undefined = $state();
	let over = $state(false);

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			input?.click();
		}
	}
</script>

<!-- Legacy FileUpload drop zone; the whole zone is clickable and keyboard-operable. -->
<div
	use:fileDrop={{ ondrop: onfiles, onover: (v) => (over = v), disabled }}
	role="button"
	tabindex={disabled ? -1 : 0}
	aria-disabled={disabled}
	aria-label="Upload media: drop files here, or press Enter to choose files"
	onclick={() => !disabled && input?.click()}
	{onkeydown}
	class={cn(
		'cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
		over
			? 'border-blue-500 bg-blue-500/10'
			: 'border-line-strong hover:border-muted hover:bg-surface-2/50',
		disabled && 'pointer-events-none opacity-50'
	)}
>
	<Upload class={cn('mx-auto mb-2 size-8', over ? 'text-blue-500' : 'text-muted')} />
	<p class="text-sm text-ink-2">
		{#if over}Drop to upload{:else}Drop files here or <span
				class="font-medium text-blue-600 dark:text-blue-400">browse</span
			>{/if}
	</p>
	<p class="mt-1 text-xs text-muted">
		Images (JPEG, PNG, WebP) up to 5 MB · GIFs up to 15 MB · videos (MP4, MOV) up to {maxUploadMb} MB
	</p>
	<input
		bind:this={input}
		type="file"
		multiple
		accept={ACCEPTED_MIMES.join(',')}
		class="hidden"
		onclick={(e) => e.stopPropagation()}
		onchange={(e) => {
			onfiles(Array.from(e.currentTarget.files ?? []));
			e.currentTarget.value = '';
		}}
	/>
</div>
