import { listMedia } from '#lib/server/media/storage.js';
import { rt } from '#lib/server/runtime.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	media: listMedia(),
	maxUploadMb: Math.round(rt().maxUploadBytes / 1048576)
});
