import type { MediaInfo } from '#lib/shared/compose.js';

/** Grabs a poster frame and duration from a video file in the browser (no ffmpeg needed). */
export async function videoPoster(
	file: File
): Promise<{ thumb: Blob | null; durationMs: number; width: number; height: number }> {
	const url = URL.createObjectURL(file);
	try {
		const video = document.createElement('video');
		video.muted = true;
		video.playsInline = true;
		video.preload = 'metadata';
		video.src = url;
		await new Promise<void>((resolve, reject) => {
			video.onloadedmetadata = () => resolve();
			video.onerror = () => reject(new Error('Could not read video'));
		});
		const durationMs = Math.round(video.duration * 1000);
		video.currentTime = Math.min(1, video.duration / 2);
		await new Promise<void>((resolve) => {
			video.onseeked = () => resolve();
			setTimeout(resolve, 3000);
		});
		const canvas = document.createElement('canvas');
		const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
		canvas.width = Math.round(video.videoWidth * scale);
		canvas.height = Math.round(video.videoHeight * scale);
		canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
		const thumb = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
		return { thumb, durationMs, width: video.videoWidth, height: video.videoHeight };
	} catch {
		return { thumb: null, durationMs: 0, width: 0, height: 0 };
	} finally {
		URL.revokeObjectURL(url);
	}
}

/** Uploads a file to the media library, reporting progress (0–1). */
export async function uploadMedia(file: File, onProgress: (p: number) => void): Promise<MediaInfo> {
	const form = new FormData();
	form.append('file', file);
	if (file.type.startsWith('video/')) {
		const poster = await videoPoster(file);
		if (poster.thumb) form.append('thumb', poster.thumb, 'thumb.jpg');
		form.append('durationMs', String(poster.durationMs));
		form.append('width', String(poster.width));
		form.append('height', String(poster.height));
	}
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', '/api/media');
		xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
		xhr.onload = () => {
			let body: { error?: string } & Partial<MediaInfo> = {};
			try {
				body = JSON.parse(xhr.responseText);
			} catch {
				/* ignore */
			}
			if (xhr.status >= 200 && xhr.status < 300) resolve(body as MediaInfo);
			else if (xhr.status === 413)
				reject(new Error(`${file.name} is larger than the server allows.`));
			else reject(new Error(body.error ?? `Upload failed (${xhr.status})`));
		};
		xhr.onerror = () => reject(new Error('Upload failed: network error'));
		xhr.send(form);
	});
}
