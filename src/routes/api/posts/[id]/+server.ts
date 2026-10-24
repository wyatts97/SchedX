import { z } from 'zod';
import {
	deletePost,
	duplicatePost,
	moveToDrafts,
	reschedule,
	retryNow
} from '#lib/server/posts/service.js';
import { kickScheduler } from '#lib/server/scheduler/loop.js';
import type { RequestHandler } from './$types';

const body = z.discriminatedUnion('action', [
	z.object({ action: z.literal('delete') }),
	z.object({ action: z.literal('retry') }),
	z.object({ action: z.literal('duplicate') }),
	z.object({ action: z.literal('draft') }),
	z.object({ action: z.literal('reschedule'), at: z.number().int() })
]);

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return Response.json({ error: 'Unknown action' }, { status: 400 });
	const input = parsed.data;
	switch (input.action) {
		case 'delete':
			return deletePost(params.id)
				? Response.json({ ok: true })
				: Response.json(
						{ error: 'This post is publishing right now and cannot be deleted.' },
						{ status: 409 }
					);
		case 'retry':
			if (!retryNow(params.id))
				return Response.json({ error: 'This post cannot be published now.' }, { status: 409 });
			kickScheduler();
			return Response.json({ ok: true });
		case 'duplicate': {
			const id = duplicatePost(params.id);
			return id
				? Response.json({ id })
				: Response.json({ error: 'Post not found' }, { status: 404 });
		}
		case 'draft':
			return moveToDrafts(params.id)
				? Response.json({ ok: true })
				: Response.json({ error: 'This post cannot be moved to drafts.' }, { status: 409 });
		case 'reschedule':
			if (input.at < Date.now() - 60_000) {
				return Response.json({ error: 'Pick a time in the future.' }, { status: 400 });
			}
			return reschedule(params.id, input.at)
				? Response.json({ ok: true })
				: Response.json({ error: 'This post cannot be rescheduled.' }, { status: 409 });
	}
};
