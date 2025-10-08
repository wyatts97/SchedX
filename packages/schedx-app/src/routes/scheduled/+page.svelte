<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import TweetCreate from '$lib/components/TweetCreate.svelte';
	import { AlertTriangle, CheckCircle, XCircle } from 'lucide-svelte'; // Icon for warning/alert messages
	import Calendar from '$lib/components/Calendar.svelte';
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

	// Calendar state variables
	let calendarYear = new Date().getFullYear();
	let calendarMonth = new Date().getMonth();
	let selectedDate: string | null = null;
	let dragTweet: Tweet | null = null;
	let rescheduleLoading = false;
	let rescheduleError = '';
	let tweetContent = '';
	let tweetMedia: { url: string; type: string }[] = [];

	function mapTweetsToCalendarEvents(tweets: Tweet[]) {
		return tweets.map((tweet) => ({
			id: tweet.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
			event_date: new Date(tweet.scheduledDate),
			event_title: tweet.content,
			event_theme: 'blue' as const satisfies
				| 'blue'
				| 'red'
				| 'yellow'
				| 'green'
				| 'purple'
				| 'indigo'
				| 'pink',
			accountId: tweet.twitterAccountId || '',
			accountUsername: data.accounts.find(
				(a: { providerAccountId: string }) => a.providerAccountId === (tweet.twitterAccountId || '')
			)?.username,
			accountProfileImage: data.accounts.find(
				(a: { providerAccountId: string }) => a.providerAccountId === (tweet.twitterAccountId || '')
			)?.profileImage
		}));
	}

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

	function handleContentInput(event: CustomEvent<string>) {
		tweetContent = event.detail;
	}

	function handleMediaChange(event: CustomEvent<{ url: string; type: string }[]>) {
		tweetMedia = event.detail;
	}

	function handleAccountChange(event: Event) {
		const accountId = (event.target as HTMLSelectElement).value;
		const url = new URL(window.location.href);
		url.searchParams.set('twitterAccountId', accountId);
		window.location.href = url.toString();
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

	function daysInMonth(year: number, month: number): number {
		return new Date(year, month + 1, 0).getDate();
	}

	function firstDayOfWeek(year: number, month: number): number {
		return new Date(year, month, 1).getDay();
	}

	function prevMonth(): void {
		if (calendarMonth === 0) {
			calendarMonth = 11;
			calendarYear--;
		} else {
			calendarMonth--;
		}
		selectedDate = null;
	}

	function nextMonth(): void {
		if (calendarMonth === 11) {
			calendarMonth = 0;
			calendarYear++;
		} else {
			calendarMonth++;
		}
		selectedDate = null;
	}

	function selectDate(date: string): void {
		selectedDate = date;
	}

	function openModal(date: string) {
		modalDate = date;
		showModal = true;
		if (!modalSelectedAccountId && data.accounts && data.accounts.length > 0) {
			modalSelectedAccountId = data.accounts[0]?.providerAccountId || '';
		}

		// Ensure Preline is initialized before showing modal
		if (browser && typeof window !== 'undefined' && window.HSStaticMethods) {
			setTimeout(() => {
				window.HSStaticMethods.autoInit();
			}, 100);
		}
	}
	function closeModal() {
		showModal = false;
		modalDate = null;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && showModal) {
			closeModal();
		}
	}

	function handleDragStart(tweet: Tweet) {
		dragTweet = tweet;
	}
	async function handleDrop(date: string) {
		if (dragTweet && dragTweet.scheduledDate) {
			const oldDateStr = new Date(dragTweet.scheduledDate).toISOString().slice(0, 10);
			if (oldDateStr === date) {
				dragTweet = null;
				return;
			}
			rescheduleLoading = true;
			rescheduleError = '';
			try {
				const formData = new FormData();
				formData.append('tweetId', dragTweet.id ?? '');
				formData.append('newDate', date);
				const res = await fetch('?/rescheduleTweet', { method: 'POST', body: formData });
				const result = await res.json();
				if (result.success) {
					await invalidateAll();
				} else {
					rescheduleError = result.error || 'Failed to reschedule tweet.';
				}
			} catch (e) {
				rescheduleError = 'Failed to reschedule tweet.';
			} finally {
				rescheduleLoading = false;
				dragTweet = null;
			}
		}
	}
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
	}
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

	<!-- Twitter Account Selector -->
	{#if data.accounts && data.accounts.length > 0}
		<div class="mb-6">
			<label
				class="theme-dark:text-[#8899a6] mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
				for="twitterAccountId"
			>
				Twitter Account
			</label>
			<select
				id="twitterAccountId"
				name="twitterAccountId"
				bind:value={selectedAccountId}
				class="theme-dark:bg-[#253341] theme-dark:border-[#38444d] theme-dark:text-white theme-dark:placeholder-[#8899a6] block w-full rounded-lg border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
				on:change={handleAccountChange}
			>
				{#each data.accounts as account}
					<option value={account.providerAccountId}
						>{account.username} ({account.providerAccountId})</option
					>
				{/each}
			</select>
		</div>
	{/if}

	<!-- Calendar Component -->
	<Calendar events={mapTweetsToCalendarEvents(data.tweets || [])} accounts={data.accounts} />

	<!-- Scheduled Tweets List -->
	{#if data.tweets && data.tweets.length > 0}
		<div class="mt-8 grid grid-cols-1 gap-4">
			{#each data.tweets as tweet (tweet.id)}
				<div
					class="mb-4 rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800"
				>
					<div class="p-6">
						<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
							Scheduled Tweet
						</h2>
						<p class="mb-2 text-lg">{tweet.content}</p>
						<div class="flex flex-wrap gap-2">
							{#each (tweet as any).media || [] as media (media.url)}
								<img src={media.url} alt="Media" class="h-16 w-16 rounded-md object-cover" />
							{/each}
						</div>
						<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
							Scheduled for: {new Date(tweet.scheduledDate).toLocaleString()}
						</p>
						<div class="mt-4 flex gap-2">
							<button
								class="inline-flex items-center justify-center rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								>Edit</button
							>
							<button
								class="inline-flex items-center justify-center rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all duration-200 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								>Delete</button
							>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if data.accounts && data.accounts.length > 0}
		<EmptyState
			title="No Scheduled Tweets"
			message="You haven't scheduled any tweets yet. Create and schedule a tweet to see it here."
			actionLink="/post"
			actionText="Create a Tweet"
		/>
	{/if}

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
							on:contentInput={handleContentInput}
							on:changeMedia={handleMediaChange}
							on:submit={handleModalSubmit}
						/>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if rescheduleLoading}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div
				class="theme-dark:bg-[#192734] flex flex-col items-center rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
			>
				<div
					class="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500"
				></div>
				<span class="theme-dark:text-white text-gray-900 dark:text-white"
					>Rescheduling tweet...</span
				>
			</div>
		</div>
	{/if}
	{#if rescheduleError}
		<div
			class="theme-dark:bg-[#253341] theme-dark:border-[#38444d] theme-dark:text-[#8899a6] fixed left-1/2 top-4 z-50 w-fit -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 shadow-lg dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
		>
			<span>{rescheduleError}</span>
			<button
				class="theme-dark:bg-[#38444d] theme-dark:hover:bg-[#253341] theme-dark:text-[#8899a6] ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs text-red-600 hover:bg-red-200 dark:bg-red-800 dark:text-red-200 dark:hover:bg-red-700"
				on:click={() => (rescheduleError = '')}>&times;</button
			>
		</div>
	{/if}
</div>
