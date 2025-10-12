<script context="module" lang="ts">
	export type TweetAccount = {
		id: string;
		username: string;
		displayName?: string;
		profileImage?: string;
	};
</script>

<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy, afterUpdate } from 'svelte';
	import flatpickr from 'flatpickr';
	import 'flatpickr/dist/flatpickr.css';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import { CheckCircle, XCircle, Loader2, Save, FileText, ListPlus, Calendar, Send } from 'lucide-svelte';
	import logger from '$lib/logger';
	import { toastStore } from '$lib/stores/toastStore';

	const dispatch = createEventDispatcher();
	export let accounts: TweetAccount[] = [];
	export let selectedAccountId: string | null = null;
	export let initialContent = '';
	export let initialMedia: File[] | { url: string; type: string }[] = [];
	export let initialDate = '';
	export let mode: 'create' | 'edit' | 'schedule' = 'create';
	export let tweetId: string | null = null;
	export let loading = false;
	export let maxUploadSize: number = 52428800; // fallback to 50MB
	let maxUploadMB = (maxUploadSize / (1024 * 1024)).toFixed(0);

	let tweetContent = initialContent;
	let charCount = tweetContent.length;
	let selectedAccount = selectedAccountId;
	let scheduledDate = '';
	let recurrence = '';
	let submitting = false;
	let currentAction = '';

	// Emoji picker state
	let showEmojiPicker = false;
	let emojiPickerElement: HTMLElement;
	let textareaEl: HTMLTextAreaElement;
	let dateInputEl: HTMLInputElement;
	let fileUploadComponent: any;
	let flatpickrInstance: any = null;
	let tweetMedia: { url: string; type: string }[] = [];
	
	// Initialize media from initialMedia prop for edit mode
	$: if (mode === 'edit' && initialMedia && initialMedia.length > 0 && tweetMedia.length === 0) {
		tweetMedia = initialMedia as any;
		logger.debug('Initialized tweetMedia from initialMedia:', tweetMedia);
	}

	function handleEmojiSelect(event: CustomEvent) {
		const emoji = event.detail.unicode;
		// Insert emoji at cursor position
		if (textareaEl) {
			const start = textareaEl.selectionStart;
			const end = textareaEl.selectionEnd;
			tweetContent = tweetContent.slice(0, start) + emoji + tweetContent.slice(end);
			charCount = tweetContent.length;
			// Move cursor after inserted emoji
			setTimeout(() => {
				textareaEl.focus();
				textareaEl.selectionStart = textareaEl.selectionEnd = start + emoji.length;
			}, 0);
		} else {
			tweetContent += emoji;
			charCount = tweetContent.length;
		}
		showEmojiPicker = false;
		// Always dispatch content change event for preview, regardless of account status
		dispatch('contentInput', tweetContent);
	}

	function handleClickOutside(event: MouseEvent) {
		if (
			showEmojiPicker &&
			emojiPickerElement &&
			!emojiPickerElement.contains(event.target as Node)
		) {
			showEmojiPicker = false;
		}
	}

	function waitForPrelineInit(callback: () => void, retries = 10) {
		if (typeof window !== 'undefined' && window.HSStaticMethods) {
			callback();
		} else if (retries > 0) {
			setTimeout(() => waitForPrelineInit(callback, retries - 1), 100);
		}
	}

	onMount(async () => {
		if (typeof window !== 'undefined') {
			await import('emoji-picker-element');
			window.addEventListener('click', handleClickOutside, true);

			// Wait for Preline to be ready, then initialize
			waitForPrelineInit(() => window.HSStaticMethods.autoInit());

			if (dateInputEl) {
				flatpickrInstance = flatpickr(dateInputEl, {
					enableTime: true,
					dateFormat: 'M j, Y h:i K',
					defaultDate: initialDate,
					onChange: (selectedDates) => {
						scheduledDate = selectedDates[0]?.toISOString() ?? '';
					}
				});
			}
		}

		// Load initial media for edit mode
		if (mode === 'edit' && initialMedia && initialMedia.length > 0) {
			tweetMedia = initialMedia as any;
			logger.debug('Loaded initial media for edit mode:', tweetMedia);
		}
	});

	afterUpdate(() => {
		waitForPrelineInit(() => window.HSStaticMethods.autoInit());
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('click', handleClickOutside, true);
		}
	});

	function handleAccountSelect(id: string) {
		selectedAccountId = id;
		dispatch('accountChange', id);
	}

	function handleContentInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		tweetContent = target.value;
		charCount = tweetContent.length;
		// Always dispatch content changes for preview, regardless of account status
		dispatch('contentInput', tweetContent);
	}

	function handleMediaUploaded(media: { url: string; type: string }[]) {
		logger.debug('TweetCreate handleMediaUploaded received:', media);
		// Validate media array before setting it
		if (Array.isArray(media)) {
			tweetMedia = media.filter(
				(item) =>
					item &&
					typeof item === 'object' &&
					typeof item.url === 'string' &&
					typeof item.type === 'string'
			);
		} else {
			tweetMedia = [];
		}
		logger.debug('TweetCreate tweetMedia updated to:', tweetMedia);
		// Always dispatch media changes for preview, regardless of account status
		dispatch('changeMedia', tweetMedia);
		logger.debug('TweetCreate dispatched changeMedia:', tweetMedia);
	}

	// Success messages for different actions
	const successMessages: Record<string, string> = {
		publish: 'Tweet published successfully!',
		draft: 'Tweet saved as draft successfully!',
		schedule: 'Tweet scheduled successfully!',
		queue: 'Tweet added to queue successfully!',
		update: 'Scheduled tweet updated successfully!'
	};

	// Error messages for different actions
	const errorMessages: Record<string, string> = {
		publish: 'Failed to publish tweet',
		draft: 'Failed to save draft',
		schedule: 'Failed to schedule tweet',
		queue: 'Failed to add tweet to queue',
		update: 'Failed to update scheduled tweet'
	};

	async function handleSubmit(action: string) {
		// Only require account selection for actual submission, not for preview functionality
		if (!selectedAccountId) {
			toastStore.error(
				'Account Required',
				'Please select an account to save or publish your tweet'
			);
			return;
		}

		if (!tweetContent.trim()) {
			toastStore.error('Content Required', 'Please enter tweet content');
			return;
		}

		if (action === 'schedule' && !scheduledDate) {
			toastStore.error('Date Required', 'Please select a scheduled date');
			return;
		}

		submitting = true;
		currentAction = action;

		try {
			// Ensure tweetMedia is a valid array - keep relative URLs for server-side processing
			const validMedia = Array.isArray(tweetMedia) ? tweetMedia.map((m) => ({ ...m })) : [];

			// Prepare payload with proper data types
			const payload: any = {
				action,
				content: tweetContent,
				accountId: selectedAccountId,
				media: validMedia
			};

			// Only include scheduledDate if it has a value
			if (scheduledDate && scheduledDate.trim() !== '') {
				payload.scheduledDate = scheduledDate;
			}

			// Only include recurrence if it's not empty and action is schedule
			if (recurrence && recurrence.trim() !== '' && action === 'schedule') {
				payload.recurrence = {
					type: recurrence
				};
			}

			const url = mode === 'edit' ? `/api/tweets/${tweetId}` : '/api/tweets';
			const method = mode === 'edit' ? 'PUT' : 'POST';

			const response = await fetch(url, {
				method,
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || errorMessages[action] || 'Failed to save tweet');
			}

			// Show success toast with specific message and View Tweet action for published tweets
			if (action === 'publish' && result.tweetUrl) {
				toastStore.success(result.message || successMessages[action] || 'Tweet published successfully!', '', {
					actions: [
						{
							label: 'View Tweet',
							url: result.tweetUrl,
							target: '_blank',
							variant: 'primary'
						}
					],
					duration: 8000 // Show longer for published tweets
				});
			} else {
				toastStore.success(result.message || successMessages[action] || 'Tweet saved successfully!');
			}

			// Clear form on success for all actions
			tweetContent = '';
			charCount = 0;
			tweetMedia = [];
			scheduledDate = '';
			recurrence = '';
			
			// Clear flatpickr date picker
			if (flatpickrInstance) {
				flatpickrInstance.clear();
			}
			
			// Clear file upload component
			if (fileUploadComponent && typeof fileUploadComponent.clearFiles === 'function') {
				fileUploadComponent.clearFiles();
			}
			
			// Dispatch empty content to clear preview
			dispatch('contentInput', '');
			dispatch('changeMedia', []);

			// Dispatch success event
			dispatch('submit', {
				action,
				success: true,
				id: result.id,
				message: result.message
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : errorMessages[action] || 'Failed to save tweet';

			// Show error toast with specific message
			toastStore.error(errorMessages[action] || 'Operation Failed', errorMessage);

			// Log error to console for debugging
			logger.error('Tweet submission');

			// Dispatch error event
			dispatch('submit', {
				action,
				success: false,
				error: errorMessage
			});
		} finally {
			submitting = false;
			currentAction = '';
		}
	}
</script>

<!-- Enhanced Account Selector with Avatars -->
<div class="mb-4" role="group" aria-labelledby="account-selector-label">
	<div id="account-selector-label" class="mb-3 block text-sm font-medium dark:text-white">Select Account</div>
	<div class="flex flex-wrap gap-3">
		{#each accounts as account}
			<div class="group relative">
				<button
					type="button"
					class="relative rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
					on:click={() => handleAccountSelect(account.id)}
					aria-label="Select account {account.displayName || account.username}"
					aria-pressed={selectedAccountId === account.id}
				>
					<img
						class="border-3 inline-block size-12 rounded-full {selectedAccountId === account.id
							? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
							: 'border-gray-200 dark:border-gray-600'} transition-all duration-200 hover:scale-110 hover:shadow-lg"
						src={account.profileImage || '/avatar.png'}
						alt=""
						title={account.displayName || account.username}
					/>
					<!-- Selected indicator -->
					{#if selectedAccountId === account.id}
						<div
							class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500"
						>
							<svg class="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
								<path
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
								/>
							</svg>
						</div>
					{/if}
				</button>
				<!-- Tooltip -->
				<div
					class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 transform whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100"
				>
					<div class="font-medium">{account.displayName || account.username}</div>
					<div class="text-gray-300">@{account.username}</div>
					<!-- Tooltip arrow -->
					<div
						class="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 transform border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"
					></div>
				</div>
			</div>
		{/each}
	</div>
	{#if accounts.length === 0}
		<div class="text-sm italic text-gray-500 dark:text-gray-400">
			No Twitter accounts connected. <a
				href="/accounts"
				class="text-blue-600 hover:underline dark:text-blue-400">Connect an account</a
			> to get started.
		</div>
	{/if}
</div>

<!-- Text Area with Character Hint and Emoji Picker -->
<div class="relative mb-4 w-full">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<label for="tweet-content" class="mb-2 block text-sm font-medium dark:text-white">Tweet</label>
		<span class="mb-2 block text-sm text-gray-500 dark:text-neutral-500">{charCount}/280</span>
	</div>
	<textarea
		id="tweet-content"
		class="block w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 sm:px-4 sm:py-3 sm:text-sm"
		rows="3"
		maxlength="280"
		placeholder="What's happening?"
		bind:value={tweetContent}
		on:input={handleContentInput}
		bind:this={textareaEl}
		disabled={submitting}
	></textarea>
	<button
		type="button"
		class="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xl transition-colors hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500"
		on:click={() => (showEmojiPicker = !showEmojiPicker)}
		aria-label="Add emoji"
		disabled={submitting}
	>
		😊
	</button>
	{#if showEmojiPicker}
		<div class="absolute right-0 top-full z-50 mt-2" bind:this={emojiPickerElement}>
			<emoji-picker on:emoji-click={handleEmojiSelect}></emoji-picker>
		</div>
	{/if}
</div>

<!-- Calendar  -->
<div class="mb-4 flex flex-col gap-4 sm:flex-row">
	<!-- Schedule Date -->
	<div class="flex-1 min-w-0">
		<label for="schedule-date" class="mb-2 block text-sm font-medium dark:text-white"
			>Schedule Date</label
		>
		<input
			id="schedule-date"
			type="text"
			class="block w-full min-w-0 truncate rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
			bind:this={dateInputEl}
			placeholder="Select date and time"
			readonly
			disabled={submitting}
		/>
	</div>
	<!-- Recurrence -->
	<div class="flex-1 min-w-0">
		<label for="recurrence" class="mb-2 block text-sm font-medium dark:text-white">Recurrence</label
		>
		<select
			id="recurrence"
			class="block w-full min-w-0 rounded-lg border-2 border-gray-300 bg-white px-3 py-2 shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
			bind:value={recurrence}
			disabled={submitting}
		>
			<option value="">None</option>
			<option value="daily">Daily</option>
			<option value="weekly">Weekly</option>
			<option value="monthly">Monthly</option>
		</select>
	</div>
</div>

<!-- File Upload -->
<FileUpload
	bind:this={fileUploadComponent}
	on:changeMedia={(e) => handleMediaUploaded(e.detail)}
	disabled={submitting}
	{selectedAccountId}
	initialMedia={tweetMedia}
/>

<!-- Button Group (responsive grid: vertical stack on mobile, 2x2 grid on desktop) -->
<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
	{#if mode === 'schedule' || mode === 'edit'}
		<button
			type="button"
			class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
			on:click={() => handleSubmit(mode === 'edit' ? 'update' : 'schedule')}
			disabled={submitting}
		>
			{#if submitting && (currentAction === 'schedule' || currentAction === 'update')}
				<Loader2 class="h-5 w-5 animate-spin" />
			{:else}
				<Calendar class="h-5 w-5" />
			{/if}
			{mode === 'edit' ? 'Update Schedule' : 'Schedule'}
		</button>
	{:else}
		<!-- Publish Now (Green) -->
		<button
			type="button"
			class="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-green-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
			on:click={() => handleSubmit('publish')}
			disabled={submitting}
		>
			{#if submitting && currentAction === 'publish'}
				<Loader2 class="h-5 w-5 animate-spin" />
			{:else}
				<Send class="h-5 w-5" />
			{/if}
			Publish Now
		</button>
		
		<!-- Draft (Purple) -->
		<button
			type="button"
			class="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-purple-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
			on:click={() => handleSubmit('draft')}
			disabled={submitting}
		>
			{#if submitting && currentAction === 'draft'}
				<Loader2 class="h-5 w-5 animate-spin" />
			{:else}
				<Save class="h-5 w-5" />
			{/if}
			Save Draft
		</button>
		
		<!-- Schedule (Blue) -->
		<button
			type="button"
			class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
			on:click={() => handleSubmit('schedule')}
			disabled={submitting}
		>
			{#if submitting && currentAction === 'schedule'}
				<Loader2 class="h-5 w-5 animate-spin" />
			{:else}
				<Calendar class="h-5 w-5" />
			{/if}
			Schedule
		</button>
		
		<!-- Queue (Orange) -->
		<button
			type="button"
			class="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-orange-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
			on:click={() => handleSubmit('queue')}
			disabled={submitting}
		>
			{#if submitting && currentAction === 'queue'}
				<Loader2 class="h-5 w-5 animate-spin" />
			{:else}
				<ListPlus class="h-5 w-5" />
			{/if}
			Add to Queue
		</button>
	{/if}
</div>
