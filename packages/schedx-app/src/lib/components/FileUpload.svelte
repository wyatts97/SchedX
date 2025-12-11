<script lang="ts">
	import { onMount, createEventDispatcher, onDestroy } from 'svelte';
	import { Trash2, Upload, X, CheckCircle, AlertCircle } from 'lucide-svelte';

	// Types
	interface MediaFile {
		url: string;
		type: 'image' | 'video' | 'photo' | 'gif'; // Support both client and server types
		file: File;
		name: string;
		size: number;
		uploaded?: boolean;
		error?: string;
	}

	interface UploadResponse {
		url: string;
		type: 'photo' | 'gif' | 'video';
	}

	interface UploadError {
		message: string;
		file?: string;
	}

	// Props
	const dispatch = createEventDispatcher<{
		changeMedia: { url: string; type: 'photo' | 'gif' | 'video' | 'image' }[];
		uploadStart: void;
		uploadComplete: void;
		uploadError: UploadError;
	}>();

	export let disabled = false;
	export let maxFiles = 4;
	export let maxFileSize = 50 * 1024 * 1024; // 50MB
	export let acceptedTypes = ['image/*', 'video/*'];
	export let showPreview = true;
	export let autoUpload = true; // Auto-upload files when selected
	export let selectedAccountId: string | null = null; // Account ID for tagging media
	export let initialMedia: { url: string; type: string }[] = []; // Pre-existing media for edit mode

	// State
	let files: File[] = [];
	let mediaFiles: MediaFile[] = [];
	let uploading = false;
	let uploadProgress = 0;
	let dropHighlight = false;
	let dragCounter = 0;
	let fileInput: HTMLInputElement;
	let dropZone: HTMLDivElement;

	// Gallery selection
	let showGalleryModal = false;
	let galleryMedia: any[] = [];
	let loadingGallery = false;
	let selectedGalleryIds = new Set<string>();

	// Load initial media reactively (for edit mode)
	$: if (initialMedia && initialMedia.length > 0 && mediaFiles.length === 0) {
		// Convert initial media to MediaFile format
		mediaFiles = initialMedia.map((media) => ({
			url: media.url,
			type: media.type as 'image' | 'video' | 'photo' | 'gif',
			file: null as any, // No file object for pre-existing media
			name: media.url.split('/').pop() || 'media',
			size: 0,
			uploaded: true // Already uploaded
		}));

		// Dispatch initial media for preview
		dispatch('changeMedia', initialMedia as any);
	}

	// File validation
	const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
	const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/mov'];
	const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

	function validateFile(file: File): { valid: boolean; error?: string } {
		// Check file size
		if (file.size > maxFileSize) {
			const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
			return { valid: false, error: `File too large. Maximum size is ${maxSizeMB}MB.` };
		}

		// Check file type
		if (!allowedTypes.includes(file.type)) {
			return {
				valid: false,
				error:
					'File type not supported. Please use images (JPEG, PNG, GIF, WebP) or videos (MP4, WebM, MOV).'
			};
		}

		// Check if we already have this file
		const existingFile = files.find((f) => f.name === file.name && f.size === file.size);
		if (existingFile) {
			return { valid: false, error: 'File already selected.' };
		}

		// Check max files limit
		if (files.length >= maxFiles) {
			return { valid: false, error: `Maximum ${maxFiles} files allowed.` };
		}

		return { valid: true };
	}

	function getMediaType(file: File): 'image' | 'video' {
		return file.type.startsWith('image/') ? 'image' : 'video';
	}

	function mapMediaType(serverType: string): 'photo' | 'gif' | 'video' | 'image' {
		// Preserve the original server types for better compatibility
		// The server returns: 'photo', 'gif', 'video'
		// We want to keep these exact types for the preview component
		return serverType as 'photo' | 'gif' | 'video' | 'image';
	}

	function handleFiles(selected: FileList | File[]) {
		if (!selected || selected.length === 0) {
			clearFiles();
			return;
		}

		const newFiles = Array.from(selected);
		const validFiles: File[] = [];
		const errors: string[] = [];

		for (const file of newFiles) {
			const validation = validateFile(file);
			if (validation.valid) {
				validFiles.push(file);
			} else {
				errors.push(`${file.name}: ${validation.error}`);
			}
		}

		// Add valid files
		files = [...files, ...validFiles];

		// Create media files for preview
		const newMediaFiles = validFiles.map((file) => ({
			url: URL.createObjectURL(file),
			type: getMediaType(file),
			file,
			name: file.name,
			size: file.size,
			uploaded: false
		}));

		mediaFiles = [...mediaFiles, ...newMediaFiles];

		// Dispatch media immediately for preview (before upload)
		const allMedia = mediaFiles.map((m) => ({
			url: m.url,
			type: m.type // Use the actual file type: 'image' or 'video'
		}));
		dispatch('changeMedia', allMedia);

		// Show errors if any
		if (errors.length > 0) {
			showError(errors.join('\n'));
		}

		// Auto upload if enabled (now default)
		if (autoUpload && validFiles.length > 0) {
			// Small delay to ensure UI updates first
			setTimeout(() => {
				uploadFiles();
			}, 100);
		}
	}

	export function clearFiles() {
		// Clean up blob URLs to prevent memory leaks
		mediaFiles.forEach((media) => {
			if (media.url.startsWith('blob:')) {
				URL.revokeObjectURL(media.url);
			}
		});

		files = [];
		mediaFiles = [];
		if (fileInput) {
			fileInput.value = '';
		}
		dispatch('changeMedia', []);
	}

	function removeFile(index: number) {
		if (index < 0 || index >= mediaFiles.length) return;

		const media = mediaFiles[index];

		// Clean up blob URL
		if (media.url.startsWith('blob:')) {
			URL.revokeObjectURL(media.url);
		}

		// Remove from arrays
		mediaFiles.splice(index, 1);
		files.splice(index, 1);

		// Update arrays to trigger reactivity
		mediaFiles = [...mediaFiles];
		files = [...files];

		// Dispatch only uploaded URLs with correct type mapping
		const uploadedMedia = mediaFiles.filter((m) => m.uploaded);
		dispatch(
			'changeMedia',
			uploadedMedia.map((m) => ({
				url: m.url,
				type: mapMediaType(m.type) as 'photo' | 'gif' | 'video' | 'image' // Map server types to client types
			}))
		);
	}

	function showError(message: string) {
		// For now, we'll use a simple alert, but in a real app you might want a toast notification
		alert(message);
	}

	// Drag and drop handlers
	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter++;
		dropHighlight = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter--;
		if (dragCounter === 0) {
			dropHighlight = false;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter = 0;
		dropHighlight = false;

		if (e.dataTransfer?.files) {
			handleFiles(e.dataTransfer.files);
		}
	}

	// Gallery selection functions
	async function openGalleryModal() {
		showGalleryModal = true;
		loadingGallery = true;
		selectedGalleryIds.clear();

		try {
			// Don't filter by account - show all media
			const response = await fetch('/api/gallery');
			if (response.ok) {
				const data = await response.json();
				galleryMedia = data.media || [];
			}
		} catch (error) {
			console.error('Failed to load gallery:', error);
		} finally {
			loadingGallery = false;
		}
	}

	function toggleGallerySelection(mediaId: string) {
		if (selectedGalleryIds.has(mediaId)) {
			selectedGalleryIds.delete(mediaId);
		} else {
			// Check if we've reached max files
			if (mediaFiles.length + selectedGalleryIds.size >= maxFiles) {
				return;
			}
			selectedGalleryIds.add(mediaId);
		}
		selectedGalleryIds = selectedGalleryIds; // Trigger reactivity
	}

	function addSelectedFromGallery() {
		const selectedMedia = galleryMedia.filter(m => selectedGalleryIds.has(m.id));
		
		selectedMedia.forEach(media => {
			mediaFiles = [...mediaFiles, {
				url: media.url,
				type: media.type as 'image' | 'video' | 'photo' | 'gif',
				file: null as any,
				name: media.filename,
				size: media.fileSize || 0,
				uploaded: true
			}];
		});

		// Dispatch change event
		const mediaForDispatch = mediaFiles.map((m) => ({
			url: m.url,
			type: m.type === 'image' ? 'photo' : m.type
		}));
		dispatch('changeMedia', mediaForDispatch as any);

		// Close modal and reset
		showGalleryModal = false;
		selectedGalleryIds.clear();
	}

	async function uploadFiles() {
		if (files.length === 0 || uploading) return;

		uploading = true;
		uploadProgress = 0;
		dispatch('uploadStart');

		// Reset error states
		mediaFiles = [...mediaFiles.map((m) => ({ ...m, error: undefined }))];

		const uploadPromises = files.map(async (file, index) => {
			const formData = new FormData();
			formData.append('file', file);

			// Add account ID if provided (supports both UUID and custom ID formats)
			if (selectedAccountId && selectedAccountId.trim() !== '') {
				formData.append('accountId', selectedAccountId);
			}

			return new Promise<void>((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.open('POST', '/api/media/upload');

				xhr.upload.onprogress = (e) => {
					if (e.lengthComputable) {
						// We can improve this to show individual progress later
					}
				};

				xhr.onload = () => {
					if (xhr.status === 200) {
						const uploadedFile: UploadResponse = JSON.parse(xhr.responseText);

						// Update the specific media file
						const mediaFileIndex = mediaFiles.findIndex((mf) => mf.file === file);
						if (mediaFileIndex !== -1) {
							const updatedMediaFile = {
								...mediaFiles[mediaFileIndex],
								url: uploadedFile.url,
								type: uploadedFile.type,
								uploaded: true,
								error: undefined
							};
							mediaFiles[mediaFileIndex] = updatedMediaFile;
						}
						resolve();
					} else {
						const errorResponse = JSON.parse(xhr.responseText);
						const errorMessage = errorResponse.error || 'Upload failed.';
						const mediaFileIndex = mediaFiles.findIndex((mf) => mf.file === file);
						if (mediaFileIndex !== -1) {
							mediaFiles[mediaFileIndex].error = errorMessage;
						}
						reject(new Error(errorMessage));
					}
				};

				xhr.onerror = () => reject(new Error('Network error.'));
				xhr.ontimeout = () => reject(new Error('Upload timed out.'));

				xhr.send(formData);
			});
		});

		try {
			await Promise.all(uploadPromises);

			// Update the mediaFiles array with new reference
			mediaFiles = [...mediaFiles];

			// Dispatch uploaded media with correct type mapping
			const uploadedMedia = mediaFiles.filter((m) => m.uploaded);
			const mediaToDispatch = uploadedMedia.map((m) => ({
				url: m.url,
				type: mapMediaType(m.type) as 'photo' | 'gif' | 'video' | 'image'
			}));
			dispatch('changeMedia', mediaToDispatch);
			dispatch('uploadComplete');
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
			dispatch('uploadError', { message: errorMessage });
		} finally {
			uploading = false;
		}
	}

	// Cleanup on destroy
	onDestroy(() => {
		mediaFiles.forEach((media) => {
			if (media.url.startsWith('blob:')) {
				URL.revokeObjectURL(media.url);
			}
		});
	});

	// Keyboard navigation
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && e.target === fileInput) {
			e.preventDefault();
			fileInput.click();
		}
	}
</script>

<div class="mx-auto max-w-xl">
	<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Media Upload</h2>

	<!-- File Input Section -->
	<div class="mb-4">
		<!-- Preline UI File Upload Component -->
		<div class="hs-file-upload w-full">
			<label
				for="file-input"
				class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
			>
				Choose files
			</label>

			<!-- Drop Zone with Preline Styling -->
			<div
				bind:this={dropZone}
				class="hs-file-upload-input relative rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500 {dropHighlight
					? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
					: ''}"
				on:dragenter={handleDragEnter}
				on:dragleave={handleDragLeave}
				on:dragover={handleDragOver}
				on:drop={handleDrop}
				role="button"
				tabindex="0"
				on:keydown={handleKeyDown}
				aria-label="Drop files here or click to select"
			>
				<Upload class="mx-auto mb-2 h-8 w-8 text-gray-400" />
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Drop files here or
					<button
						type="button"
						class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
						on:click={() => fileInput?.click()}
						disabled={uploading || disabled}
					>
						browse
					</button>
				</p>
				<p class="text-xs text-gray-500 dark:text-gray-500">
					Images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM, MOV) up to {Math.round(
						maxFileSize / (1024 * 1024)
					)}MB • Auto-upload
				</p>

				<!-- Gallery Selection Button -->
				<button
					type="button"
					on:click={openGalleryModal}
					disabled={uploading || disabled || mediaFiles.length >= maxFiles}
					class="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
						<circle cx="9" cy="9" r="2" />
						<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
					</svg>
					Select from Gallery
				</button>
			</div>

			<!-- Hidden File Input -->
			<input
				bind:this={fileInput}
				type="file"
				id="file-input"
				accept={acceptedTypes.join(',')}
				multiple
				class="hidden"
				on:change={(e) => {
					const files = (e.target as HTMLInputElement).files;
					if (files) handleFiles(files);
				}}
				disabled={uploading || disabled}
			/>

			<!-- File Count Display -->
			<div class="mt-2 flex items-center gap-2">
				{#if uploading}
					<span class="text-sm text-blue-600 dark:text-blue-400">
						Uploading {files.length} file{files.length > 1 ? 's' : ''}...
					</span>
				{:else if files.length > 0}
					<span class="text-sm text-gray-700 dark:text-gray-300">
						{files.length} file{files.length > 1 ? 's' : ''} selected
					</span>
				{:else}
					<span class="text-sm text-gray-400 dark:text-gray-500"> No file selected </span>
				{/if}
			</div>
		</div>
	</div>

	<!-- File List with Preline Styling -->
	{#if mediaFiles.length > 0}
		<div class="space-y-3">
			<h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
				Selected Files ({mediaFiles.length}/{maxFiles})
			</h3>

			<!-- Grid Layout for Multiple Files -->
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{#each mediaFiles as media, i}
					<div
						class="group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900 {media.error
							? 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
							: media.uploaded
								? 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
								: ''}"
					>
						<!-- Remove Button -->
						<button
							type="button"
							class="absolute right-1 top-1 z-10 flex items-center justify-center rounded-full bg-white/80 p-1.5 shadow transition hover:bg-red-100 dark:bg-gray-800/80 dark:hover:bg-red-700"
							on:click={() => removeFile(i)}
							aria-label="Remove {media.name}"
							disabled={uploading}
						>
							<Trash2 class="h-4 w-4 text-red-500" />
						</button>

						<!-- File Preview -->
						{#if showPreview && (media.type === 'image' || media.type === 'photo' || media.type === 'gif') && !media.error}
							<img src={media.url} alt={media.name} class="h-full w-full object-cover" />
						{:else if showPreview && media.type === 'video' && !media.error}
							<video src={media.url} class="h-full w-full object-cover" muted playsinline></video>
						{:else}
							<div class="flex h-full w-full items-center justify-center">
								<Upload class="h-8 w-8 text-gray-400" />
							</div>
						{/if}

						<!-- File Status Overlay -->
						{#if media.error}
							<div
								class="absolute bottom-0 left-0 right-0 bg-red-600 p-1 text-center text-xs text-white"
							>
								Error
							</div>
						{:else if media.uploaded}
							<div
								class="absolute bottom-0 left-0 right-0 bg-green-600 p-1 text-center text-xs text-white"
							>
								<CheckCircle class="mx-auto h-3 w-3" />
							</div>
						{:else}
							<div
								class="absolute bottom-0 left-0 right-0 bg-amber-600 p-1 text-center text-xs text-white"
							>
								<AlertCircle class="mx-auto h-3 w-3" />
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Progress Bar with Preline Styling -->
	{#if uploading}
		<div class="mt-4">
			<div class="mb-2 flex justify-between text-sm">
				<span class="text-gray-600 dark:text-gray-400">Uploading...</span>
				<span class="text-gray-600 dark:text-gray-400">{uploadProgress}%</span>
			</div>
			<div class="hs-progress-bar h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
				<div
					class="h-2 rounded-full bg-blue-600 transition-all duration-300"
					style="width: {uploadProgress}%"
				></div>
			</div>
		</div>
	{/if}
</div>

<!-- Gallery Selection Modal -->
{#if showGalleryModal}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" 
		on:click={() => showGalleryModal = false}
		on:keydown={(e) => e.key === 'Enter' && (showGalleryModal = false)}
		role="presentation"
	>
		<div 
			class="max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800" 
			on:click|stopPropagation
			on:keydown|stopPropagation
			role="dialog"
			aria-modal="true"
			aria-labelledby="gallery-modal-title"
			tabindex="-1"
		>
			<!-- Modal Header -->
			<div class="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
				<h3 id="gallery-modal-title" class="text-lg font-semibold text-gray-900 dark:text-white">Select from Gallery</h3>
				<button
					type="button"
					on:click={() => showGalleryModal = false}
					class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
					aria-label="Close gallery modal"
				>
					<X class="h-5 w-5" aria-hidden="true" />
				</button>
			</div>

			<!-- Modal Body -->
			<div class="max-h-[60vh] overflow-y-auto p-4">
				{#if loadingGallery}
					<div class="flex items-center justify-center py-12">
						<div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
					</div>
				{:else if galleryMedia.length === 0}
					<div class="py-12 text-center">
						<p class="text-gray-500 dark:text-gray-400">No media in gallery</p>
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
						{#each galleryMedia as media}
							<button
								type="button"
								on:click={() => toggleGallerySelection(media.id)}
								class="group relative aspect-square overflow-hidden rounded-lg border-2 transition-all {selectedGalleryIds.has(media.id) ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'}"
								disabled={!selectedGalleryIds.has(media.id) && mediaFiles.length + selectedGalleryIds.size >= maxFiles}
							>
								{#if media.type === 'video'}
									<video src={media.url} class="h-full w-full object-cover"> 
										<track kind="captions" src="" srclang="en" />
									</video>
									<div class="absolute inset-0 flex items-center justify-center bg-black/30">
										<svg class="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
											<path d="M8 5v14l11-7z" />
										</svg>
									</div>
								{:else}
									<img src={media.url} alt={media.filename} class="h-full w-full object-cover" />
								{/if}

								<!-- Selection Indicator -->
								{#if selectedGalleryIds.has(media.id)}
									<div class="absolute right-2 top-2 rounded-full bg-blue-600 p-1">
										<CheckCircle class="h-4 w-4 text-white" />
									</div>
								{/if}

								<!-- Disabled Overlay -->
								{#if !selectedGalleryIds.has(media.id) && mediaFiles.length + selectedGalleryIds.size >= maxFiles}
									<div class="absolute inset-0 bg-gray-900/50"></div>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Modal Footer -->
			<div class="flex items-center justify-between border-t border-gray-200 p-4 dark:border-gray-700">
				<p class="text-sm text-gray-600 dark:text-gray-400">
					{selectedGalleryIds.size} selected • {maxFiles - mediaFiles.length} slots available
				</p>
				<div class="flex gap-2">
					<button
						type="button"
						on:click={() => showGalleryModal = false}
						class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
					>
						Cancel
					</button>
					<button
						type="button"
						on:click={addSelectedFromGallery}
						disabled={selectedGalleryIds.size === 0}
						class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Add Selected ({selectedGalleryIds.size})
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
