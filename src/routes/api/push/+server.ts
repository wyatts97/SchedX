import { z } from 'zod';
import { removeSubscription, saveSubscription, pushEnabled } from '#lib/server/notify/push.js';
import { sendPush } from '#lib/server/notify/push.js';
import type { RequestHandler } from './$types';

const subscription = z.object({
	endpoint: z.url(),
	keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) })
});

export const POST: RequestHandler = async ({ request }) => {
	if (!pushEnabled())
		return Response.json({ error: 'Push is not configured on the server.' }, { status: 400 });
	const body = await request.json().catch(() => null);
	if (body?.test) {
		await sendPush({
			event: 'published',
			title: 'SchedX test',
			body: 'Push notifications are working.',
			url: '/settings/notifications'
		});
		return Response.json({ ok: true });
	}
	const parsed = subscription.safeParse(body);
	if (!parsed.success) return Response.json({ error: 'Invalid subscription' }, { status: 400 });
	saveSubscription(
		{ endpoint: parsed.data.endpoint, ...parsed.data.keys },
		request.headers.get('user-agent') ?? undefined
	);
	return Response.json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (typeof body?.endpoint === 'string') removeSubscription(body.endpoint);
	return Response.json({ ok: true });
};
