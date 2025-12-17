import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pushNotificationService } from '$lib/server/pushNotificationService';

/**
 * GET /api/push - Get VAPID public key for client subscription
 */
export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const publicKey = pushNotificationService.getPublicKey();
	const enabled = pushNotificationService.isEnabled();

	return json({
		enabled,
		publicKey: enabled ? publicKey : null
	});
};

/**
 * POST /api/push - Subscribe to push notifications
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!pushNotificationService.isEnabled()) {
		return json({ error: 'Push notifications not configured' }, { status: 503 });
	}

	try {
		const { subscription } = await request.json();

		if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
			return json({ error: 'Invalid subscription data' }, { status: 400 });
		}

		await pushNotificationService.saveSubscription(session.user.id, {
			endpoint: subscription.endpoint,
			keys: {
				p256dh: subscription.keys.p256dh,
				auth: subscription.keys.auth
			}
		});

		return json({ success: true, message: 'Subscription saved' });
	} catch (error) {
		console.error('Failed to save push subscription:', error);
		return json({ error: 'Failed to save subscription' }, { status: 500 });
	}
};

/**
 * DELETE /api/push - Unsubscribe from push notifications
 */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { endpoint } = await request.json();

		if (!endpoint) {
			return json({ error: 'Endpoint required' }, { status: 400 });
		}

		await pushNotificationService.removeSubscription(session.user.id, endpoint);

		return json({ success: true, message: 'Subscription removed' });
	} catch (error) {
		console.error('Failed to remove push subscription:', error);
		return json({ error: 'Failed to remove subscription' }, { status: 500 });
	}
};
