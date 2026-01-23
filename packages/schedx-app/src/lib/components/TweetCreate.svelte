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
	import FileUpload from '$lib/components/FileUpload.svelte';
	import AIGenerator from '$lib/components/AIGenerator.svelte';
	import DateTimePicker from '$lib/components/DateTimePicker.svelte';
	import StyledSelect from '$lib/components/StyledSelect.svelte';
	import CharacterCounter from '$lib/components/CharacterCounter.svelte';
	import { CheckCircle, XCircle, Loader2, Save, FileText, ListPlus, Calendar, Send, Sparkles, ChevronDown } from 'lucide-svelte';
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
	export const loading = false;
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
	let fileUploadComponent: any;
	let tweetMedia: { url: string; type: string }[] = [];
	
	// AI Generator state
	let showAIGenerator = false;
	let aiEnabled = false;

	// Action dropdown state
	let showActionDropdown = false;
	let actionDropdownRef: HTMLDivElement;

	// Schedule conflict state
	let scheduleConflict: { id: string; content: string; scheduledDate: string } | null = null;
	let conflictCheckTimeout: any = null;

	// Close dropdown when clicking outside
	function handleDropdownClickOutside(event: MouseEvent) {
		if (showActionDropdown && actionDropdownRef && !actionDropdownRef.contains(event.target as Node)) {
			showActionDropdown = false;
		}
	}

	// Set quick schedule preset
	function setQuickSchedule(preset: string) {
		const now = new Date();
		let targetDate: Date;

		switch (preset) {
			case 'in-1-hour':
				targetDate = new Date(now.getTime() + 60 * 60 * 1000);
				break;
			case 'tomorrow-9am':
				targetDate = new Date(now);
				targetDate.setDate(targetDate.getDate() + 1);
				targetDate.setHours(9, 0, 0, 0);
				break;
			case 'tomorrow-12pm':
				targetDate = new Date(now);
				targetDate.setDate(targetDate.getDate() + 1);
				targetDate.setHours(12, 0, 0, 0);
				break;
			case 'tomorrow-6pm':
				targetDate = new Date(now);
				targetDate.setDate(targetDate.getDate() + 1);
				targetDate.setHours(18, 0, 0, 0);
				break;
			case 'next-monday-9am':
				targetDate = new Date(now);
				const daysUntilMonday = (8 - now.getDay()) % 7 || 7; // Next Monday
				targetDate.setDate(targetDate.getDate() + daysUntilMonday);
				targetDate.setHours(9, 0, 0, 0);
				break;
			default:
				return;
		}

		scheduledDate = targetDate.toISOString();
		checkConflict(scheduledDate);
	}

	// Check for schedule conflicts
	async function checkConflict(dateStr: string) {
		if (!dateStr || !selectedAccountId) {
			scheduleConflict = null;
			return;
		}

		// Debounce conflict checking
		if (conflictCheckTimeout) {
			clearTimeout(conflictCheckTimeout);
		}

		conflictCheckTimeout = setTimeout(async () => {
			try {
				if (!selectedAccountId) {
					scheduleConflict = null;
					return;
				}
				
				const params = new URLSearchParams({
					date: dateStr,
					accountId: selectedAccountId
				});
				
				if (tweetId) {
					params.append('excludeTweetId', tweetId);
				}

				const response = await fetch(`/api/tweets/check-conflict?${params}`);
				if (response.ok) {
					const data = await response.json();
					scheduleConflict = data.hasConflict ? data.conflictingTweet : null;
				}
			} catch (err) {
				logger.debug('Failed to check conflict:', err instanceof Error ? { error: err.message } : undefined);
				scheduleConflict = null;
			}
		}, 300);
	}

	// Track if form has unsaved changes
	$: hasUnsavedChanges = tweetContent.trim().length > 0 || tweetMedia.length > 0 || scheduledDate !== '';

	// Unsaved changes warning handler
	function handleBeforeUnload(event: BeforeUnloadEvent) {
		if (hasUnsavedChanges && !submitting) {
			event.preventDefault();
			event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
			return event.returnValue;
		}
	}
	
	// Check if OpenRouter AI is enabled
	async function checkAIEnabled() {
		try {
			const response = await fetch('/api/admin/openrouter');
			if (response.ok) {
				const data = await response.json();
				aiEnabled = data.settings?.enabled || false;
			}
		} catch (err) {
			logger.debug('Failed to check AI status:', err instanceof Error ? { error: err.message } : undefined);
			aiEnabled = false;
		}
	}
	
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
			window.addEventListener('click', handleDropdownClickOutside, true);
			window.addEventListener('beforeunload', handleBeforeUnload);

			// Wait for Preline to be ready, then initialize
			waitForPrelineInit(() => window.HSStaticMethods.autoInit());

			// Set initial date if provided
			if (initialDate) {
				scheduledDate = new Date(initialDate).toISOString();
			}
			
			// Check if AI is enabled
			await checkAIEnabled();
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
			window.removeEventListener('click', handleDropdownClickOutside, true);
			window.removeEventListener('beforeunload', handleBeforeUnload);
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

	function handleAIGenerated(event: CustomEvent<string>) {
		tweetContent = event.detail;
		charCount = tweetContent.length;
		dispatch('contentInput', tweetContent);
		
		// Focus the textarea after inserting AI content
		if (textareaEl) {
			textareaEl.focus();
		}
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
		<div class="mb-2">
			<CharacterCounter current={charCount} max={280} warningThreshold={260} dangerThreshold={280} />
		</div>
	</div>
	<textarea
		id="tweet-content"
		class="block w-full rounded-lg border-2 border-gray-300 bg-white px-3 pb-12 pt-2 shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 sm:px-4 sm:pb-12 sm:pt-3 sm:text-sm"
		rows="4"
		maxlength="280"
		placeholder="What's happening?"
		bind:value={tweetContent}
		on:input={handleContentInput}
		bind:this={textareaEl}
		disabled={submitting}
	></textarea>
	<div class="absolute bottom-3 right-3 flex gap-1.5">
		{#if aiEnabled}
			<button
				type="button"
				class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm transition-all hover:scale-105 hover:shadow-md"
				on:click={() => (showAIGenerator = true)}
				aria-label="AI Suggestions"
				title="AI Tweet Suggestions"
				disabled={submitting}
			>
				<Sparkles class="h-4 w-4" />
			</button>
		{/if}
		<button
			type="button"
			class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xl transition-colors hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500"
			on:click={() => (showEmojiPicker = !showEmojiPicker)}
			aria-label="Add emoji"
			disabled={submitting}
		>
			😊
		</button>
	</div>
	{#if showEmojiPicker}
		<div class="absolute right-0 top-full z-50 mt-2" bind:this={emojiPickerElement}>
			<emoji-picker on:emoji-click={handleEmojiSelect}></emoji-picker>
		</div>
	{/if}
</div>

<!-- Schedule Date with Quick Presets -->
<div class="mb-4">
	<div class="flex flex-col gap-4 sm:flex-row">
		<!-- Schedule Date -->
		<DateTimePicker
			label="Schedule Date"
			placeholder="Choose date and time"
			bind:value={scheduledDate}
			disabled={submitting}
			on:change={(e) => {
				scheduledDate = e.detail;
				checkConflict(e.detail);
			}}
		/>
		<!-- Recurrence -->
		<div class="flex-1">
			<span class="mb-2 block text-sm font-medium dark:text-white">Recurrence</span>
			<StyledSelect
				id="recurrence"
				bind:value={recurrence}
				options={[
					{ value: '', label: 'None' },
					{ value: 'daily', label: 'Daily' },
					{ value: 'weekly', label: 'Weekly' },
					{ value: 'monthly', label: 'Monthly' }
				]}
				placeholder="Select recurrence"
			/>
		</div>
	</div>
	
	<!-- Quick Schedule Presets -->
	<div class="mt-3">
		<span class="mb-2 block text-xs font-medium text-gray-500 dark:text-gray-400">Quick Schedule</span>
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
				on:click={() => setQuickSchedule('in-1-hour')}
				disabled={submitting}
			>
				In 1 hour
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
				on:click={() => setQuickSchedule('tomorrow-9am')}
				disabled={submitting}
			>
				Tomorrow 9 AM
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
				on:click={() => setQuickSchedule('tomorrow-12pm')}
				disabled={submitting}
			>
				Tomorrow 12 PM
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
				on:click={() => setQuickSchedule('tomorrow-6pm')}
				disabled={submitting}
			>
				Tomorrow 6 PM
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
				on:click={() => setQuickSchedule('next-monday-9am')}
				disabled={submitting}
			>
				Next Monday 9 AM
			</button>
		</div>
	</div>
	
	<!-- Conflict Warning -->
	{#if scheduleConflict}
		<div class="mt-3 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
			<svg class="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
			</svg>
			<div>
				<p class="font-medium">Schedule Conflict</p>
				<p class="mt-1 text-xs opacity-80">Another tweet is already scheduled at this time: "{scheduleConflict.content}"</p>
			</div>
		</div>
	{/if}
</div>

<!-- File Upload -->
<FileUpload
	bind:this={fileUploadComponent}
	on:changeMedia={(e) => handleMediaUploaded(e.detail)}
	disabled={submitting}
	{selectedAccountId}
	initialMedia={tweetMedia}
/>

<!-- Button Group - Primary action with dropdown for secondary actions -->
<div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
	{#if mode === 'schedule' || mode === 'edit'}
		<button
			type="button"
			class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
			on:click={() => handleSubmit(mode === 'edit' ? 'update' : 'schedule')}
			disabled={submitting}
		>
			{#if submitting && (currentAction === 'schedule' || currentAction === 'update')}
				<Loader2 class="h-5 w-5 animate-spin" />
			{:else}
				<Calendar class="h-5 w-5" />
			{/if}
			{mode === 'edit' ? 'Update Schedule' : 'Schedule Tweet'}
		</button>
	{:else}
		<!-- Primary Action: Schedule (most common use case) -->
		<button
			type="button"
			class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
			on:click={() => handleSubmit('schedule')}
			disabled={submitting}
		>
			{#if submitting && currentAction === 'schedule'}
				<Loader2 class="h-5 w-5 animate-spin" />
			{:else}
				<Calendar class="h-5 w-5" />
			{/if}
			Schedule Tweet
		</button>
		
		<!-- Secondary Actions Dropdown -->
		<div class="relative" bind:this={actionDropdownRef}>
			<button
				type="button"
				class="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-3.5 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:w-auto w-full"
				on:click={() => showActionDropdown = !showActionDropdown}
				disabled={submitting}
				aria-expanded={showActionDropdown}
				aria-haspopup="true"
			>
				More Actions
				<ChevronDown class="h-4 w-4 transition-transform duration-200 {showActionDropdown ? 'rotate-180' : ''}" />
			</button>
			
			{#if showActionDropdown}
				<div class="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-xl border border-gray-200 bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:border-gray-700 dark:bg-gray-800 animate-in fade-in slide-in-from-top-2 duration-150">
					<div class="p-1">
						<!-- Publish Now -->
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-green-50 dark:text-gray-200 dark:hover:bg-green-900/20"
							on:click={() => { showActionDropdown = false; handleSubmit('publish'); }}
							disabled={submitting}
						>
							<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
								{#if submitting && currentAction === 'publish'}
									<Loader2 class="h-4 w-4 animate-spin text-green-600 dark:text-green-400" />
								{:else}
									<Send class="h-4 w-4 text-green-600 dark:text-green-400" />
								{/if}
							</div>
							<div class="text-left">
								<div class="font-medium">Publish Now</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">Post immediately</div>
							</div>
						</button>
						
						<!-- Save Draft -->
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-purple-50 dark:text-gray-200 dark:hover:bg-purple-900/20"
							on:click={() => { showActionDropdown = false; handleSubmit('draft'); }}
							disabled={submitting}
						>
							<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
								{#if submitting && currentAction === 'draft'}
									<Loader2 class="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
								{:else}
									<Save class="h-4 w-4 text-purple-600 dark:text-purple-400" />
								{/if}
							</div>
							<div class="text-left">
								<div class="font-medium">Save Draft</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">Save for later editing</div>
							</div>
						</button>
						
						<!-- Add to Queue -->
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-orange-50 dark:text-gray-200 dark:hover:bg-orange-900/20"
							on:click={() => { showActionDropdown = false; handleSubmit('queue'); }}
							disabled={submitting}
						>
							<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
								{#if submitting && currentAction === 'queue'}
									<Loader2 class="h-4 w-4 animate-spin text-orange-600 dark:text-orange-400" />
								{:else}
									<ListPlus class="h-4 w-4 text-orange-600 dark:text-orange-400" />
								{/if}
							</div>
							<div class="text-left">
								<div class="font-medium">Add to Queue</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">Auto-schedule later</div>
							</div>
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- AI Generator Modal -->
<AIGenerator 
	bind:show={showAIGenerator} 
	currentContent={tweetContent}
	on:use={handleAIGenerated}
/>
