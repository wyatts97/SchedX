import { listCalendar } from '#lib/server/posts/service.js';
import { DAY } from '#lib/shared/time.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const view = url.searchParams.get('view') === 'list' ? 'list' : 'calendar';
	const account = url.searchParams.get('account') || undefined;
	const now = Date.now();
	return {
		view,
		account: account ?? '',
		posts: listCalendar(now - 42 * DAY, now + 120 * DAY, account)
	};
};
