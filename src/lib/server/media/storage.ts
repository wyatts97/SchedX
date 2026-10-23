import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { dataPath, rt } from '../runtime.js';
import { X_LIMITS, kindForMime } from '../../shared/media-rules.js';
import type { MediaInfo } from '../../shared/compose.js';

export type MediaRow = typeof schema.media.$inferSelect;

const MAX_IMAGE_EDGE = 4096;
const THUMB_EDGE = 480;
const EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'video/mp4': 'mp4',
	'video/quicktime': 'mov'
};

export class MediaError extends Error {}

export function uploadsDir(): string {
	return dataPath('uploads');
}

export function mediaPath(filename: string): string {
	// Filenames are generated from UUIDs; reject anything else defensively.
	if (!/^[a-f0-9-]+(_thumb)?\.[a-z0-9]+$/.test(filename)) throw new MediaError('Invalid media filename');
	return path.join(uploadsDir(), filename);
}

export function toInfo(m: MediaRow): MediaInfo {
	return {
		id: m.id,
		kind: m.kind,
		mime: m.mime,
		size: m.size,
		width: m.width,
		height: m.height,
		durationMs: m.durationMs,
		altText: m.altText,
		originalName: m.originalName,
		url: `/media/${m.id}`,
		thumbUrl: m.thumbFilename ? `/media/${m.id}/thumb` : `/media/${m.id}`,
		createdAt: m.createdAt
	};
}

async function normaliseImage(input: Buffer, mime: string) {
	const img = sharp(input, { failOn: 'error' }).rotate();
	const meta = await img.metadata();
	const tooBig = input.length > X_LIMITS.image;
	const tooWide = (meta.width ?? 0) > MAX_IMAGE_EDGE || (meta.height ?? 0) > MAX_IMAGE_EDGE;
	if (!tooBig && !tooWide && meta.orientation === undefined) {
		return { data: input, mime, width: meta.width ?? null, height: meta.height ?? null };
	}
	let pipeline = img.resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: 'inside', withoutEnlargement: true });
	let outMime = mime;
	if (mime === 'image/png' && !meta.hasAlpha) {
		pipeline = pipeline.jpeg({ quality: 88, mozjpeg: true });
		outMime = 'image/jpeg';
	} else if (mime === 'image/jpeg') {
		pipeline = pipeline.jpeg({ quality: 88, mozjpeg: true });
	}
	let { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
	for (let quality = 80; data.length > X_LIMITS.image && quality >= 50; quality -= 10) {
		({ data, info } = await sharp(data)
			.flatten({ background: '#ffffff' })
			.jpeg({ quality, mozjpeg: true })
			.toBuffer({ resolveWithObject: true }));
		outMime = 'image/jpeg';
	}
	if (data.length > X_LIMITS.image) throw new MediaError('Image is too large even after compression.');
	return { data, mime: outMime, width: info.width, height: info.height };
}

export interface UploadInput {
	data: Buffer;
	mime: string;
	originalName: string;
	/** Client-generated JPEG poster frame for videos. */
	thumb?: Buffer;
	durationMs?: number;
	width?: number;
	height?: number;
}

export async function saveMedia(input: UploadInput): Promise<MediaRow> {
	const kind = kindForMime(input.mime);
	if (!kind) throw new MediaError(`Unsupported file type: ${input.mime || 'unknown'}`);
	const max = Math.min(X_LIMITS[kind], kind === 'image' ? Infinity : rt().maxUploadBytes);
	if (kind !== 'image' && input.data.length > max) {
		throw new MediaError(`File is too large (max ${Math.round(max / 1024 / 1024)} MB for ${kind}s).`);
	}

	const id = crypto.randomUUID();
	await fsp.mkdir(uploadsDir(), { recursive: true });

	let data = input.data;
	let mime = input.mime;
	let width = input.width ?? null;
	let height = input.height ?? null;
	let thumb: Buffer | undefined = input.thumb;

	try {
		if (kind === 'image') {
			({ data, mime, width, height } = await normaliseImage(input.data, input.mime));
		}
		if (kind !== 'video') {
			const meta = await sharp(data, { animated: false }).metadata();
			width ??= meta.width ?? null;
			height ??= meta.height ?? null;
			thumb = await sharp(data, { animated: false })
				.rotate()
				.resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'inside', withoutEnlargement: true })
				.jpeg({ quality: 75 })
				.toBuffer();
		}
	} catch (err) {
		if (err instanceof MediaError) throw err;
		throw new MediaError('Could not read this image. Is the file valid?');
	}

	const filename = `${id}.${EXT[mime]}`;
	const thumbFilename = thumb ? `${id}_thumb.jpg` : null;
	await fsp.writeFile(mediaPath(filename), data);
	if (thumb && thumbFilename) await fsp.writeFile(mediaPath(thumbFilename), thumb);

	return getDb()
		.insert(schema.media)
		.values({
			id,
			filename,
			originalName: input.originalName.slice(0, 200),
			mime,
			kind,
			size: data.length,
			width,
			height,
			durationMs: input.durationMs ?? null,
			thumbFilename
		})
		.returning()
		.get();
}

export function getMedia(id: string): MediaRow | undefined {
	return getDb().select().from(schema.media).where(eq(schema.media.id, id)).get();
}

export function listMedia(): (MediaInfo & { uses: number })[] {
	const usage = getDb()
		.select({ mediaId: schema.postItemMedia.mediaId, n: sql<number>`count(*)` })
		.from(schema.postItemMedia)
		.groupBy(schema.postItemMedia.mediaId)
		.all();
	const uses = new Map(usage.map((u) => [u.mediaId, u.n]));
	return getDb()
		.select()
		.from(schema.media)
		.orderBy(desc(schema.media.createdAt))
		.all()
		.map((m) => ({ ...toInfo(m), uses: uses.get(m.id) ?? 0 }));
}

export function setDefaultAltText(id: string, altText: string): void {
	getDb()
		.update(schema.media)
		.set({ altText: altText.slice(0, 1000) })
		.where(eq(schema.media.id, id))
		.run();
}

export async function deleteMedia(id: string): Promise<void> {
	const m = getMedia(id);
	if (!m) return;
	const used = getDb()
		.select({ n: sql<number>`count(*)` })
		.from(schema.postItemMedia)
		.where(eq(schema.postItemMedia.mediaId, id))
		.get()!.n;
	if (used > 0) throw new MediaError(`This media is attached to ${used} post(s). Remove it from them first.`);
	getDb().delete(schema.media).where(eq(schema.media.id, id)).run();
	for (const f of [m.filename, m.thumbFilename]) {
		if (f) await fsp.rm(mediaPath(f), { force: true });
	}
}

export function readMediaFile(m: MediaRow): Promise<Buffer> {
	return fsp.readFile(mediaPath(m.filename));
}

export function mediaFileStat(filename: string): fs.Stats | null {
	try {
		return fs.statSync(mediaPath(filename));
	} catch {
		return null;
	}
}
