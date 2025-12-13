<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { autoAnimate } from '@formkit/auto-animate';
	import { Search, X, Trash2, Loader2, CheckCircle, Upload as UploadIcon } from 'lucide-svelte';
	import MediaLightbox from '$lib/components/MediaLightbox.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import AccountDropdown from '$lib/components/AccountDropdown.svelte';
	import logger from '$lib/logger';
	import { debounce } from '$lib/utils/debounce';

	interface MediaItem {
		id: string;
		url: string;
		type: 'photo' | 'gif' | 'video';
		filename: string;
		uploadedAt: Date;
		fileSize: number;
		accountId?: string | null;
	}

	interface Account {
		id: string;
		username: string;
		displayName?: string;
		profileImage?: string;
	}

	let mediaItems: MediaItem[] = [];
	let accounts: Account[] = [];
	let selectedAccountId: string = 'all';
	let loading = true;
	let error = '';

	// Lightbox
	let lightbox: MediaLightbox;

	// Delete media function
	let deletingMediaId: string | null = null;
	let deleteError = '';
	let deleteSuccess = '';
	let showDeleteConfirm = false;
	let mediaToDelete: { id: string; filename: string; url: string } | null = null;

	// Multi-select functionality
	let selectedMediaIds = new Set<string>();
	let isSelectMode = false;
	let isSelectAll = false;

	// Upload section
	let showUploadSection = false;

	// Fetch accounts
	async function fetchAccounts() {
		try {
			const response = await fetch('/api/accounts');
			if (response.ok) {
				const data = await response.json();
				accounts = data.accounts || [];
			}
		} catch (err) {
			logger.error('Failed to fetch accounts:', err instanceof Error ? { error: err.message } : { error: String(err) });
		}
	}

	// Fetch all uploaded media
	async function fetchMedia() {
		try {
			loading = true;
			const url = selectedAccountId && selectedAccountId !== 'all'
				? `/api/gallery?accountId=${selectedAccountId}`
				: '/api/gallery';
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error('Failed to fetch media');
			}
			const data = await response.json();
			mediaItems = data.media || [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load media';
		} finally {
			loading = false;
		}
	}

	// OPTIMIZATION: Debounced fetch to prevent rapid API calls during filter changes
	const debouncedFetchMedia = debounce(() => {
		fetchMedia();
	}, 300);

	// Handle account filter change
	function handleAccountFilterChange(accountId: string) {
		selectedAccountId = accountId;
		debouncedFetchMedia();
	}

	// Open lightbox at specific media item
	function openLightbox(index: number, element?: HTMLElement) {
		if (lightbox) {
			lightbox.open(index, element);
		}
	}

	// Delete media function
	function openDeleteConfirm(media: MediaItem) {
		mediaToDelete = {
			id: media.id,
			filename: media.filename,
			url: media.url
		};
		showDeleteConfirm = true;
	}

	function closeDeleteConfirm() {
		showDeleteConfirm = false;
		mediaToDelete = null;
	}

	async function confirmDeleteMedia() {
		if (!mediaToDelete) return;

		const mediaToDeleteCopy = mediaToDelete; // Store in local variable for type safety

		try {
			deletingMediaId = mediaToDeleteCopy.id;
			deleteError = '';
			deleteSuccess = '';

			// Extract filename from URL (e.g., "/uploads/image.jpg" -> "image.jpg")
			const actualFilename = mediaToDeleteCopy.url.includes('/')
				? mediaToDeleteCopy.url.split('/').pop()
				: mediaToDeleteCopy.url;

			const response = await fetch('/api/media/delete', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ filename: actualFilename })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to delete media');
			}

			deleteSuccess = 'Media deleted successfully';

			// Remove the deleted item from the local state
			mediaItems = mediaItems.filter((item) => item.id !== mediaToDeleteCopy.id);

			// Clear success message after 3 seconds
			setTimeout(() => {
				deleteSuccess = '';
			}, 3000);
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'Failed to delete media';

			// Clear error message after 5 seconds
			setTimeout(() => {
				deleteError = '';
			}, 5000);
		} finally {
			deletingMediaId = null;
			closeDeleteConfirm();
		}
	}

	function toggleSelectMode() {
		isSelectMode = !isSelectMode;
		if (!isSelectMode) {
			selectedMediaIds.clear();
			isSelectAll = false;
		}
	}

	function toggleSelectAll() {
		if (isSelectAll) {
			selectedMediaIds.clear();
		} else {
			selectedMediaIds = new Set(mediaItems.map((item) => item.id));
		}
		isSelectAll = !isSelectAll;
	}

	function toggleMediaSelection(mediaId: string) {
		if (selectedMediaIds.has(mediaId)) {
			selectedMediaIds.delete(mediaId);
		} else {
			selectedMediaIds.add(mediaId);
		}
		selectedMediaIds = selectedMediaIds; // Trigger reactivity

		// Update select all state
		isSelectAll = selectedMediaIds.size === mediaItems.length;
	}

	function getSelectedCount(): number {
		return selectedMediaIds.size;
	}

	function getSelectedMedia(): MediaItem[] {
		return mediaItems.filter((item) => selectedMediaIds.has(item.id));
	}

	async function deleteSelectedMedia() {
		const selectedMedia = getSelectedMedia();
		if (selectedMedia.length === 0) return;

		const fileList = selectedMedia.map((m) => m.filename).join(', ');
		if (
			!confirm(
				`Are you sure you want to delete ${selectedMedia.length} selected item${selectedMedia.length > 1 ? 's' : ''}?\n\n${fileList}\n\nThis action cannot be undone.`
			)
		) {
			return;
		}

		try {
			deleteError = '';
			deleteSuccess = '';

			// Delete each selected media item
			const deletePromises = selectedMedia.map(async (media) => {
				const actualFilename = media.url.includes('/') ? media.url.split('/').pop() : media.url;

				const response = await fetch('/api/media/delete', {
					method: 'DELETE',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ filename: actualFilename })
				});

				if (!response.ok) {
					const result = await response.json();
					throw new Error(result.error || `Failed to delete ${media.filename}`);
				}

				return media.id;
			});

			const deletedIds = await Promise.all(deletePromises);

			// Remove deleted items from local state
			mediaItems = mediaItems.filter((item) => !deletedIds.includes(item.id));

			// Clear selection
			selectedMediaIds.clear();
			isSelectMode = false;
			isSelectAll = false;

			deleteSuccess = `Successfully deleted ${deletedIds.length} media item${deletedIds.length > 1 ? 's' : ''}`;

			// Clear success message after 3 seconds
			setTimeout(() => {
				deleteSuccess = '';
			}, 3000);
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'Failed to delete selected media';

			// Clear error message after 5 seconds
			setTimeout(() => {
				deleteError = '';
			}, 5000);
		}
	}

	// Handle keyboard events
	function handleKeydown(e: KeyboardEvent) {
		// BiggerPicture handles Escape key automatically
	}

	onMount(() => {
		fetchAccounts();
		fetchMedia();

		if (browser) {
			window.addEventListener('keydown', handleKeydown);

			// OPTIMIZATION: Use requestIdleCallback for non-critical Preline init
			const initPreline = () => {
				if (typeof window !== 'undefined' && window.HSStaticMethods) {
					window.HSStaticMethods.autoInit();
				}
			};
			
			if ('requestIdleCallback' in window) {
				(window as any).requestIdleCallback(initPreline);
			} else {
				setTimeout(initPreline, 100);
			}

			return () => {
				window.removeEventListener('keydown', handleKeydown);
			};
		}
	});

	onDestroy(() => {
		// OPTIMIZATION: Clean up debounced function
		debouncedFetchMedia.cancel();
	});
</script>

<svelte:head>
	<title>SchedX - Gallery</title>
	<meta name="description" content="View all uploaded media files" />
</svelte:head>

<div class="mx-auto max-w-5xl">
	<h1 class="mb-6 text-3xl font-bold text-gray-900 dark:text-white">Media Gallery</h1>

	<!-- Account Filter -->
	{#if accounts.length > 0}
		<div class="mb-6">
			<span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
				Filter by Account
			</span>
			<AccountDropdown
				accounts={accounts.map(acc => ({
					id: acc.id,
					username: acc.username,
					displayName: acc.displayName || acc.username,
					avatarUrl: acc.profileImage
				}))}
				selectedAccount={selectedAccountId}
				onSelect={handleAccountFilterChange}
				placeholder="All Accounts"
			/>
		</div>
	{/if}

	<!-- Upload Section -->
	<div class="mb-6">
		<button
			on:click={() => showUploadSection = !showUploadSection}
			class="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
		>
			<div class="flex items-center gap-3">
				<UploadIcon class="h-5 w-5 text-blue-600 dark:text-blue-400" />
				<span class="font-medium text-gray-900 dark:text-white">Upload Media</span>
			</div>
			<svg
				class="h-5 w-5 text-gray-500 transition-transform dark:text-gray-400"
				class:rotate-180={showUploadSection}
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if showUploadSection}
			<div class="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
				<FileUpload
					selectedAccountId={selectedAccountId}
					on:uploadComplete={() => {
						fetchMedia();
						showUploadSection = false;
					}}
				/>
			</div>
		{/if}
	</div>

	<!-- Delete Messages -->
	{#if deleteSuccess}
		<div
			class="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200"
		>
			<CheckCircle class="h-5 w-5" />
			<span>{deleteSuccess}</span>
		</div>
	{/if}

	{#if deleteError}
		<div
			class="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
		>
			<X class="h-5 w-5" />
			<span>{deleteError}</span>
		</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="flex items-center gap-2">
				<div
					class="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
				></div>
				<span class="text-gray-600 dark:text-gray-400">Loading media...</span>
			</div>
		</div>
	{:else if error}
		<div
			class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
		>
			<div class="flex items-center gap-2">
				<X class="h-5 w-5 text-red-600 dark:text-red-400" />
				<span class="text-red-800 dark:text-red-200">{error}</span>
			</div>
		</div>
	{:else if mediaItems.length === 0}
		<div
			class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="mx-auto mb-4 h-16 w-16 text-gray-400">
				<Search class="h-full w-full" />
			</div>
			<h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">No Media Found</h3>
			<p class="text-gray-600 dark:text-gray-400">
				Upload some media through the tweet creation process to see it here.
			</p>
		</div>
	{:else}
		<!-- Gallery Stats -->
		<div
			class="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
						{mediaItems.length} Media {mediaItems.length === 1 ? 'Item' : 'Items'}
						{#if selectedAccountId}
							<span class="text-sm font-normal text-gray-600 dark:text-gray-400">
								for {accounts.find((a) => a.id === selectedAccountId)?.displayName ||
									accounts.find((a) => a.id === selectedAccountId)?.username}
							</span>
						{/if}
					</h2>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						{#if selectedAccountId}
							Filtered by account
						{:else}
							All uploaded images and videos
						{/if}
					</p>
				</div>
				<div class="flex flex-wrap items-center gap-2 sm:gap-4">
					<!-- Media Type Stats -->
					<div class="flex gap-2">
						<span
							class="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-200 sm:px-3"
						>
							{mediaItems.filter((m) => m.type === 'photo' || m.type === 'gif').length} <span class="hidden xs:inline">Images</span><span class="xs:hidden">Img</span>
						</span>
						<span
							class="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/20 dark:text-purple-200 sm:px-3"
						>
							{mediaItems.filter((m) => m.type === 'video').length} <span class="hidden xs:inline">Videos</span><span class="xs:hidden">Vid</span>
						</span>
					</div>

					<!-- Multi-select Controls -->
					<div class="flex flex-wrap items-center gap-2">
						<button
							type="button"
							class="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
							on:click={toggleSelectMode}
							class:bg-blue-50={isSelectMode}
							class:border-blue-300={isSelectMode}
							class:text-blue-700={isSelectMode}
						>
							{#if isSelectMode}
								<span
									class="flex h-4 w-4 items-center justify-center rounded border-2 border-blue-600 bg-blue-600"
								>
									<svg class="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
											clip-rule="evenodd"
										/>
									</svg>
								</span>
								<span class="hidden sm:inline">Selection Mode</span>
								<span class="sm:hidden">Select</span>
							{:else}
								<span class="h-4 w-4 rounded border-2 border-gray-300"></span>
								<span class="hidden sm:inline">Select Mode</span>
								<span class="sm:hidden">Select</span>
							{/if}
						</button>

						{#if isSelectMode}
							<button
								type="button"
								class="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
								on:click={toggleSelectAll}
							>
								{#if isSelectAll}
									<span
										class="flex h-4 w-4 items-center justify-center rounded border-2 border-blue-600 bg-blue-600"
									>
										<svg class="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									</span>
									<span class="hidden sm:inline">Deselect All</span>
									<span class="sm:hidden">None</span>
								{:else}
									<span class="h-4 w-4 rounded border-2 border-gray-300"></span>
									<span class="hidden sm:inline">Select All</span>
									<span class="sm:hidden">All</span>
								{/if}
							</button>

							{#if getSelectedCount() > 0}
								<button
									type="button"
									class="flex items-center gap-1.5 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
									on:click={deleteSelectedMedia}
								>
									<Trash2 class="h-4 w-4" />
									<span class="hidden sm:inline">Delete Selected ({getSelectedCount()})</span>
									<span class="sm:hidden">Del ({getSelectedCount()})</span>
								</button>
							{/if}
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Masonry Gallery -->
		<div use:autoAnimate={{ duration: 200 }} class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
			{#each Array.from({ length: 4 }, (_, colIndex) => colIndex) as colIndex}
				<div class="space-y-2">
					{#each mediaItems.filter((_, index) => index % 4 === colIndex) as media, colMediaIndex}
						{@const mediaIndex = mediaItems.findIndex(m => m.id === media.id)}
						<div
							class="group relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 {selectedMediaIds.has(
								media.id
							)
								? 'ring-2 ring-blue-500 ring-offset-2'
								: ''}"
						>
							<!-- Selection Overlay -->
							{#if selectedMediaIds.has(media.id)}
								<div class="pointer-events-none absolute inset-0 z-10 bg-blue-500/20"></div>
							{/if}

							<!-- Selection Checkbox -->
							{#if isSelectMode}
								<div class="absolute left-2 top-2 z-20">
									<label
										class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-2 border-gray-300 bg-white/90 transition-colors hover:border-blue-500 dark:border-gray-600 dark:bg-gray-900/90 dark:hover:border-blue-400"
									>
										<input
											type="checkbox"
											class="sr-only"
											checked={selectedMediaIds.has(media.id)}
											on:change={() => toggleMediaSelection(media.id)}
										/>
										{#if selectedMediaIds.has(media.id)}
											<svg
												class="h-4 w-4 text-blue-600 dark:text-blue-400"
												fill="currentColor"
												viewBox="0 0 20 20"
											>
												<path
													fill-rule="evenodd"
													d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
													clip-rule="evenodd"
												/>
											</svg>
										{/if}
									</label>
								</div>
							{/if}

							<!-- Media Preview - OPTIMIZED with lazy loading -->
							{#if media.type === 'video'}
								<video
									class="h-auto w-full cursor-pointer object-cover"
									src={media.url}
									muted
									playsinline
									preload="none"
								></video>
							{:else}
								<img
									class="h-auto w-full cursor-pointer object-cover"
									src={media.url}
									alt={media.filename}
									loading="lazy"
									decoding="async"
								/>
							{/if}

							<!-- View Button Overlay -->
							<div
								class="absolute bottom-2 right-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
							>
								<div class="flex gap-2">
									<button
										class="flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-gray-800 shadow-lg backdrop-blur-sm transition hover:bg-white dark:bg-gray-900/90 dark:text-gray-200 dark:hover:bg-gray-900"
										on:click={(e) => openLightbox(mediaIndex)}
										aria-label="View {media.filename}"
									>
										<Search class="h-3 w-3" />
										<span>View</span>
									</button>

									<button
										class="flex items-center gap-1 rounded-lg bg-red-500/90 px-2 py-1 text-xs font-medium text-white shadow-lg backdrop-blur-sm transition hover:bg-red-600 dark:bg-red-600/90 dark:hover:bg-red-700"
										on:click={() => openDeleteConfirm(media)}
										disabled={deletingMediaId === media.id || isSelectMode}
										aria-label="Delete {media.filename}"
									>
										{#if deletingMediaId === media.id}
											<Loader2 class="h-3 w-3 animate-spin" />
										{:else}
											<Trash2 class="h-3 w-3" />
										{/if}
										<span>Delete</span>
									</button>
								</div>
							</div>

							<!-- Media Type Badge -->
							<div class="absolute top-2 {isSelectMode ? 'left-12' : 'left-2'}">
								<span
									class="rounded-full px-2 py-1 text-xs font-medium text-white shadow-lg {media.type ===
									'video'
										? 'bg-purple-600'
										: media.type === 'gif'
											? 'bg-pink-600'
											: 'bg-blue-600'}"
								>
									{media.type === 'video' ? 'VIDEO' : media.type === 'gif' ? 'GIF' : 'IMAGE'}
								</span>
							</div>

							<!-- Account Badge (if not filtering by account) -->
							{#if !selectedAccountId && media.accountId}
								<div class="absolute right-2 top-2">
									<span
										class="rounded-full bg-gray-800/80 px-2 py-1 text-xs font-medium text-white shadow-lg backdrop-blur-sm"
									>
										{accounts.find((a) => a.id === media.accountId)?.username || 'Unknown'}
									</span>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- MediaLightbox Component -->
<MediaLightbox bind:this={lightbox} {mediaItems} />

<!-- Image Editor Modal -->

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && mediaToDelete}
	<div
		class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-200"
		on:click={closeDeleteConfirm}
		role="button"
		tabindex="0"
		on:keydown={(e) => e.key === 'Enter' && closeDeleteConfirm()}
	>
		<div
			class="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900"
			on:click|stopPropagation
			role="dialog"
			tabindex="-1"
			on:keydown={(e) => e.key === 'Escape' && closeDeleteConfirm()}
		>
			<!-- Header -->
			<div class="mb-4 flex items-center gap-3">
				<div
					class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20"
				>
					<Trash2 class="h-5 w-5 text-red-600 dark:text-red-400" />
				</div>
				<div>
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Delete Media</h3>
					<p class="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone</p>
				</div>
			</div>

			<!-- Content -->
			<div class="mb-6">
				<p class="text-gray-700 dark:text-gray-300">
					Are you sure you want to delete <span class="font-medium text-gray-900 dark:text-white"
						>"{mediaToDelete.filename}"</span
					>?
				</p>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					This will permanently remove the file from your media library.
				</p>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-3">
				<button
					type="button"
					class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-900"
					on:click={closeDeleteConfirm}
					disabled={deletingMediaId === mediaToDelete.id}
				>
					Cancel
				</button>
				<button
					type="button"
					class="rounded-lg border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-900"
					on:click={confirmDeleteMedia}
					disabled={deletingMediaId === mediaToDelete.id}
				>
					{#if deletingMediaId === mediaToDelete.id}
						<Loader2 class="mr-2 inline h-4 w-4 animate-spin" />
						Deleting...
					{:else}
						Delete
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
