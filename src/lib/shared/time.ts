import { Temporal } from 'temporal-polyfill';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function zoned(ms: number, tz: string): Temporal.ZonedDateTime {
	return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(tz);
}

/** Epoch ms for a local wall-clock time (`date` = YYYY-MM-DD, `minutes` after midnight) in `tz`. */
export function fromLocal(date: string, minutes: number, tz: string): number {
	const pd = Temporal.PlainDate.from(date);
	const zdt = pd.toZonedDateTime({
		timeZone: tz,
		plainTime: new Temporal.PlainTime(Math.floor(minutes / 60), minutes % 60)
	});
	return zdt.epochMilliseconds;
}

/** `YYYY-MM-DDTHH:mm` in `tz`, the format used by <input type="datetime-local">. */
export function toLocalInput(ms: number, tz: string): string {
	const z = zoned(ms, tz);
	return `${z.toPlainDate().toString()}T${pad(z.hour)}:${pad(z.minute)}`;
}

export function fromLocalInput(value: string, tz: string): number | null {
	const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);
	if (!m) return null;
	return fromLocal(m[1], Number(m[2]) * 60 + Number(m[3]), tz);
}

export function addCalendar(
	ms: number,
	tz: string,
	unit: 'days' | 'weeks' | 'months',
	n: number
): number {
	return zoned(ms, tz).add({ [unit]: n }).epochMilliseconds;
}

export function startOfLocalDay(ms: number, tz: string): number {
	return zoned(ms, tz).startOfDay().epochMilliseconds;
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

export function minutesToHHMM(minutes: number): string {
	return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function hhmmToMinutes(value: string): number | null {
	const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
	if (!m) return null;
	const h = Number(m[1]);
	const min = Number(m[2]);
	if (h > 23 || min > 59) return null;
	return h * 60 + min;
}

export function formatDateTime(
	ms: number,
	tz: string,
	opts: Intl.DateTimeFormatOptions = {}
): string {
	return new Intl.DateTimeFormat(undefined, {
		timeZone: tz,
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		...opts
	}).format(ms);
}

export function formatTime(ms: number, tz: string): string {
	return new Intl.DateTimeFormat(undefined, {
		timeZone: tz,
		hour: 'numeric',
		minute: '2-digit'
	}).format(ms);
}

export function formatRelative(ms: number, now = Date.now()): string {
	const diff = ms - now;
	const abs = Math.abs(diff);
	const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	if (abs < MINUTE) return diff >= 0 ? 'in a moment' : 'just now';
	if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), 'minute');
	if (abs < DAY) return rtf.format(Math.round(diff / HOUR), 'hour');
	return rtf.format(Math.round(diff / DAY), 'day');
}

export function timeZones(): string[] {
	try {
		return Intl.supportedValuesOf('timeZone');
	} catch {
		return ['UTC'];
	}
}

export const WEEKDAYS = [
	{ id: 1, short: 'Mon', long: 'Monday' },
	{ id: 2, short: 'Tue', long: 'Tuesday' },
	{ id: 3, short: 'Wed', long: 'Wednesday' },
	{ id: 4, short: 'Thu', long: 'Thursday' },
	{ id: 5, short: 'Fri', long: 'Friday' },
	{ id: 6, short: 'Sat', long: 'Saturday' },
	{ id: 7, short: 'Sun', long: 'Sunday' }
];
