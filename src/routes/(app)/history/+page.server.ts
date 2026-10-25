import { listHistory } from '#lib/server/posts/service.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const tab = url.searchParams.get('tab') === 'failed' ? 'failed' : 'published';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const account = url.searchParams.get('account') || undefined;
	return { tab, page, account: account ?? '', ...listHistory(tab, page, 20, account) };
};
