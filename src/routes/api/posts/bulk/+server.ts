import { z } from 'zod';
import { deletePost, shiftPosts } from '#lib/server/posts/service.js';
import type { RequestHandler } from './$types';

const body = z.discriminatedUnion('action', [
	z.object({ action: z.literal('delete'), ids: z.array(z.string()).min(1).max(500) }),
	z.object({
		action: z.literal('shift'),
		ids: z.array(z.string()).min(1).max(500),
		deltaMs: z
			.number()
			.int()
			.refine((n) => n !== 0)
	})
]);

export const POST: RequestHandler = async ({ request }) => {
	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });
	const input = parsed.data;
	if (input.action === 'delete') {
		const n = input.ids.filter((id) => deletePost(id)).length;
		return Response.json({ count: n });
	}
	return Response.json({ count: shiftPosts(input.ids, input.deltaMs) });
};
