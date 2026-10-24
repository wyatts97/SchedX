import { listMedia, MediaError, saveMedia, toInfo } from '#lib/server/media/storage.js';
import { rt } from '#lib/server/runtime.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => Response.json({ media: listMedia() });

export const POST: RequestHandler = async ({ request }) => {
	const length = Number(request.headers.get('content-length') ?? 0);
	if (length > rt().maxUploadBytes + 1024 * 1024) {
		return Response.json(
			{ error: `Files are limited to ${Math.round(rt().maxUploadBytes / 1048576)} MB.` },
			{ status: 413 }
		);
	}
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return Response.json({ error: 'Upload could not be read.' }, { status: 400 });
	}
	const file = form.get('file');
	if (!(file instanceof File) || file.size === 0)
		return Response.json({ error: 'No file received.' }, { status: 400 });
	const thumb = form.get('thumb');
	const num = (key: string) => {
		const v = Number(form.get(key));
		return Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;
	};
	try {
		const row = await saveMedia({
			data: Buffer.from(await file.arrayBuffer()),
			mime: file.type,
			originalName: file.name || 'upload',
			thumb:
				thumb instanceof File && thumb.size > 0 && thumb.size < 2_000_000
					? Buffer.from(await thumb.arrayBuffer())
					: undefined,
			durationMs: num('durationMs'),
			width: num('width'),
			height: num('height')
		});
		return Response.json(toInfo(row), { status: 201 });
	} catch (err) {
		if (err instanceof MediaError) return Response.json({ error: err.message }, { status: 400 });
		throw err;
	}
};
