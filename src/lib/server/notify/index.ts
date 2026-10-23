import { getSettings } from '../settings.js';
import { logger, errorMessage } from '../logger.js';
import { sendPush } from './push.js';
import { sendEmail } from './email.js';
import type { NotificationEvent } from '../../shared/types.js';

export interface Notification {
	event: NotificationEvent;
	title: string;
	body: string;
	/** In-app path to open when the notification is clicked. */
	url?: string;
}

/** Fan a notification out to every enabled channel. Never throws. */
export async function notify(n: Notification): Promise<void> {
	try {
		if (!getSettings().notifications[n.event]) return;
		await Promise.allSettled([sendPush(n), sendEmail(n)]);
	} catch (err) {
		logger.warn({ err: errorMessage(err), event: n.event }, 'notification failed');
	}
}
