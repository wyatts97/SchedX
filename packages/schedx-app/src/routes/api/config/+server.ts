import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	// Read environment variables and expose only client-safe values
	const bodySizeLimit = parseInt(process.env.BODY_SIZE_LIMIT || '10485760'); // 10MB default
	const maxUploadSize = parseInt(process.env.MAX_UPLOAD_SIZE || '5242880'); // 5MB default

	return json({
		config: {
			// File upload limits
			MAX_FILE_SIZE: bodySizeLimit,
			MAX_UPLOAD_SIZE: maxUploadSize,

			// Media upload settings
			MAX_MEDIA_FILES: 4,
			ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
			ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/mov', 'video/avi', 'video/webm'],

			// Avatar upload settings (5MB max)
			MAX_AVATAR_SIZE: 5 * 1024 * 1024, // 5MB in bytes
			ALLOWED_AVATAR_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
		}
	});
};
