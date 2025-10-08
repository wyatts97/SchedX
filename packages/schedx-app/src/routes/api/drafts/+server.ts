import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import type { Tweet } from '@schedx/shared-lib/types/types';
import logger from '$lib/server/logger';

export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}
	try {
		const db = getDbInstance();
		const drafts = await db.getDrafts(session.user.id);
		return new Response(JSON.stringify({ drafts }), { status: 200 });
	} catch (error) {
		logger.error('Error fetching drafts');
		return new Response(JSON.stringify({ error: 'Failed to fetch drafts' }), { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}
	try {
		const data = await request.json();
		const db = getDbInstance();
		const draft: any = {
			userId: session.user.id,
			content: data.content,
			scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : new Date(),
			community: data.community || 'general',
			status: 'draft' as any,
			createdAt: new Date(),
			media: data.media || [],
			twitterAccountId: data.twitterAccountId,
			templateName: data.templateName,
			templateCategory: data.templateCategory,
			recurrenceType: data.recurrenceType,
			recurrenceInterval: data.recurrenceInterval,
			recurrenceEndDate: data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : undefined
		};
		const draftId = await db.saveDraft(draft as Tweet);
		return new Response(JSON.stringify({ id: draftId, success: true }), { status: 201 });
	} catch (error) {
		logger.error('Error creating draft');
		return new Response(JSON.stringify({ error: 'Failed to create draft' }), { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}
	try {
		const data = await request.json();
		const { id, ...updates } = data;
		if (!id) {
			return new Response(JSON.stringify({ error: 'Draft ID is required' }), { status: 400 });
		}
		const db = getDbInstance();
		await db.updateDraft(id, session.user.id, updates);
		return new Response(JSON.stringify({ success: true }), { status: 200 });
	} catch (error) {
		logger.error('Error updating draft');
		return new Response(JSON.stringify({ error: 'Failed to update draft' }), { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}
	try {
		const { id } = await request.json();
		if (!id) {
			return new Response(JSON.stringify({ error: 'Draft ID is required' }), { status: 400 });
		}
		const db = getDbInstance();
		await db.deleteDraft(id, session.user.id);
		return new Response(JSON.stringify({ success: true }), { status: 200 });
	} catch (error) {
		logger.error('Error deleting draft');
		return new Response(JSON.stringify({ error: 'Failed to delete draft' }), { status: 500 });
	}
};
