<script lang="ts">
	import { onMount, createEventDispatcher, tick } from 'svelte';
	import { ScheduleXCalendar } from '@schedule-x/svelte';
	import { createCalendar, createViewMonthGrid, createViewWeek, createViewDay, createViewMonthAgenda } from '@schedule-x/calendar';
	import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop';
	import type { CalendarApp } from '@schedule-x/calendar';
	import '@schedule-x/theme-default/dist/index.css';
	import 'temporal-polyfill/global';
	import type { Tweet } from '@schedx/shared-lib/types/types';
	import { Edit, Trash2, Plus, X } from 'lucide-svelte';
	import TweetPreview from '$lib/components/TweetPreview.svelte';
	import TweetCreate from '$lib/components/TweetCreate.svelte';
	import { browser } from '$app/environment';

	const dispatch = createEventDispatcher();

	// Props
	export let tweets: Tweet[] = [];
	export let accounts: any[] = [];
	export let selectedAccountFilter: string = '';

	// Hover preview state
	let hoveredEvent: any = null;
	let hoverTimeout: any = null;
	let previewPosition = { x: 0, y: 0 };
	let showHoverPreview = false;

	// State
	let calendarApp: CalendarApp | null = null;
	let showEventModal = false;
	let selectedEvent: any = null;
	let selectedTweet: Tweet | null = null;
	let showCreateModal = false;
	let createModalDate: Date | null = null;

	// Account color mapping
	const ACCOUNT_COLORS = [
		'#3b82f6', // blue
		'#8b5cf6', // purple
		'#10b981', // green
		'#f59e0b', // orange
		'#ec4899', // pink
		'#6366f1', // indigo
	];

	$: accountColorMap = accounts.reduce((map, account, index) => {
		map[account.providerAccountId] = ACCOUNT_COLORS[index % ACCOUNT_COLORS.length];
		return map;
	}, {} as Record<string, string>);

	// Convert tweets to Schedule-X events format
	function tweetsToEvents(tweets: Tweet[]) {
		return tweets
			.filter(tweet => {
				// Apply account filter if set
				if (selectedAccountFilter && tweet.twitterAccountId !== selectedAccountFilter) {
					return false;
				}
				return true;
			})
			.map((tweet, index) => {
				const account = accounts.find(a => a.providerAccountId === tweet.twitterAccountId);
				const scheduledDate = new Date(tweet.scheduledDate);
				
				// Create Temporal ZonedDateTime from the scheduled date
				const zonedDateTime = Temporal.ZonedDateTime.from({
					year: scheduledDate.getFullYear(),
					month: scheduledDate.getMonth() + 1,
					day: scheduledDate.getDate(),
					hour: scheduledDate.getHours(),
					minute: scheduledDate.getMinutes(),
					timeZone: Temporal.Now.timeZoneId()
				});

				return {
					id: tweet.id || `temp-${Date.now()}-${index}`, // Ensure ID is always a string
					title: `${account?.username || 'Unknown'}: ${tweet.content.substring(0, 50)}${tweet.content.length > 50 ? '...' : ''}`,
					start: zonedDateTime,
					end: zonedDateTime.add({ minutes: 15 }), // 15 minute duration for display
					calendarId: tweet.twitterAccountId || 'default',
					_tweet: tweet, // Store full tweet data
					_account: account
				};
			});
	}

	// Initialize calendar
	function initCalendar() {
		const events = tweetsToEvents(tweets);

		// Create calendars config for account filtering
		const calendars = accounts.reduce((acc, account, index) => {
			acc[account.providerAccountId] = {
				colorName: 'account-' + index,
				lightColors: {
					main: accountColorMap[account.providerAccountId] || ACCOUNT_COLORS[0],
					container: accountColorMap[account.providerAccountId] + '20' || ACCOUNT_COLORS[0] + '20',
					onContainer: accountColorMap[account.providerAccountId] || ACCOUNT_COLORS[0],
				},
				darkColors: {
					main: accountColorMap[account.providerAccountId] || ACCOUNT_COLORS[0],
					container: accountColorMap[account.providerAccountId] + '40' || ACCOUNT_COLORS[0] + '40',
					onContainer: accountColorMap[account.providerAccountId] || ACCOUNT_COLORS[0],
				}
			};
			return acc;
		}, {} as Record<string, any>);

		calendarApp = createCalendar({
			locale: 'en-US',
			firstDayOfWeek: 1, // Sunday
			views: [
				createViewMonthGrid(),
				createViewWeek(),
				createViewDay(),
				createViewMonthAgenda()
			],
			defaultView: 'month-grid',
			events: events,
			calendars: calendars,
			plugins: [
				createDragAndDropPlugin(15) // 15 minute intervals
			],
			callbacks: {
				onEventClick(calendarEvent) {
					selectedEvent = calendarEvent;
					selectedTweet = calendarEvent._tweet;
					showEventModal = true;
				},
				onEventUpdate(updatedEvent) {
					// Handle drag and drop reschedule
					const tweet = updatedEvent._tweet as Tweet;
					if (tweet) {
						handleReschedule(tweet, updatedEvent.start);
					}
				},
				onBeforeEventUpdate(oldEvent, newEvent) {
					// Allow the update - we'll handle it in onEventUpdate
					return true;
				},
				onRangeUpdate(range) {
					// Could be used to fetch tweets for the visible range
					console.log('Range updated:', range);
				}
			}
		});
	}

	// Handle reschedule via drag and drop
	function handleReschedule(tweet: Tweet, newStart: any) {
		// Convert Temporal to Date
		const newDate = new Date(
			newStart.year,
			newStart.month - 1,
			newStart.day,
			newStart.hour,
			newStart.minute
		);

		dispatch('reschedule', {
			tweetId: tweet.id,
			newDate: newDate
		});
	}

	// Handle edit tweet
	function handleEdit() {
		if (selectedTweet) {
			showEventModal = false;
			dispatch('editTweet', selectedTweet);
		}
	}

	// Handle delete tweet
	function handleDelete() {
		if (selectedTweet) {
			showEventModal = false;
			dispatch('deleteTweet', { id: selectedTweet.id });
		}
	}

	// Close event modal
	function closeEventModal() {
		showEventModal = false;
		selectedEvent = null;
		selectedTweet = null;
	}

	// Update calendar when tweets or filter changes
	$: if (calendarApp && (tweets || selectedAccountFilter)) {
		const events = tweetsToEvents(tweets);
		calendarApp.events.set(events);
	}

	// Setup hover listeners for desktop preview
	function setupHoverListeners() {
		if (!browser) return;

		// Add event listeners to calendar events for hover preview
		const observer = new MutationObserver(() => {
			const eventElements = document.querySelectorAll('.sx__event');
			eventElements.forEach((el) => {
				if (!(el as any)._hoverListenerAdded) {
					el.addEventListener('mouseenter', handleEventHover as any);
					el.addEventListener('mouseleave', handleEventLeave);
					(el as any)._hoverListenerAdded = true;
				}
			});
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		return () => observer.disconnect();
	}

	function handleEventHover(e: MouseEvent) {
		if (window.innerWidth < 768) return; // Only on desktop

		const target = e.currentTarget as HTMLElement;
		const eventId = target.getAttribute('data-event-id');
		
		if (!eventId) return;

		// Find the event
		const event = calendarApp?.events.getAll().find((ev: any) => ev.id === eventId);
		if (!event) return;

		// Clear any existing timeout
		if (hoverTimeout) clearTimeout(hoverTimeout);

		// Set timeout to show preview after 300ms
		hoverTimeout = setTimeout(() => {
			hoveredEvent = event;
			
			// Position the preview near the cursor
			const rect = target.getBoundingClientRect();
			previewPosition = {
				x: rect.left + rect.width / 2,
				y: rect.bottom + 10
			};
			
			showHoverPreview = true;
		}, 300);
	}

	function handleEventLeave() {
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}
		showHoverPreview = false;
		hoveredEvent = null;
	}

	onMount(() => {
		initCalendar();
		const cleanup = setupHoverListeners();
		return cleanup;
	});
</script>

<div class="schedule-x-wrapper">
	{#if calendarApp}
		<ScheduleXCalendar calendarApp={calendarApp} />
	{/if}
</div>

<!-- Hover Preview (Desktop Only) -->
{#if showHoverPreview && hoveredEvent && hoveredEvent._tweet && hoveredEvent._account}
	<div 
		class="fixed z-[100] hidden md:block pointer-events-none"
		style="left: {previewPosition.x}px; top: {previewPosition.y}px; transform: translateX(-50%);"
	>
		<div class="w-96 rounded-lg bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10 pointer-events-auto">
			<div class="p-4">
				<TweetPreview
					avatarUrl={hoveredEvent._account.profileImage || '/avatar.png'}
					displayName={hoveredEvent._account.displayName || hoveredEvent._account.username}
					username={hoveredEvent._account.username}
					content={hoveredEvent._tweet.content}
					media={hoveredEvent._tweet.media || []}
					createdAt={new Date(hoveredEvent._tweet.scheduledDate)}
					hideActions={true}
					showXLogo={true}
				/>
			</div>
		</div>
	</div>
{/if}

<!-- Event Detail Modal -->
{#if showEventModal && selectedTweet && selectedEvent}
	{@const account = selectedEvent._account}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
		<div class="relative w-full max-w-2xl rounded-lg bg-white shadow-xl dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
					Scheduled Tweet Details
				</h3>
				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
					on:click={closeEventModal}
					aria-label="Close modal"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="p-6 space-y-4">
				{#if account}
					<TweetPreview
						avatarUrl={account.profileImage || '/avatar.png'}
						displayName={account.displayName || account.username}
						username={account.username}
						content={selectedTweet.content}
						media={selectedTweet.media || []}
						createdAt={new Date(selectedTweet.scheduledDate)}
						hideActions={true}
						showXLogo={false}
					>
						<svelte:fragment slot="actions">
							<button
								type="button"
								on:click={handleEdit}
								class="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 transition-colors hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30 dark:hover:bg-blue-500/20"
							>
								<Edit class="h-4 w-4" />
								Edit Tweet
							</button>
							<button
								type="button"
								on:click={handleDelete}
								class="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-600/20 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30 dark:hover:bg-red-500/20"
							>
								<Trash2 class="h-4 w-4" />
								Delete Tweet
							</button>
						</svelte:fragment>
					</TweetPreview>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.schedule-x-wrapper {
		width: 100%;
		min-height: 600px;
	}

	/* Customize Schedule-X theme to match app */
	:global(.sx__calendar-wrapper) {
		border-radius: 0.5rem;
		overflow: hidden;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
		border: 1px solid rgb(229 231 235);
	}

	:global(.sx__month-grid-day) {
		min-height: 100px;
		transition: background-color 0.2s;
	}

	:global(.sx__month-grid-day:hover) {
		background-color: rgb(249 250 251);
	}

	:global(.sx__event) {
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		padding: 0.25rem 0.5rem;
	}

	:global(.sx__event:hover) {
		transform: translateY(-1px);
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
		opacity: 0.95;
		z-index: 10;
	}

	/* Month view specific styles */
	:global(.sx__month-grid-event) {
		margin-bottom: 2px;
	}

	/* Week/Day view styles */
	:global(.sx__time-grid-event) {
		border-left-width: 3px;
	}

	/* Header styles */
	:global(.sx__calendar-header) {
		padding: 1rem;
		border-bottom: 1px solid rgb(229 231 235);
	}

	:global(.sx__date-picker-button) {
		border-radius: 0.5rem;
		padding: 0.5rem 1rem;
		font-weight: 600;
	}

	/* View switcher */
	:global(.sx__view-selection-item) {
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
		transition: background-color 0.2s;
	}

	:global(.sx__view-selection-item:hover) {
		background-color: rgb(243 244 246);
	}

	:global(.sx__view-selection-item--active) {
		background-color: rgb(59 130 246);
		color: white;
	}

	/* Dark mode support */
	:global(.dark .sx__calendar-wrapper) {
		background-color: rgb(31 41 55);
		color: rgb(243 244 246);
		border-color: rgb(55 65 81);
	}

	:global(.dark .sx__month-grid-day) {
		border-color: rgb(55 65 81);
	}

	:global(.dark .sx__month-grid-day:hover) {
		background-color: rgb(55 65 81);
	}

	:global(.dark .sx__calendar-header) {
		border-bottom-color: rgb(55 65 81);
	}

	:global(.dark .sx__view-selection-item:hover) {
		background-color: rgb(55 65 81);
	}

	:global(.dark .sx__event) {
		opacity: 0.9;
	}

	:global(.dark .sx__event:hover) {
		opacity: 1;
	}

	/* Mobile responsive adjustments */
	@media (max-width: 768px) {
		.schedule-x-wrapper {
			min-height: 500px;
		}

		:global(.sx__month-grid-day) {
			min-height: 80px;
		}

		:global(.sx__event) {
			font-size: 0.75rem;
			padding: 0.125rem 0.25rem;
		}

		:global(.sx__calendar-header) {
			padding: 0.75rem;
		}
	}

	/* Ensure hover preview stays on top */
	:global(.hover-preview) {
		z-index: 100;
	}
</style>
