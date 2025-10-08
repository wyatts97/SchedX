import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals, url }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}
	const userId = session.user.id;
	const status = url.searchParams.get('status') as 'unread' | 'read' | undefined;
	try {
		const notifications = await getDbInstance().getNotifications(userId, status);
		return new Response(JSON.stringify({ notifications }), { status: 200 });
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Failed to fetch notifications' }), {
			status: 500
		});
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}
	const userId = session.user.id;
	const { notificationId } = await request.json();
	if (!notificationId) {
		return new Response(JSON.stringify({ error: 'Notification ID is required' }), { status: 400 });
	}
	try {
		await getDbInstance().markNotificationAsRead(notificationId, userId);
		return new Response(JSON.stringify({ success: true }), { status: 200 });
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Failed to mark notification as read' }), {
			status: 500
		});
	}
};
