<script lang="ts">
	import 'temporal-polyfill/global';
	import { onMount } from 'svelte';
	import { goto, refreshAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { ScheduleXCalendar } from '@schedule-x/svelte';
	import {
		createCalendar,
		createViewDay,
		createViewMonthAgenda,
		createViewMonthGrid,
		createViewWeek,
		type CalendarApp,
		type CalendarEventExternal
	} from '@schedule-x/calendar';
	import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop';
	import '@schedule-x/theme-default/dist/index.css';
	import { Temporal } from 'temporal-polyfill';
	import type { PostView, AccountView } from '#lib/shared/compose.js';
	import { STATUS_LABELS } from '#lib/shared/types.js';
	import { api } from '#lib/utils.js';

	let { posts, accounts, tz }: { posts: PostView[]; accounts: AccountView[]; tz: string } =
		$props();

	const PALETTE = ['#3f51e0', '#0f8a6c', '#b45309', '#be185d', '#7c3aed', '#0369a1'];
	let app = $state<CalendarApp | null>(null);

	function isDark(): boolean {
		const t = document.documentElement.dataset.theme;
		return (
			t === 'dark' ||
			t === 'black' ||
			(t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
		);
	}

	function toEvents(list: PostView[]) {
		return list
			.filter((p) => (p.status === 'published' ? p.publishedAt : p.scheduledAt))
			.map((p) => {
				const at = (p.status === 'published' ? p.publishedAt : p.scheduledAt)!;
				const start = Temporal.Instant.fromEpochMilliseconds(at).toZonedDateTimeISO(tz);
				const text = p.items[0]?.text.replace(/\s+/g, ' ').trim() || 'Media post';
				const status = p.status === 'scheduled' ? '' : `[${STATUS_LABELS[p.status]}] `;
				return {
					id: p.id,
					title: `${status}${text.slice(0, 70)}`,
					description: `@${p.account.username}${p.items.length > 1 ? ` · thread of ${p.items.length}` : ''}`,
					start,
					end: start.add({ minutes: 20 }),
					calendarId: p.accountId,
					_options: { disableDND: p.status !== 'scheduled', disableResize: true }
				};
			});
	}

	onMount(() => {
		const mobile = window.innerWidth < 768;
		const calendars = Object.fromEntries(
			accounts.map((a, i) => {
				const main = PALETTE[i % PALETTE.length];
				return [
					a.id,
					{
						colorName: `acct${i}`,
						lightColors: { main, container: `${main}1f`, onContainer: '#0f1419' },
						darkColors: { main, container: `${main}40`, onContainer: '#e9eef2' }
					}
				];
			})
		);
		const calendar = createCalendar({
			timezone: tz as never,
			isDark: isDark(),
			firstDayOfWeek: 1,
			views: [createViewMonthGrid(), createViewWeek(), createViewDay(), createViewMonthAgenda()],
			defaultView: mobile ? 'month-agenda' : 'month-grid',
			// Schedule-X types Temporal via TS's lib; the polyfill's types are identical at runtime.
			events: toEvents(posts) as unknown as CalendarEventExternal[],
			calendars,
			monthGridOptions: { nEventsPerDay: mobile ? 2 : 4 },
			plugins: mobile ? [] : [createDragAndDropPlugin(15)],
			callbacks: {
				onEventClick(event) {
					goto(`/compose?edit=${event.id}`);
				},
				async onEventUpdate(event) {
					const start = event.start as Temporal.ZonedDateTime;
					const at = start.toInstant().epochMilliseconds;
					try {
						await api(`/api/posts/${event.id}`, { action: 'reschedule', at });
						toast.success('Rescheduled');
					} catch (err) {
						toast.error((err as Error).message);
					}
					await refreshAll();
				},
				onClickDateTime(dateTime) {
					const at = dateTime.toInstant().epochMilliseconds;
					if (at > Date.now()) goto(`/compose?at=${at}`);
				},
				onClickDate(date) {
					const at = date.toZonedDateTime({
						timeZone: tz,
						plainTime: new Temporal.PlainTime(9)
					}).epochMilliseconds;
					if (at > Date.now()) goto(`/compose?at=${at}`);
				}
			}
		});
		app = calendar;

		// Follow the app theme.
		const observer = new MutationObserver(() => calendar.setTheme(isDark() ? 'dark' : 'light'));
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});
		return () => observer.disconnect();
	});

	$effect(() => {
		const events = toEvents(posts);
		app?.events.set(events as unknown as CalendarEventExternal[]);
	});
</script>

<div class="sx-wrap">
	{#if app}
		<ScheduleXCalendar calendarApp={app} />
	{:else}
		<div class="h-[42rem] animate-pulse rounded-panel bg-surface-2"></div>
	{/if}
</div>

<style>
	.sx-wrap :global(.sx__calendar-wrapper) {
		--sx-color-primary: var(--accent);
		--sx-color-on-primary: var(--accent-ink);
		--sx-color-primary-container: var(--accent-soft);
		--sx-color-on-primary-container: var(--ink);
		--sx-color-surface: var(--surface);
		--sx-color-surface-container: var(--surface-2);
		--sx-color-surface-container-low: var(--surface-2);
		--sx-color-surface-container-high: var(--raised);
		--sx-color-surface-bright: var(--raised);
		--sx-color-surface-dim: var(--surface-2);
		--sx-color-background: var(--surface);
		--sx-color-on-background: var(--ink);
		--sx-color-on-surface: var(--ink);
		--sx-color-outline: var(--line-strong);
		--sx-color-outline-variant: var(--line);
		--sx-color-neutral: var(--muted);
		--sx-internal-color-gridline: var(--line);
		--sx-internal-color-light-gray: var(--surface-2);
		--sx-internal-color-text: var(--ink);
		--sx-font-family: var(--font-sans);
		font-family: var(--font-sans);
	}
	.sx-wrap :global(.sx__calendar) {
		border-color: var(--line);
		border-radius: var(--radius-panel);
		background: var(--surface);
	}
	.sx-wrap :global(.sx__time-grid-event),
	.sx-wrap :global(.sx__month-grid-event) {
		cursor: pointer;
	}
	.sx-wrap :global(.sx__view-container) {
		min-height: 36rem;
	}
</style>
