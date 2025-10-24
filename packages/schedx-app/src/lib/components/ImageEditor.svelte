<script lang="ts">
	import { browser } from '$app/environment';
	import { X } from 'lucide-svelte';
	import { PinturaEditor } from '@pqina/svelte-pintura';
	import {
		createDefaultImageReader,
		createDefaultImageWriter,
		setPlugins,
		plugin_crop,
		plugin_finetune,
		plugin_annotate,
		plugin_filter,
		locale_en_gb,
		plugin_crop_locale_en_gb,
		plugin_finetune_locale_en_gb,
		plugin_annotate_locale_en_gb,
		plugin_filter_locale_en_gb,
		markup_editor_locale_en_gb,
		createDefaultShapePreprocessor,
		markup_editor_defaults,
		plugin_finetune_defaults
	} from '@pqina/pintura';
	import '@pqina/pintura/pintura.css';

	export let open = false;
	export let imageUrl = '';
	export let filename = '';
	export let onSave: ((editedImageBlob: Blob, filename: string) => Promise<void>) | null = null;

	let saving = false;
	let currentTheme: 'light' | 'dark' | 'lightsout' = 'light';

	// Register Pintura plugins
	if (browser) {
		setPlugins(plugin_crop, plugin_finetune, plugin_annotate, plugin_filter);
	}

	// Detect current theme from document
	function detectTheme(): 'light' | 'dark' | 'lightsout' {
		if (!browser) return 'light';
		const html = document.documentElement;
		const theme = html.getAttribute('data-theme');
		if (theme === 'dark') return 'dark';
		if (theme === 'lightsout') return 'lightsout';
		return 'light';
	}

	// Update theme when modal opens
	$: if (open && browser) {
		currentTheme = detectTheme();
	}

	// Configure Pintura editor
	const editorConfig = {
		imageReader: createDefaultImageReader(),
		imageWriter: createDefaultImageWriter(),
		...markup_editor_defaults,
		...plugin_finetune_defaults,
		shapePreprocessor: createDefaultShapePreprocessor(),
		locale: {
			...locale_en_gb,
			...plugin_crop_locale_en_gb,
			...plugin_finetune_locale_en_gb,
			...plugin_annotate_locale_en_gb,
			...plugin_filter_locale_en_gb,
			...markup_editor_locale_en_gb
		}
	};

	function closeEditor() {
		open = false;
		saving = false;
	}

	// Handle image processing (save)
	async function handleProcess(event: CustomEvent) {
		const imageWriterResult = event.detail;
		console.log('Image processed:', imageWriterResult);

		try {
			saving = true;

			// Get the blob from the result
			const blob = imageWriterResult.dest;

			// Call the parent's onSave handler
			if (onSave && blob) {
				await onSave(blob, filename);
			}

			// Close editor after successful save
			setTimeout(() => closeEditor(), 100);
		} catch (error) {
			console.error('Error saving edited image:', error);
			alert('Failed to save edited image. Please try again.');
		} finally {
			saving = false;
		}
	}

	// Handle keyboard events
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !saving) {
			closeEditor();
		}
	}
</script>

<!-- Image Editor Modal -->
{#if open}
	<div
		class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
		on:click={closeEditor}
		role="button"
		tabindex="0"
		on:keydown={(e) => e.key === 'Enter' && closeEditor()}
	>
		<div
			class="relative h-[90vh] w-[90vw] overflow-hidden rounded-lg shadow-2xl"
			class:bg-white={currentTheme === 'light'}
			class:bg-gray-900={currentTheme === 'dark'}
			class:bg-black={currentTheme === 'lightsout'}
			on:click|stopPropagation
			role="dialog"
			tabindex="-1"
			on:keydown={handleKeydown}
		>
			<!-- Close Button -->
			<button
				class="absolute right-4 top-4 z-[100000] rounded-full p-2 shadow-lg backdrop-blur-sm transition"
				class:bg-white={currentTheme === 'light'}
				class:hover:bg-gray-50={currentTheme === 'light'}
				class:bg-gray-800={currentTheme === 'dark'}
				class:hover:bg-gray-700={currentTheme === 'dark'}
				class:bg-gray-900={currentTheme === 'lightsout'}
				class:hover:bg-gray-800={currentTheme === 'lightsout'}
				on:click={closeEditor}
				disabled={saving}
				aria-label="Close editor"
			>
				<X class={`h-6 w-6 ${currentTheme === 'light' ? 'text-gray-700' : 'text-gray-200'}`} />
			</button>

			<!-- Pintura Editor Container -->
			<div class="h-full w-full">
				<PinturaEditor
					{...editorConfig}
					src={imageUrl}
					on:process={handleProcess}
				/>
			</div>

			<!-- Saving Overlay -->
			{#if saving}
				<div
					class="absolute inset-0 z-[100001] flex items-center justify-center bg-black/50 backdrop-blur-sm"
				>
					<div
						class="rounded-lg p-6 shadow-xl"
						class:bg-white={currentTheme === 'light'}
						class:bg-gray-800={currentTheme === 'dark'}
						class:bg-black={currentTheme === 'lightsout'}
						class:border={currentTheme === 'lightsout'}
						class:border-gray-700={currentTheme === 'lightsout'}
					>
						<div class="flex items-center gap-3">
							<div
								class="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
								class:border-blue-600={currentTheme === 'light' || currentTheme === 'dark'}
								class:border-blue-400={currentTheme === 'lightsout'}
							></div>
							<span
								class="text-lg font-medium"
								class:text-gray-900={currentTheme === 'light'}
								class:text-white={currentTheme === 'dark' || currentTheme === 'lightsout'}
								>Saving image...</span
							>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Pintura editor styling */
	:global(.pintura-editor) {
		height: 100%;
		width: 100%;
	}
</style>
