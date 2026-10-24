import { composeSchema } from '#lib/server/posts/schema.js';
import { ComposeError, getPost, savePost } from '#lib/server/posts/service.js';
import { kickScheduler } from '#lib/server/scheduler/loop.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const parsed = composeSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return Response.json(
			{ error: parsed.error.issues[0]?.message ?? 'Invalid post' },
			{ status: 400 }
		);
	}
	try {
		const ids = savePost(parsed.data);
		if (parsed.data.action === 'now') kickScheduler();
		return Response.json({ ids, scheduledAt: getPost(ids[0])?.scheduledAt ?? null });
	} catch (err) {
		if (err instanceof ComposeError) return Response.json({ error: err.message }, { status: 400 });
		throw err;
	}
};
