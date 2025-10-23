<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { X } from 'lucide-svelte';
	import React from 'react';
	import ReactDOM from 'react-dom/client';

	export let open = false;
	export let imageUrl = '';
	export let filename = '';
	export let onSave: ((editedImageBlob: Blob, filename: string) => Promise<void>) | null = null;

	let editorContainer: HTMLDivElement;
	let reactRoot: any = null;
	let saving = false;
	let initError = false;
	let FilerobotImageEditor: any = null;
	let TABS: any = null;
	let TOOLS: any = null;

	function closeEditor() {
		if (reactRoot && browser) {
			try {
				reactRoot.unmount();
				reactRoot = null;
			} catch (e) {
				console.error('Error unmounting React editor:', e);
			}
		}
		open = false;
		initError = false;
	}

	async function initializeEditor() {
		if (!browser || !open || !imageUrl || !editorContainer) return;

		try {
			initError = false;
			console.log('Initializing image editor with URL:', imageUrl);

			// Dynamically import only the Filerobot editor (React is already imported)
			if (!FilerobotImageEditor) {
				const FilerobotModule = await import('react-filerobot-image-editor');
				FilerobotImageEditor = FilerobotModule.default;
				TABS = FilerobotModule.TABS;
				TOOLS = FilerobotModule.TOOLS;
				console.log('Filerobot module loaded', { hasEditor: !!FilerobotImageEditor, hasTABS: !!TABS });
			}

			// Clean up previous instance
			if (reactRoot) {
				reactRoot.unmount();
			}

			// Create React element with editor
			const editorElement = React.createElement(FilerobotImageEditor, {
				source: imageUrl,
				onSave: async (editedImageObject: any, designState: any) => {
					try {
						saving = true;
						console.log('Image edited, saving...', editedImageObject);

						// Convert the edited image to a Blob
						const response = await fetch(editedImageObject.imageBase64);
						const blob = await response.blob();

						// Call the parent's onSave handler
						if (onSave) {
							await onSave(blob, filename);
						}

						closeEditor();
					} catch (error) {
						console.error('Error saving edited image:', error);
						alert('Failed to save edited image. Please try again.');
					} finally {
						saving = false;
					}
				},
				onClose: () => {
					console.log('Editor closed by user');
					closeEditor();
				},
				annotationsCommon: {
					fill: '#ff0000'
				},
				Text: { text: 'Enter text...' },
				Rotate: { angle: 90, componentType: 'slider' },
				Crop: {
					presetsItems: [
						{
							titleKey: 'classicTv',
							descriptionKey: '4:3',
							ratio: 4 / 3
						},
						{
							titleKey: 'cinemascope',
							descriptionKey: '21:9',
							ratio: 21 / 9
						}
					]
				},
				tabsIds: [TABS.ADJUST, TABS.ANNOTATE, TABS.FILTERS, TABS.RESIZE],
				defaultTabId: TABS.ANNOTATE,
				defaultToolId: TOOLS.TEXT
			});

			// Create React root and render
			console.log('Creating React root and rendering editor...');
			reactRoot = ReactDOM.createRoot(editorContainer);
			reactRoot.render(editorElement);

			console.log('Image editor initialized and rendered successfully');
		} catch (error) {
			console.error('Editor initialization failed:', error);
			initError = true;
			alert('Failed to load image editor. Please try again.');
		}
	}

	// Initialize editor when modal opens
	$: if (open && imageUrl && browser) {
		setTimeout(() => initializeEditor(), 100);
	}

	// Clean up on destroy
	onDestroy(() => {
		if (reactRoot && browser) {
			try {
				reactRoot.unmount();
				reactRoot = null;
			} catch (e) {
				console.error('Error unmounting React editor:', e);
			}
		}
	});
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
			class="relative h-[90vh] w-[90vw] overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-gray-900"
			on:click|stopPropagation
			role="dialog"
			tabindex="-1"
			on:keydown={(e) => e.key === 'Escape' && closeEditor()}
		>
			<!-- Close Button -->
			<button
				class="absolute right-4 top-4 z-[100000] rounded-full bg-white/90 p-2 shadow-lg backdrop-blur-sm transition hover:bg-white dark:bg-gray-900/90 dark:hover:bg-gray-900"
				on:click={closeEditor}
				disabled={saving}
				aria-label="Close editor"
			>
				<X class="h-6 w-6 text-gray-700 dark:text-gray-200" />
			</button>

			<!-- Editor Container -->
			{#if initError}
				<div class="flex h-full w-full items-center justify-center">
					<div class="text-center">
						<p class="text-lg font-medium text-red-600 dark:text-red-400">
							Failed to load image editor
						</p>
						<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
							Please close this dialog and try again.
						</p>
					</div>
				</div>
			{:else}
				<div bind:this={editorContainer} class="h-full w-full"></div>
			{/if}

			<!-- Saving Overlay -->
			{#if saving}
				<div
					class="absolute inset-0 z-[100001] flex items-center justify-center bg-black/50 backdrop-blur-sm"
				>
					<div class="rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
						<div class="flex items-center gap-3">
							<div
								class="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
							></div>
							<span class="text-lg font-medium text-gray-900 dark:text-white"
								>Saving edited image...</span
							>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
