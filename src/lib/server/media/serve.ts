import fs from 'node:fs';
import { Readable } from 'node:stream';
import { mediaFileStat, mediaPath } from './storage.js';

/** Streams a stored media file, honouring HTTP Range so videos can seek. */
export function serveFile(filename: string, mime: string, request: Request): Response {
	const stat = mediaFileStat(filename);
	if (!stat) return new Response('Not found', { status: 404 });
	const headers: Record<string, string> = {
		'content-type': mime,
		'accept-ranges': 'bytes',
		'cache-control': 'private, max-age=31536000, immutable',
		'x-content-type-options': 'nosniff'
	};
	const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
	if (range) {
		let start = range[1] ? Number(range[1]) : stat.size - Number(range[2]);
		let end = range[1] && range[2] ? Number(range[2]) : stat.size - 1;
		start = Math.max(0, start);
		end = Math.min(end, stat.size - 1);
		if (start > end) {
			return new Response(null, {
				status: 416,
				headers: { 'content-range': `bytes */${stat.size}` }
			});
		}
		const stream = fs.createReadStream(mediaPath(filename), { start, end });
		return new Response(Readable.toWeb(stream) as ReadableStream, {
			status: 206,
			headers: {
				...headers,
				'content-range': `bytes ${start}-${end}/${stat.size}`,
				'content-length': String(end - start + 1)
			}
		});
	}
	const stream = fs.createReadStream(mediaPath(filename));
	return new Response(Readable.toWeb(stream) as ReadableStream, {
		headers: { ...headers, 'content-length': String(stat.size) }
	});
}
