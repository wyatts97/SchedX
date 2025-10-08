<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon } from 'lucide-svelte';
	import TweetCreate from '$lib/components/TweetCreate.svelte';
	import type { Tweet } from '@schedx/shared-lib/types/types';

	// Types
	interface CalendarEvent {
		id: string;
		event_date: Date;
		event_title: string;
		event_theme: 'blue' | 'red' | 'yellow' | 'green' | 'purple' | 'indigo' | 'pink';
		description?: string;
		accountId?: string;
		accountUsername?: string;
		accountProfileImage?: string;
	}

	// Constants
	const MONTH_NAMES = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	// Props
	export let events: CalendarEvent[] = [];
	export let accounts: any[] = [];

	// State
	let month: number;
	let year: number;
	let daysInMonth: number[] = [];
	let blankDays: number[] = [];
	let showTweetModal = false;
	let modalDate: Date | null = null;
	let editingTweet: Tweet | null = null;

	// Functions
	function initDate() {
		const today = new Date();
		month = today.getMonth();
		year = today.getFullYear();
		generateCalendar();
	}

	function generateCalendar() {
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const daysInMonthCount = lastDay.getDate();
		const firstDayOfWeek = firstDay.getDay();

		blankDays = Array.from({ length: firstDayOfWeek }, (_, i) => i);
		daysInMonth = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);
	}

	function isToday(date: number): boolean {
		const today = new Date();
		const checkDate = new Date(year, month, date);
		return today.toDateString() === checkDate.toDateString();
	}

	function getEventsForDate(date: number): CalendarEvent[] {
		const checkDate = new Date(year, month, date);
		return events.filter(
			(event) => new Date(event.event_date).toDateString() === checkDate.toDateString()
		);
	}

	function openTweetModal(date: number, tweet: Tweet | null = null) {
		modalDate = new Date(year, month, date);
		editingTweet = tweet;
		showTweetModal = true;
	}

	function closeTweetModal() {
		showTweetModal = false;
		modalDate = null;
		editingTweet = null;
	}

	function navigateMonth(direction: 'prev' | 'next') {
		if (direction === 'prev') {
			if (month === 0) {
				month = 11;
				year--;
			} else {
				month--;
			}
		} else {
			if (month === 11) {
				month = 0;
				year++;
			} else {
				month++;
			}
		}
		generateCalendar();
	}

	// Initialize on mount
	onMount(initDate);
</script>

<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
	<!-- Calendar Header -->
	<div class="mb-8">
		<div class="flex items-center justify-between">
			<div class="flex items-center space-x-4">
				<CalendarIcon class="h-8 w-8 text-gray-600 dark:text-gray-400" />
				<div>
					<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
					<p class="text-sm text-gray-600 dark:text-gray-400">Manage your events and schedules</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Calendar Container -->
	<div class="overflow-hidden rounded-xl bg-white shadow-lg dark:bg-gray-800">
		<!-- Calendar Navigation -->
		<div
			class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
		>
			<div class="flex items-center space-x-4">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white">
					{MONTH_NAMES[month]}
					{year}
				</h2>
			</div>

			<div class="flex items-center space-x-2">
				<button
					type="button"
					class="hs-btn inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
					disabled={month === 0 && year <= 2020}
					on:click={() => navigateMonth('prev')}
					aria-label="Previous month"
				>
					<ChevronLeft class="h-4 w-4" />
				</button>

				<button
					type="button"
					class="hs-btn inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
					disabled={month === 11 && year >= 2030}
					on:click={() => navigateMonth('next')}
					aria-label="Next month"
				>
					<ChevronRight class="h-4 w-4" />
				</button>
			</div>
		</div>

		<!-- Calendar Grid -->
		<div class="p-2 sm:p-4 md:p-6">
			<!-- Day Headers -->
			<div class="mb-2 grid grid-cols-7 gap-1">
				{#each DAYS as day}
					<div class="px-1 py-2 text-center sm:px-2">
						<div class="text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
							{day}
						</div>
					</div>
				{/each}
			</div>

			<!-- Calendar Days -->
			<div class="grid grid-cols-7 gap-1">
				<!-- Blank Days -->
				{#each blankDays as blankDay}
					<div
						class="aspect-square rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
					></div>
				{/each}

				<!-- Month Days -->
				{#each daysInMonth as date}
					<div
						class="group relative aspect-square rounded-lg border border-gray-200 bg-white p-1 transition-all duration-200 hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500 sm:p-2"
					>
						<!-- Date Number -->
						<div class="flex items-center justify-between">
							<div
								class="text-xs font-medium sm:text-sm {isToday(date)
									? 'text-blue-600'
									: 'text-gray-900 dark:text-gray-100'}"
							>
								{date}
							</div>

							<!-- Add Event Button (visible on hover) -->
							<button
								type="button"
								class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-gray-600 opacity-0 transition-all duration-200 hover:bg-blue-100 hover:text-blue-600 group-hover:opacity-100 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-blue-900 dark:hover:text-blue-300 sm:h-6 sm:w-6"
								on:click={() => openTweetModal(date)}
								aria-label="Quick add event"
							>
								<Plus class="h-3 w-3" />
							</button>
						</div>

						<!-- Events -->
						<div class="mt-1 max-h-16 space-y-1 overflow-y-auto sm:max-h-20">
							{#each getEventsForDate(date) as event}
								<div
									class="group/event relative cursor-pointer rounded-md border px-1 py-0.5 text-xs transition-all duration-200 hover:shadow-sm dark:border-gray-600 sm:px-2 sm:py-1"
									on:click={() => openTweetModal(date, event)}
								>
									<div class="flex items-center justify-between">
										<img
											src={event.accountProfileImage}
											alt={event.accountUsername}
											class="mr-1 h-4 w-4 rounded-full"
										/>
										<span class="truncate text-xs font-medium sm:text-sm">{event.event_title}</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<!-- Tweet Create Modal -->
{#if showTweetModal}
	<div class="fixed inset-0 z-50 overflow-y-auto">
		<div class="flex min-h-screen items-center justify-center px-4 py-6">
			<!-- Backdrop -->
			<div
				class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
				on:click={closeTweetModal}
			></div>

			<!-- Modal -->
			<div
				class="relative w-full max-w-2xl transform overflow-hidden rounded-xl bg-white shadow-xl transition-all dark:bg-gray-800"
			>
				<!-- Modal Header -->
				<div
					class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
				>
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
						{editingTweet ? 'Edit Scheduled Tweet' : 'Schedule a Tweet'}
					</h3>
					<button
						type="button"
						class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
						on:click={closeTweetModal}
						aria-label="Close modal"
					>
						<X class="h-5 w-5" />
					</button>
				</div>

				<!-- Modal Body -->
				<div class="p-6">
					<TweetCreate
						{accounts}
						selectedAccountId={editingTweet?.accountId}
						initialContent={editingTweet?.event_title}
						initialDate={modalDate?.toISOString()}
						mode={editingTweet ? 'edit' : 'schedule'}
						tweetId={editingTweet?.id}
					/>
				</div>
			</div>
		</div>
	</div>
{/if}
