<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { X } from 'lucide-svelte';

	let filerobotImageEditor: import('react-filerobot-image-editor').default | null = null;

	export let open = false;
	export let imageUrl = '';
	export let filename = '';
	export let onSave: ((editedImageBlob: Blob, filename: string) => Promise<void>) | null = null;

	let editorContainer: HTMLDivElement;

	let saving = false;

	function closeEditor() {
		if (filerobotImageEditor) {
			filerobotImageEditor.terminate();
			filerobotImageEditor = null;
		}
		open = false;
	}

	async function initializeEditor() {
		if (!browser || !open || !imageUrl || !editorContainer) return;

		try {
			// Dynamically import the editor (client-side only)
			const FilerobotImageEditor = await import('react-filerobot-image-editor');
			const Editor = FilerobotImageEditor.default;

			if (filerobotImageEditor) {
				filerobotImageEditor.terminate();
			}

			filerobotImageEditor = new Editor(editorContainer, {
				source: imageUrl,
				onSave: async (editedImageObject: any, designState: any) => {
					try {
						saving = true;
						console.log('Image edited, saving...');

						// Convert the edited image to a Blob
						const response = await fetch(editedImageObject.imageBase64);
						const blob = await response.blob();

						// Call the parent's onSave handler
						if (onSave) {
							await onSave(blob, filename);
						}

						closeEditor();
					} catch (error) {
						console.error(`Error saving edited image: ${error instanceof Error ? error.message : String(error)}`);
						alert('Failed to save edited image. Please try again.');
					} finally {
						saving = false;
					}
				},
				onClose: () => {
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
					],
					presetsFolders: [
						{
							titleKey: 'socialMedia',
							groups: [
								{
									titleKey: 'facebook',
									items: [
										{
											titleKey: 'profile',
											width: 180,
											height: 180,
											descriptionKey: 'fbProfileSize'
										},
										{
											titleKey: 'coverPhoto',
											width: 820,
											height: 312,
											descriptionKey: 'fbCoverPhotoSize'
										}
									]
								}
							]
						}
					]
				},
				tabsIds: ['Adjust', 'Annotate', 'Filters', 'FineTune', 'Resize'],
				defaultTabId: 'Annotate',
				defaultToolId: 'Text'
			});

			console.log('Image editor initialized successfully');
		} catch (error) {
			console.error(`Editor initialization failed: ${error instanceof Error ? error.message : String(error)}`);
			alert('Failed to load image editor. Please try again.');
		}
	}

	// Initialize editor when modal opens
	$: if (open && imageUrl && browser) {
		setTimeout(() => initializeEditor(), 100);
	}

	// Clean up on destroy
	onDestroy(() => {
		if (filerobotImageEditor) {
			filerobotImageEditor.terminate();
			filerobotImageEditor = null;
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
			<div bind:this={editorContainer} class="h-full w-full"></div>

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
