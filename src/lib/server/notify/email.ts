import { logger } from '../logger.js';
import type { Notification } from './index.js';

/**
 * Email delivery is intentionally stubbed for now: it keeps the same interface as push so a
 * real provider (e.g. Resend) can be dropped in later without touching callers.
 */
export async function sendEmail(n: Notification): Promise<void> {
	logger.debug({ event: n.event, title: n.title }, 'email notification (stub, not sent)');
}
