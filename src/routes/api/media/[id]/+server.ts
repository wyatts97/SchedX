import { z } from 'zod';
import { deleteMedia, getMedia, MediaError, setDefaultAltText } from '#lib/server/media/storage.js';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsed = z
		.object({ altText: z.string().max(1000) })
		.safeParse(await request.json().catch(() => null));
	if (!parsed.success)
		return Response.json({ error: 'Alt text must be under 1000 characters.' }, { status: 400 });
	if (!getMedia(params.id)) return Response.json({ error: 'Not found' }, { status: 404 });
	setDefaultAltText(params.id, parsed.data.altText);
	return Response.json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await deleteMedia(params.id);
		return Response.json({ ok: true });
	} catch (err) {
		if (err instanceof MediaError) return Response.json({ error: err.message }, { status: 409 });
		throw err;
	}
};
