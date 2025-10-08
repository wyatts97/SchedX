import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import type { Tweet } from '@schedx/shared-lib/types/types';
import logger from '$lib/logger';

export const GET: RequestHandler = async ({ cookies }) => {
	// Check if user is authenticated (admin)
	const adminSession = cookies.get('admin_session');
	if (!adminSession || adminSession.trim() === '') {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}
	try {
		const db = getDbInstance();
		const templates = await db.getTemplates('admin');
		return new Response(JSON.stringify({ templates }), { status: 200 });
	} catch (error) {
		logger.error('Error fetching templates');
		return new Response(JSON.stringify({ error: 'Failed to fetch templates' }), { status: 500 });
	}
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	// Check if user is authenticated (admin)
	const adminSession = cookies.get('admin_session');
	if (!adminSession || adminSession.trim() === '') {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}
	try {
		const data = await request.json();
		const db = getDbInstance();
		const template: any = {
			userId: 'admin',
			content: data.content,
			scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : new Date(),
			community: data.community || 'general',
			status: 'draft' as any, // Templates are stored as drafts with templateName
			createdAt: new Date(),
			media: data.media || [],
			twitterAccountId: data.twitterAccountId,
			templateName: data.templateName,
			templateCategory: data.templateCategory,
			recurrenceType: data.recurrenceType,
			recurrenceInterval: data.recurrenceInterval,
			recurrenceEndDate: data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : undefined
		};
		const templateId = await db.saveDraft(template as Tweet); // Save as draft with templateName
		return new Response(JSON.stringify({ id: templateId, success: true }), { status: 201 });
	} catch (error) {
		logger.error('Error creating template');
		return new Response(JSON.stringify({ error: 'Failed to create template' }), { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ cookies, request }) => {
	// Check if user is authenticated (admin)
	const adminSession = cookies.get('admin_session');
	if (!adminSession || adminSession.trim() === '') {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}
	try {
		const data = await request.json();
		const { id, ...updates } = data;
		if (!id) {
			return new Response(JSON.stringify({ error: 'Template ID is required' }), { status: 400 });
		}
		const db = getDbInstance();
		await db.updateDraft(id, 'admin', updates); // Update by id
		return new Response(JSON.stringify({ success: true }), { status: 200 });
	} catch (error) {
		logger.error('Error updating template');
		return new Response(JSON.stringify({ error: 'Failed to update template' }), { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ cookies, request }) => {
	// Check if user is authenticated (admin)
	const adminSession = cookies.get('admin_session');
	if (!adminSession || adminSession.trim() === '') {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}
	try {
		const { id } = await request.json();
		if (!id) {
			return new Response(JSON.stringify({ error: 'Template ID is required' }), { status: 400 });
		}
		const db = getDbInstance();
		await db.deleteDraft(id, 'admin'); // Delete by id
		return new Response(JSON.stringify({ success: true }), { status: 200 });
	} catch (error) {
		logger.error('Error deleting template');
		return new Response(JSON.stringify({ error: 'Failed to delete template' }), { status: 500 });
	}
};
