<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon } from 'lucide-svelte';
	import TweetCreate from '$lib/components/TweetCreate.svelte';
	import type { Tweet } from '@schedx/shared-lib/types/types';

	const dispatch = createEventDispatcher();

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

	// Account color mapping - assign consistent colors to accounts
	const ACCOUNT_COLORS = [
		{ bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-300 dark:border-blue-700', dot: 'bg-blue-500' },
		{ bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-300 dark:border-purple-700', dot: 'bg-purple-500' },
		{ bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-300 dark:border-green-700', dot: 'bg-green-500' },
		{ bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-300 dark:border-orange-700', dot: 'bg-orange-500' },
		{ bg: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-300 dark:border-pink-700', dot: 'bg-pink-500' },
		{ bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-300 dark:border-indigo-700', dot: 'bg-indigo-500' },
	];

	// Constants
	const MONTH_NAMES = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];

	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	// Props
	export let events: CalendarEvent[] = [];
	export let accounts: any[] = [];
	export let selectedAccountFilter: string = ''; // For filtering by account

	// State
	let month: number;
	let year: number;
	let daysInMonth: number[] = [];
	let blankDays: number[] = [];
	let showTweetModal = false;
	let showMobileDaySheet = false;
	let modalDate: Date | null = null;
	let selectedDate: Date | null = null;
	let editingTweet: Tweet | null = null;
	let hoveredDate: number | null = null;
	let touchStartX = 0;
	let touchEndX = 0;

	// Create account color map
	$: accountColorMap = accounts.reduce((map, account, index) => {
		map[account.providerAccountId] = ACCOUNT_COLORS[index % ACCOUNT_COLORS.length];
		return map;
	}, {} as Record<string, typeof ACCOUNT_COLORS[0]>);

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

	// Filter events by selected account
	function getEventsForDate(date: number): CalendarEvent[] {
		const checkDate = new Date(year, month, date);
		let dateEvents = events.filter(
			(event) => new Date(event.event_date).toDateString() === checkDate.toDateString()
		);
		
		// Apply account filter if set
		if (selectedAccountFilter) {
			dateEvents = dateEvents.filter(event => event.accountId === selectedAccountFilter);
		}
		
		return dateEvents;
	}

	function handleDateClick(date: number) {
		const clickedDate = new Date(year, month, date);
		selectedDate = clickedDate;
		
		// Dispatch event to filter tweets list
		dispatch('dateSelected', { date: clickedDate });
		
		// On mobile, show bottom sheet with day details
		if (window.innerWidth < 640) {
			showMobileDaySheet = true;
		}
	}

	function openTweetModal(date: number) {
		modalDate = new Date(year, month, date);
		showTweetModal = true;
	}

	function closeTweetModal() {
		showTweetModal = false;
		modalDate = null;
		editingTweet = null;
	}

	function closeMobileDaySheet() {
		showMobileDaySheet = false;
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

	// Touch/swipe handlers for mobile
	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].screenX;
	}

	function handleTouchEnd(e: TouchEvent) {
		touchEndX = e.changedTouches[0].screenX;
		handleSwipe();
	}

	function handleSwipe() {
		const swipeThreshold = 50;
		if (touchStartX - touchEndX > swipeThreshold) {
			// Swipe left - next month
			navigateMonth('next');
		} else if (touchEndX - touchStartX > swipeThreshold) {
			// Swipe right - previous month
			navigateMonth('prev');
		}
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
	<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 px-3 py-3 dark:border-gray-700 dark:from-gray-800 dark:to-gray-800 sm:px-6 sm:py-4">
			<h2 class="text-base font-bold text-gray-900 dark:text-white sm:text-lg md:text-xl">
				{MONTH_NAMES[month]} {year}
			</h2>

			<div class="flex items-center space-x-1 sm:space-x-2">
				<button
					type="button"
					class="inline-flex items-center justify-center rounded-lg border-2 border-gray-300 bg-white p-1.5 text-gray-700 shadow-sm transition-all duration-200 hover:border-blue-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:bg-gray-600 sm:p-2"
					disabled={month === 0 && year <= 2020}
					on:click={() => navigateMonth('prev')}
					aria-label="Previous month"
				>
					<ChevronLeft class="h-4 w-4 sm:h-5 sm:w-5" />
				</button>

				<button
					type="button"
					class="inline-flex items-center justify-center rounded-lg border-2 border-gray-300 bg-white p-1.5 text-gray-700 shadow-sm transition-all duration-200 hover:border-blue-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:bg-gray-600 sm:p-2"
					disabled={month === 11 && year >= 2030}
					on:click={() => navigateMonth('next')}
					aria-label="Next month"
				>
					<ChevronRight class="h-4 w-4 sm:h-5 sm:w-5" />
				</button>
			</div>
		</div>

		<!-- Calendar Grid -->
		<div class="p-1.5 sm:p-4 md:p-6">
			<!-- Day Headers -->
			<div class="mb-1 grid grid-cols-7 gap-0.5 sm:gap-1 sm:mb-2">
				{#each DAYS as day}
					<div class="px-0.5 py-1 text-center sm:px-2 sm:py-2">
						<div class="text-[10px] font-semibold text-gray-600 dark:text-gray-400 sm:text-xs md:text-sm">
							{day}
						</div>
					</div>
				{/each}
			</div>

			<!-- Calendar Days -->
			<div class="grid grid-cols-7 gap-0.5 sm:gap-1">
				<!-- Blank Days -->
				{#each blankDays as blankDay}
					<div
						class="aspect-square rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 sm:rounded-lg"
					></div>
				{/each}

				<!-- Month Days -->
				{#each daysInMonth as date}
					{@const dayEvents = getEventsForDate(date)}
					{@const isSelected = selectedDate && selectedDate.toDateString() === new Date(year, month, date).toDateString()}
					<div
						class="group relative aspect-square rounded border-2 p-0.5 transition-all duration-200 cursor-pointer sm:rounded-lg sm:p-1 md:p-2
							{isToday(date) 
								? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
								: isSelected
									? 'border-purple-400 bg-purple-50 dark:border-purple-600 dark:bg-purple-900/20'
									: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}
							hover:border-blue-400 hover:shadow-md sm:hover:shadow-lg dark:hover:border-blue-500"
						on:click={() => handleDateClick(date)}
						on:mouseenter={() => hoveredDate = date}
						on:mouseleave={() => hoveredDate = null}
						role="button"
						tabindex="0"
					>
						<!-- Date Number -->
						<div class="flex items-center justify-between">
							<div
								class="text-[10px] font-semibold sm:text-xs md:text-sm {isToday(date)
									? 'text-blue-600 dark:text-blue-400'
									: 'text-gray-900 dark:text-gray-100'}"
							>
								{date}
							</div>

							<!-- Add Event Button (visible on hover, hidden on mobile) -->
							<button
								type="button"
								class="hidden sm:inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white opacity-0 transition-all duration-200 hover:bg-blue-600 group-hover:opacity-100 sm:h-6 sm:w-6"
								on:click|stopPropagation={() => openTweetModal(date)}
								aria-label="Add tweet for {MONTH_NAMES[month]} {date}"
							>
								<Plus class="h-3 w-3" />
							</button>
						</div>

						<!-- Event Indicators - Colored Dots & Count Badge -->
						{#if dayEvents.length > 0}
							<div class="mt-0.5 flex flex-wrap items-center gap-0.5 sm:mt-1 sm:gap-1">
								<!-- Show up to 2 colored dots on mobile, 3 on desktop -->
								{#each dayEvents.slice(0, window.innerWidth < 640 ? 2 : 3) as event}
									{@const color = accountColorMap[event.accountId || ''] || ACCOUNT_COLORS[0]}
									<div 
										class="h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 {color.dot}"
										title="{event.accountUsername}: {event.event_title}"
									></div>
								{/each}
								
								<!-- Count badge -->
								{#if dayEvents.length > (window.innerWidth < 640 ? 2 : 3)}
									<span class="text-[8px] font-medium text-gray-600 dark:text-gray-400 sm:text-[10px]">
										+{dayEvents.length - (window.innerWidth < 640 ? 2 : 3)}
									</span>
								{/if}
							</div>
							
							<!-- Tweet count text (more compact on mobile) -->
							<div class="mt-0.5 text-[8px] font-medium text-gray-600 dark:text-gray-400 sm:mt-1 sm:text-[10px] md:text-xs">
								{dayEvents.length} {dayEvents.length === 1 ? 'tweet' : 'tweets'}
							</div>
						{/if}

						<!-- Hover Preview Tooltip (Desktop only) -->
						{#if hoveredDate === date && dayEvents.length > 0 && window.innerWidth >= 640}
							<div class="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-800">
								<div class="space-y-2">
									{#each dayEvents.slice(0, 3) as event}
										{@const color = accountColorMap[event.accountId || ''] || ACCOUNT_COLORS[0]}
										<div class="flex items-start gap-2 rounded-md p-2 {color.bg}">
											<img
												src={event.accountProfileImage}
												alt={event.accountUsername}
												class="h-6 w-6 rounded-full flex-shrink-0"
											/>
											<div class="min-w-0 flex-1">
												<p class="text-xs font-medium text-gray-900 dark:text-white">
													@{event.accountUsername}
												</p>
												<p class="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
													{event.event_title}
												</p>
											</div>
										</div>
									{/each}
									{#if dayEvents.length > 3}
										<p class="text-xs text-center text-gray-500 dark:text-gray-400">
											+{dayEvents.length - 3} more
										</p>
									{/if}
								</div>
							</div>
						{/if}
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
			<button
				class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
				on:click={closeTweetModal}
				aria-label="Close schedule modal"
			></button>

			<!-- Modal -->
			<div
				class="relative w-full max-w-2xl transform overflow-hidden rounded-xl bg-white shadow-xl transition-all dark:bg-gray-800"
			>
				<!-- Modal Header -->
				<div
					class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
				>
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
						Schedule a Tweet
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
						selectedAccountId={accounts?.length > 0 ? accounts[0]?.providerAccountId : ''}
						initialContent=""
						initialDate={modalDate?.toISOString()}
						mode="schedule"
					/>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Mobile Bottom Sheet for Day Details -->
{#if showMobileDaySheet && selectedDate}
	{@const dayEvents = getEventsForDate(selectedDate.getDate())}
	<div class="fixed inset-0 z-50 sm:hidden">
		<!-- Backdrop -->
		<button
			class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
			on:click={closeMobileDaySheet}
			aria-label="Close day details"
		></button>

		<!-- Bottom Sheet -->
		<div class="fixed bottom-0 left-0 right-0 max-h-[80vh] transform overflow-hidden rounded-t-3xl bg-white shadow-xl transition-all dark:bg-gray-800">
			<!-- Handle Bar -->
			<div class="flex justify-center py-3">
				<div class="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600"></div>
			</div>

			<!-- Header -->
			<div class="border-b border-gray-200 px-6 pb-4 dark:border-gray-700">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
						{MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
					</h3>
					<button
						type="button"
						class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
						on:click={closeMobileDaySheet}
						aria-label="Close"
					>
						<X class="h-5 w-5" />
					</button>
				</div>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
					{dayEvents.length} {dayEvents.length === 1 ? 'tweet' : 'tweets'} scheduled
				</p>
			</div>

			<!-- Content -->
			<div class="max-h-[60vh] overflow-y-auto p-6">
				{#if dayEvents.length > 0}
					<div class="space-y-3">
						{#each dayEvents as event}
							{@const color = accountColorMap[event.accountId || ''] || ACCOUNT_COLORS[0]}
							<div class="rounded-lg border p-3 {color.bg} {color.border}">
								<div class="flex items-start gap-3">
									<img
										src={event.accountProfileImage}
										alt={event.accountUsername}
										class="h-10 w-10 rounded-full flex-shrink-0"
									/>
									<div class="min-w-0 flex-1">
										<p class="text-sm font-medium text-gray-900 dark:text-white">
											@{event.accountUsername}
										</p>
										<p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
											{event.event_title}
										</p>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-8 text-center">
						<p class="text-sm text-gray-500 dark:text-gray-400">No tweets scheduled for this day</p>
						<button
							type="button"
							class="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
							on:click={() => {
								closeMobileDaySheet();
								if (selectedDate) openTweetModal(selectedDate.getDate());
							}}
						>
							<Plus class="h-4 w-4" />
							Add Tweet
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
