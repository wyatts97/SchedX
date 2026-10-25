import { composeSchema } from '#lib/server/posts/schema.js';
import { ComposeError, findDuplicates, getPost, savePost } from '#lib/server/posts/service.js';
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
	const input = parsed.data;
	// Drafts can repeat anything; only check what is about to go (or be lined up) for X.
	if (input.action !== 'draft' && !input.allowDuplicate) {
		const matches = findDuplicates(
			input.accountIds,
			input.items.map((i) => i.text),
			input.id
		);
		if (matches.length) {
			return Response.json(
				{ error: 'This repeats a post you already have.', code: 'duplicate', matches },
				{ status: 409 }
			);
		}
	}
	try {
		const ids = savePost(input);
		if (input.action === 'now') kickScheduler();
		return Response.json({ ids, scheduledAt: getPost(ids[0])?.scheduledAt ?? null });
	} catch (err) {
		if (err instanceof ComposeError) return Response.json({ error: err.message }, { status: 400 });
		throw err;
	}
};
