import { resumePublishing } from '#lib/server/scheduler/loop.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = () => Response.json({ resumed: resumePublishing() });
