import { getMedia } from '#lib/server/media/storage.js';
import { serveFile } from '#lib/server/media/serve.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, request }) => {
	const m = getMedia(params.id);
	if (!m) return new Response('Not found', { status: 404 });
	return m.thumbFilename
		? serveFile(m.thumbFilename, 'image/jpeg', request)
		: serveFile(m.filename, m.mime, request);
};
