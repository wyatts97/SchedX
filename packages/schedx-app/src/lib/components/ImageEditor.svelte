<script lang="ts">
	import { onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { X } from 'lucide-svelte';

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
	let React: any = null;
	let ReactDOM: any = null;
	let currentTheme: 'light' | 'dark' | 'lightsout' = 'light';

	// Detect current theme from document
	function detectTheme(): 'light' | 'dark' | 'lightsout' {
		if (!browser) return 'light';
		const html = document.documentElement;
		const theme = html.getAttribute('data-theme');
		if (theme === 'dark') return 'dark';
		if (theme === 'lightsout') return 'lightsout';
		return 'light';
	}

	// Get theme-specific colors for Filerobot
	function getThemeColors(theme: 'light' | 'dark' | 'lightsout') {
		if (theme === 'lightsout') {
			return {
				'bg-primary': '#000000',
				'bg-secondary': '#18191a',
				'bg-primary-active': '#1a1a1a',
				'accent-primary': '#1da1f2',
				'accent-primary-hover': '#1a8cd8',
				'accent-primary-active': '#1570b8',
				'icons-primary': '#ffffff',
				'icons-secondary': '#b0b0b0',
				'borders-primary': '#222222',
				'borders-secondary': '#333333',
				'borders-strong': '#444444',
				'txt-primary': '#ffffff',
				'txt-secondary': '#b0b0b0',
				'light-shadow': 'rgba(255, 255, 255, 0.1)',
				'warning': '#f59e0b'
			};
		} else if (theme === 'dark') {
			return {
				'bg-primary': '#1f2937',
				'bg-secondary': '#192734',
				'bg-primary-active': '#253341',
				'accent-primary': '#3b82f6',
				'accent-primary-hover': '#2563eb',
				'accent-primary-active': '#1d4ed8',
				'icons-primary': '#ffffff',
				'icons-secondary': '#8899a6',
				'borders-primary': '#38444d',
				'borders-secondary': '#4a5568',
				'borders-strong': '#5a6570',
				'txt-primary': '#ffffff',
				'txt-secondary': '#8899a6',
				'light-shadow': 'rgba(0, 0, 0, 0.3)',
				'warning': '#f59e0b'
			};
		} else {
			// Light theme
			return {
				'bg-primary': '#ffffff',
				'bg-secondary': '#f5f5f5',
				'bg-primary-active': '#ECF3FF',
				'accent-primary': '#3b82f6',
				'accent-primary-hover': '#2563eb',
				'accent-primary-active': '#1d4ed8',
				'icons-primary': '#000000',
				'icons-secondary': '#666666',
				'borders-primary': '#e5e5e5',
				'borders-secondary': '#cccccc',
				'borders-strong': '#999999',
				'txt-primary': '#000000',
				'txt-secondary': '#666666',
				'light-shadow': 'rgba(0, 0, 0, 0.1)',
				'warning': '#f59e0b'
			};
		}
	}

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
			
			// Detect current theme
			currentTheme = detectTheme();

			// Import React and ReactDOM first and expose globally
			if (!React || !ReactDOM) {
				React = await import('react');
				ReactDOM = await import('react-dom/client');
				
				// Expose React globally for the Filerobot library
				(window as any).React = React.default || React;
				(window as any).ReactDOM = ReactDOM.default || ReactDOM;
			}

			// Then import Filerobot editor
			if (!FilerobotImageEditor) {
				const FilerobotModule = await import('react-filerobot-image-editor');
				FilerobotImageEditor = FilerobotModule.default;
				TABS = FilerobotModule.TABS;
				TOOLS = FilerobotModule.TOOLS;
			}

			// Clean up previous instance
			if (reactRoot) {
				reactRoot.unmount();
			}

			// Use the React from window to ensure same instance
			const ReactInstance = (window as any).React;
			const ReactDOMInstance = (window as any).ReactDOM;

			// Create React element with editor
			const editorElement = ReactInstance.createElement(FilerobotImageEditor, {
				source: imageUrl,
				onSave: async (editedImageObject: any, designState: any) => {
					console.log('Save triggered', editedImageObject);
					try {
						saving = true;

						// Convert the edited image to a Blob
						const response = await fetch(editedImageObject.imageBase64);
						const blob = await response.blob();

						// Call the parent's onSave handler
						if (onSave) {
							await onSave(blob, filename);
						}

						// Close editor after successful save
						setTimeout(() => closeEditor(), 100);
						return true; // Indicate success to Filerobot
					} catch (error) {
						console.error('Error saving edited image:', error);
						alert('Failed to save edited image. Please try again.');
						return false; // Indicate failure to Filerobot
					} finally {
						saving = false;
					}
				},
				onClose: () => {
					console.log('Close triggered');
					closeEditor();
				},
				// CRITICAL: Save design state to maintain changes across tool switches
				moreTabs: [],
				savingPixelRatio: 4,
				previewPixelRatio: window.devicePixelRatio || 1,
				
				// Observe container size for proper rendering
				observePluginContainerSize: true,
				
				// Annotation defaults
				annotationsCommon: {
					fill: '#ff0000',
					stroke: '#ff0000',
					strokeWidth: 2,
					shadowOffsetX: 0,
					shadowOffsetY: 0,
					shadowBlur: 0,
					shadowColor: 'black',
					shadowOpacity: 1,
					opacity: 1
				},
				
				// Text tool configuration with proper defaults
				Text: { 
					text: 'Text',
					fontSize: 16,
					fontFamily: 'Roboto, Arial, sans-serif',
					letterSpacing: 0,
					lineHeight: 1.2,
					align: 'left',
					fontStyle: 'normal',
					fill: '#000000',
					stroke: '',
					strokeWidth: 0
				},
				
				// Rotate configuration
				Rotate: { 
					angle: 90, 
					componentType: 'slider' 
				},
				
				// Crop presets
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
					autoResize: true
				},
				
				// Available tabs
				tabsIds: [TABS.ADJUST, TABS.ANNOTATE, TABS.FILTERS, TABS.RESIZE],
				defaultTabId: TABS.ANNOTATE,
				defaultToolId: TOOLS.TEXT,
				
				// Theme configuration - dynamically set based on current app theme
				theme: {
					palette: getThemeColors(currentTheme),
					typography: {
						fontFamily: 'Roboto, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
					}
				},
				
				// Use cloud image for better compatibility
				useCloudimage: false,
				
				// Disable zoom out on save
				showBackButton: false,
				
				// Language
				language: 'en',
				
				// Avoid side effects - disable alert when leaving
				avoidChangesNotSavedAlertOnLeave: true,
				
				// Default saved image type
				defaultSavedImageType: 'png',
				defaultSavedImageQuality: 0.92,
				
				// Force render on mount
				forceToPngInEllipticalCrop: false,
				
				// Close after save
				closeAfterSave: false, // We handle this manually
				
				// Disable watermark
				disableZooming: false
			});

			// Create React root and render
			reactRoot = ReactDOMInstance.createRoot(editorContainer);
			reactRoot.render(editorElement);
		} catch (error) {
			console.error('Editor initialization failed:', error);
			initError = true;
			alert('Failed to load image editor. Please try again.');
		}
	}

	// Initialize editor when modal opens
	$: if (open && imageUrl && browser) {
		// Detect theme on open
		currentTheme = detectTheme();
		// Delay to ensure DOM is ready
		setTimeout(() => initializeEditor(), 150);
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
				class="relative h-[90vh] w-[90vw] overflow-hidden rounded-lg shadow-2xl"
				class:bg-white={currentTheme === 'light'}
				class:bg-gray-900={currentTheme === 'dark'}
				class:bg-black={currentTheme === 'lightsout'}
				on:click|stopPropagation
				role="dialog"
				tabindex="-1"
				on:keydown={(e) => e.key === 'Escape' && closeEditor()}
			>
			<!-- Close Button -->
			<button
				class="absolute right-4 top-4 z-[100000] rounded-full p-2 shadow-lg backdrop-blur-sm transition"
				class:bg-white={currentTheme === 'light'}
				class:hover:bg-white={currentTheme === 'light'}
				class:bg-gray-800={currentTheme === 'dark'}
				class:hover:bg-gray-800={currentTheme === 'dark'}
				class:bg-gray-900={currentTheme === 'lightsout'}
				class:hover:bg-gray-900={currentTheme === 'lightsout'}
				on:click={closeEditor}
				disabled={saving}
				aria-label="Close editor"
			>
				<X 
				class={`h-6 w-6 ${currentTheme === 'light' ? 'text-gray-700' : 'text-gray-200'}`}
			/>
			</button>

			<!-- Editor Container -->
			{#if initError}
				<div class="flex h-full w-full items-center justify-center">
					<div class="text-center">
						<p 
							class="text-lg font-medium"
							class:text-red-600={currentTheme === 'light'}
							class:text-red-400={currentTheme === 'dark' || currentTheme === 'lightsout'}
						>
							Failed to load image editor
						</p>
						<p 
							class="mt-2 text-sm"
							class:text-gray-600={currentTheme === 'light'}
							class:text-gray-400={currentTheme === 'dark'}
							class:text-gray-300={currentTheme === 'lightsout'}
						>
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
							>Saving image...</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}