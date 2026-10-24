import { error } from '@sveltejs/kit';
import { getPost } from '#lib/server/posts/service.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const editId = url.searchParams.get('edit');
	const post = editId ? getPost(editId) : null;
	if (editId && !post) error(404, 'That post no longer exists.');
	const at = Number(url.searchParams.get('at'));
	// Text can arrive from the PWA share sheet as separate title/text/url fields.
	const shared = ['title', 'text', 'url']
		.map((k) => url.searchParams.get(k)?.trim())
		.filter((v, i, all) => v && all.indexOf(v) === i)
		.join(' ');
	return {
		post,
		prefill: {
			text: shared || undefined,
			at: Number.isFinite(at) && at > Date.now() ? at : undefined,
			accountId: url.searchParams.get('account') ?? undefined
		}
	};
};
