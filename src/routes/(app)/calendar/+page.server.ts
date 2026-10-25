import { listCalendar } from '#lib/server/posts/service.js';
import { listAccounts } from '#lib/server/x/accounts.js';
import { openSlots } from '#lib/server/scheduler/queue.js';
import { DAY } from '#lib/shared/time.js';
import type { PageServerLoad } from './$types';

/** Longest window one load returns; the calendar asks for more as you page through it. */
const MAX_RANGE = 200 * DAY;

function param(url: URL, name: string): number | null {
	const n = Number(url.searchParams.get(name));
	return Number.isFinite(n) && n > 0 ? n : null;
}

export const load: PageServerLoad = ({ url, locals, depends }) => {
	depends('app:status');
	const view = url.searchParams.get('view') === 'list' ? 'list' : 'calendar';
	const account = url.searchParams.get('account') || undefined;
	const tz = locals.user?.timezone ?? 'UTC';
	const now = Date.now();

	let from = param(url, 'from') ?? now - 42 * DAY;
	let to = param(url, 'to') ?? now + 120 * DAY;
	if (to <= from) [from, to] = [now - 42 * DAY, now + 120 * DAY];
	if (to - from > MAX_RANGE) to = from + MAX_RANGE;

	const slots = listAccounts()
		.filter((a) => a.status === 'active' && (!account || a.id === account))
		.flatMap((a) => openSlots(a.id, tz, from, to).map((at) => ({ accountId: a.id, at })))
		.sort((a, b) => a.at - b.at);

	return {
		view,
		account: account ?? '',
		range: { from, to },
		posts: listCalendar(from, to, account),
		slots
	};
};
