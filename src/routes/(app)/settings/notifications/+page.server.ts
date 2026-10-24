import { getSettings, setSetting } from '#lib/server/settings.js';
import { pushEnabled, subscriptionCount, vapidPublicKey } from '#lib/server/notify/push.js';
import { NOTIFICATION_EVENTS, type NotificationEvent } from '#lib/shared/types.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	prefs: getSettings().notifications,
	pushEnabled: pushEnabled(),
	vapidKey: vapidPublicKey() ?? null,
	devices: subscriptionCount()
});

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const prefs = Object.fromEntries(
			NOTIFICATION_EVENTS.map((e) => [e.id, form.get(e.id) === 'on'])
		) as Record<NotificationEvent, boolean>;
		setSetting('notifications', prefs);
		return { saved: true };
	}
};
