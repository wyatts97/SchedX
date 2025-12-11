<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import TweetCreate from '$lib/components/TweetCreate.svelte';
	import TweetPreview from '$lib/components/TweetPreview.svelte';
	import AccountDropdown from '$lib/components/AccountDropdown.svelte';
	import { AlertTriangle, CheckCircle, XCircle, Edit, Trash2, X, Calendar as CalendarIcon } from 'lucide-svelte'; // Icon for warning/alert messages
	import ScheduleXCalendar from '$lib/components/ScheduleXCalendar.svelte';
	import type { Tweet } from '@schedx/shared-lib/types/types';

	export let data: PageData;
	export let form: ActionData | null | undefined = null;

	let selectedAccountId: string =
		data.selectedAccountId ??
		(data.accounts && data.accounts.length > 0 ? data.accounts[0]?.providerAccountId : '') ??
		'';
	let showModal = false;
	let modalDate: string | null = null;
	let modalSelectedAccountId = '';
	let modalSubmitMessage = '';
	let modalSubmitType: 'success' | 'error' = 'success';

	// Edit modal state
	let showEditTweetModal = false;
	let editingTweet: Tweet | null = null;

	onMount(() => {
		if (browser) {
			const initPreline = () => {
				if (typeof window !== 'undefined' && window.HSStaticMethods) {
					window.HSStaticMethods.autoInit();
				}
			};
			setTimeout(initPreline, 100);
			setTimeout(initPreline, 500);
			setTimeout(initPreline, 1000);
		}
	});

	function handleAccountChange(accountId: string) {
		selectedAccountId = accountId;
		// Don't reload page, just update filter
	}

	function handleEditTweet(tweet: Tweet) {
		editingTweet = tweet;
		showEditTweetModal = true;
	}

	function handleCloseEditModal() {
		showEditTweetModal = false;
		editingTweet = null;
	}

	async function handleTweetUpdate() {
		showEditTweetModal = false;
		editingTweet = null;
		// Refresh the data
		await invalidateAll();
	}

	async function handleReschedule(detail: { tweetId: string; newDate: Date }) {
		const formData = new FormData();
		formData.append('tweetId', detail.tweetId);
		formData.append('newDate', detail.newDate.toISOString());

		try {
			const response = await fetch('?/rescheduleTweet', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();
			
			if (result.type === 'success') {
				await invalidateAll();
			} else {
				alert(`Error: ${result.data?.error || 'Failed to reschedule tweet'}`);
			}
		} catch (error) {
			alert(`Error: ${error instanceof Error ? error.message : 'Failed to reschedule tweet'}`);
		}
	}

	function handleModalSubmit(e: any) {
		const { action, success, message, error } = e.detail;

		if (success) {
			modalSubmitMessage =
				message || `${action.charAt(0).toUpperCase() + action.slice(1)} saved successfully!`;
			modalSubmitType = 'success';

			// Close modal and refresh data after successful submission
			setTimeout(() => {
				showModal = false;
				modalSubmitMessage = '';
				invalidateAll(); // Refresh the page data
			}, 2000);
		} else {
			modalSubmitMessage = error || 'Failed to save tweet';
			modalSubmitType = 'error';
		}

		// Clear message after 5 seconds
		setTimeout(() => {
			modalSubmitMessage = '';
		}, 5000);
	}

	// Reactive statement to refresh data when form action is successful
	$: if (form?.success) {
		alert('Tweet deleted successfully!'); // Or use a more sophisticated notification
		invalidateAll(); // Refreshes all data, causing the list to update
		form = null; // Reset form state
	}

	$: if (form?.error) {
		alert(`Error: ${form.error}`);
		form = null; // Reset form state
	}

	function handleDelete(tweetId: string) {
		if (!confirm('Are you sure you want to delete this scheduled tweet? This action cannot be undone.')) {
			return;
		}

		const formData = new FormData();
		formData.append('tweetId', tweetId);

		fetch('?/deleteTweet', {
			method: 'POST',
			body: formData
		})
			.then((response) => response.json())
			.then((result) => {
				if (result.status === 200) {
					invalidateAll();
					alert('Tweet deleted successfully!');
				} else {
					alert(`Error: ${result.error}`);
				}
			})
			.catch((error) => {
				alert(`Error: ${error.message}`);
			});
	}

	// Note: Calendar navigation and date selection is now handled by the Calendar component itself
	// The old calendar helper functions have been removed
	function closeModal() {
		showModal = false;
		modalDate = null;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && showModal) {
			closeModal();
		}
	}

	// Note: Drag-and-drop rescheduling has been removed in favor of the edit button workflow
</script>

<svelte:head>
	<title>SchedX - Scheduled</title>
	<meta name="description" content="View and manage your scheduled tweets" />
</svelte:head>

<div class="mx-auto max-w-3xl">
	<h1 class="mb-6 text-3xl font-bold">Your Scheduled Tweets</h1>

	{#if !(data as any).accounts || (data as any).accounts.length === 0}
		<div
			class="theme-dark:bg-[#253341] theme-dark:border-[#38444d] theme-dark:text-[#8899a6] mb-4 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
		>
			<AlertTriangle class="h-6 w-6 shrink-0 stroke-current" />
			<span
				>No Twitter apps configured. Please configure Twitter API credentials in <a
					href="/"
					class="theme-dark:text-[#1da1f2] text-blue-600 hover:underline dark:text-blue-400"
					>Dashboard</a
				> first.</span
			>
		</div>
	{/if}

	<!-- Filters -->
	{#if data.accounts && data.accounts.length > 0}
		<div class="mb-6">
			<!-- Account Filter -->
			<div class="max-w-xs">
				<span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
					Filter by Account
				</span>
				<AccountDropdown
					accounts={data.accounts.map(acc => ({
						id: acc.providerAccountId,
						username: acc.username,
						displayName: acc.displayName || acc.username,
						avatarUrl: acc.profileImage
					}))}
					selectedAccount={selectedAccountId || 'all'}
					onSelect={handleAccountChange}
					placeholder="All Accounts"
				/>
			</div>
		</div>
	{/if}

	<!-- Schedule-X Calendar Component - Always show for debugging -->
	<ScheduleXCalendar 
		tweets={data.tweets || []}
		accounts={data.accounts || []}
		selectedAccountFilter={selectedAccountId}
		on:editTweet={(e) => handleEditTweet(e.detail)}
		on:deleteTweet={(e) => handleDelete(e.detail.id)}
		on:reschedule={(e) => handleReschedule(e.detail)}
	/>

	<Pagination
		currentPage={data.currentPage || 1}
		totalPages={data.totalPages || 1}
		basePath="/scheduled"
	/>

	<!-- Preline Overlay Modal for Tweet Creation -->
	{#if showModal}
		<div
			id="schedule-tweet-modal"
			class="hs-overlay hs-overlay-open:flex fixed left-0 top-0 z-[60] h-full w-full overflow-y-auto overflow-x-hidden"
			data-hs-overlay="#schedule-tweet-modal"
			on:keydown={handleKeydown}
			tabindex="-1"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
		>
			<!-- Backdrop -->
			<button
				class="hs-overlay-open:opacity-100 hs-overlay-open:duration-500 fixed left-0 top-0 h-full w-full cursor-default bg-gray-900 bg-opacity-50 opacity-0 transition-all duration-300 ease-in-out"
				data-hs-overlay="#schedule-tweet-modal"
				on:click={closeModal}
				on:keydown={(e) => e.key === 'Escape' && closeModal()}
				aria-label="Close modal"
			></button>

			<!-- Modal Content -->
			<div
				class="hs-overlay-open:opacity-100 hs-overlay-open:duration-500 relative z-[70] m-3 w-full opacity-0 transition-all duration-300 ease-in-out sm:mx-auto sm:w-full sm:max-w-lg"
			>
				<div
					class="theme-dark:bg-[#192734] theme-dark:border-[#38444d] flex flex-col rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
				>
					<!-- Header -->
					<div
						class="theme-dark:border-[#38444d] flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700"
					>
						<h3
							id="modal-title"
							class="theme-dark:text-white text-lg font-semibold text-gray-900 dark:text-white"
						>
							Schedule Tweet for {modalDate}
						</h3>
						<button
							type="button"
							class="theme-dark:hover:bg-[#253341] ms-auto inline-flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white"
							data-hs-overlay="#schedule-tweet-modal"
							on:click={closeModal}
						>
							<svg
								class="h-3 w-3"
								aria-hidden="true"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 14 14"
							>
								<path
									stroke="currentColor"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
								/>
							</svg>
							<span class="sr-only">Close modal</span>
						</button>
					</div>

					<!-- Submit Message -->
					{#if modalSubmitMessage}
						<div
							class="mx-4 mt-4 flex items-center gap-2 rounded-lg p-4 {modalSubmitType === 'success'
								? 'border border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200'
								: 'border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'}"
						>
							{#if modalSubmitType === 'success'}
								<CheckCircle class="h-5 w-5" />
							{:else}
								<XCircle class="h-5 w-5" />
							{/if}
							<span>{modalSubmitMessage}</span>
						</div>
					{/if}

					<!-- Content -->
					<div class="p-4">
						<TweetCreate
							accounts={data.accounts}
							selectedAccountId={modalSelectedAccountId}
							on:submit={handleModalSubmit}
						/>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Edit Tweet Modal -->
	{#if showEditTweetModal && editingTweet}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto overscroll-contain">
			<div class="relative w-full max-w-2xl my-8 rounded-lg bg-white shadow-xl dark:bg-gray-800 max-h-[90vh] flex flex-col overflow-hidden">
				<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700 flex-shrink-0">
					<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Edit Tweet</h2>
					<button
						on:click={handleCloseEditModal}
						aria-label="Close edit tweet modal"
						class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
					>
						<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<div class="overflow-y-auto overflow-x-hidden overscroll-contain p-6 space-y-6">
					<TweetCreate
						mode="edit"
						tweetId={editingTweet.id}
						initialContent={editingTweet.content}
						initialMedia={editingTweet.media || []}
						accounts={data.accounts.filter((acc: any) => acc.id)}
						selectedAccountId={editingTweet.twitterAccountId}
						on:submit={handleTweetUpdate}
					/>
				</div>
			</div>
		</div>
	{/if}

</div>
