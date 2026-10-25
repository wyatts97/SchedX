import { listDrafts } from '#lib/server/posts/service.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ drafts: listDrafts() });
