import { sql } from 'drizzle-orm';
import * as schema from './schema.js';

/** SQL expression for a post's scheduled time: keep it if in the future, otherwise now. */
export function notInPast() {
	const now = Date.now();
	return sql<number>`max(coalesce(${schema.posts.scheduledAt}, ${now}), ${now})`;
}
