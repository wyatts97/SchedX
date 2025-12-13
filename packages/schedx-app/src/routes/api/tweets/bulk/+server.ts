/**
 * Bulk Operations API for Tweets
 * Supports: bulk delete, bulk reschedule, bulk move to queue
 */

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getDbInstance, getRawDbInstance } from '$lib/server/db';
import { TweetStatus } from '@schedx/shared-lib/types/types';
import logger from '$lib/server/logger';
import { getAdminUserId } from '$lib/server/adminCache';
import { z } from 'zod';

// Validation schemas
const bulkDeleteSchema = z.object({
	action: z.literal('delete'),
	tweetIds: z.array(z.string()).min(1, 'At least one tweet ID is required').max(100, 'Maximum 100 tweets per operation')
});

const bulkRescheduleSchema = z.object({
	action: z.literal('reschedule'),
	tweetIds: z.array(z.string()).min(1, 'At least one tweet ID is required').max(100, 'Maximum 100 tweets per operation'),
	scheduledDate: z.coerce.date()
});

const bulkMoveToQueueSchema = z.object({
	action: z.literal('move_to_queue'),
	tweetIds: z.array(z.string()).min(1, 'At least one tweet ID is required').max(100, 'Maximum 100 tweets per operation')
});

const bulkChangeStatusSchema = z.object({
	action: z.literal('change_status'),
	tweetIds: z.array(z.string()).min(1, 'At least one tweet ID is required').max(100, 'Maximum 100 tweets per operation'),
	status: z.enum(['draft', 'scheduled', 'queued'])
});

const bulkOperationSchema = z.discriminatedUnion('action', [
	bulkDeleteSchema,
	bulkRescheduleSchema,
	bulkMoveToQueueSchema,
	bulkChangeStatusSchema
]);

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		// Validate admin session
		const adminSession = cookies.get('admin_session');
		if (!adminSession) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = await getAdminUserId();
		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		
		// Validate request body
		const parseResult = bulkOperationSchema.safeParse(body);
		if (!parseResult.success) {
			return json({ 
				error: 'Invalid request',
				details: parseResult.error.errors.map(e => e.message)
			}, { status: 400 });
		}

		const data = parseResult.data;
		const rawDb = getRawDbInstance();

		// Verify all tweets belong to this user
		const placeholders = data.tweetIds.map(() => '?').join(',');
		const userTweets = rawDb.query(
			`SELECT id FROM tweets WHERE id IN (${placeholders}) AND userId = ?`,
			[...data.tweetIds, userId]
		);

		if (userTweets.length !== data.tweetIds.length) {
			return json({ 
				error: 'Some tweets not found or not owned by user',
				found: userTweets.length,
				requested: data.tweetIds.length
			}, { status: 400 });
		}

		let result: { success: boolean; affected: number; message: string };

		switch (data.action) {
			case 'delete':
				result = await handleBulkDelete(rawDb, data.tweetIds, userId);
				break;

			case 'reschedule':
				result = await handleBulkReschedule(rawDb, data.tweetIds, data.scheduledDate, userId);
				break;

			case 'move_to_queue':
				result = await handleBulkMoveToQueue(rawDb, data.tweetIds, userId);
				break;

			case 'change_status':
				result = await handleBulkChangeStatus(rawDb, data.tweetIds, data.status, userId);
				break;

			default:
				return json({ error: 'Unknown action' }, { status: 400 });
		}

		logger.info(`Bulk operation completed: ${data.action} - ${result.affected}/${data.tweetIds.length} tweets affected`);

		return json(result);
	} catch (error) {
		logger.error(`Bulk operation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		return json({ 
			error: 'Failed to perform bulk operation',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};

async function handleBulkDelete(
	rawDb: any, 
	tweetIds: string[], 
	userId: string
): Promise<{ success: boolean; affected: number; message: string }> {
	const placeholders = tweetIds.map(() => '?').join(',');
	
	// Only delete tweets that are not already posted
	const result = rawDb.execute(
		`DELETE FROM tweets 
		 WHERE id IN (${placeholders}) 
		 AND userId = ? 
		 AND status != ?`,
		[...tweetIds, userId, TweetStatus.POSTED]
	);

	return {
		success: true,
		affected: result.changes || 0,
		message: `Deleted ${result.changes || 0} tweets`
	};
}

async function handleBulkReschedule(
	rawDb: any, 
	tweetIds: string[], 
	scheduledDate: Date,
	userId: string
): Promise<{ success: boolean; affected: number; message: string }> {
	// Validate date is in the future
	if (scheduledDate.getTime() < Date.now()) {
		return {
			success: false,
			affected: 0,
			message: 'Scheduled date must be in the future'
		};
	}

	const placeholders = tweetIds.map(() => '?').join(',');
	
	// Only reschedule tweets that are scheduled, draft, or queued
	const result = rawDb.execute(
		`UPDATE tweets 
		 SET scheduledDate = ?, 
			 status = ?, 
			 updatedAt = ?,
			 nextRetryAt = NULL,
			 retryCount = 0
		 WHERE id IN (${placeholders}) 
		 AND userId = ? 
		 AND status IN (?, ?, ?, ?)`,
		[
			scheduledDate.getTime(),
			TweetStatus.SCHEDULED,
			Date.now(),
			...tweetIds,
			userId,
			TweetStatus.SCHEDULED,
			TweetStatus.DRAFT,
			TweetStatus.QUEUED,
			TweetStatus.FAILED
		]
	);

	return {
		success: true,
		affected: result.changes || 0,
		message: `Rescheduled ${result.changes || 0} tweets to ${scheduledDate.toISOString()}`
	};
}

async function handleBulkMoveToQueue(
	rawDb: any, 
	tweetIds: string[],
	userId: string
): Promise<{ success: boolean; affected: number; message: string }> {
	const placeholders = tweetIds.map(() => '?').join(',');
	
	// Get current max queue position
	const maxPosResult = rawDb.queryOne(
		`SELECT MAX(queuePosition) as maxPos FROM tweets WHERE userId = ? AND status = ?`,
		[userId, TweetStatus.QUEUED]
	);
	let nextPosition = (maxPosResult?.maxPos || 0) + 1;

	// Move each tweet to queue with incrementing position
	let affected = 0;
	for (const tweetId of tweetIds) {
		const result = rawDb.execute(
			`UPDATE tweets 
			 SET status = ?, 
				 queuePosition = ?,
				 updatedAt = ?
			 WHERE id = ? 
			 AND userId = ? 
			 AND status IN (?, ?, ?)`,
			[
				TweetStatus.QUEUED,
				nextPosition,
				Date.now(),
				tweetId,
				userId,
				TweetStatus.SCHEDULED,
				TweetStatus.DRAFT,
				TweetStatus.FAILED
			]
		);
		if (result.changes > 0) {
			affected++;
			nextPosition++;
		}
	}

	return {
		success: true,
		affected,
		message: `Moved ${affected} tweets to queue`
	};
}

async function handleBulkChangeStatus(
	rawDb: any, 
	tweetIds: string[], 
	status: 'draft' | 'scheduled' | 'queued',
	userId: string
): Promise<{ success: boolean; affected: number; message: string }> {
	const placeholders = tweetIds.map(() => '?').join(',');
	
	const statusMap: Record<string, TweetStatus> = {
		'draft': TweetStatus.DRAFT,
		'scheduled': TweetStatus.SCHEDULED,
		'queued': TweetStatus.QUEUED
	};

	const newStatus = statusMap[status];
	
	// Only change status for non-posted tweets
	const result = rawDb.execute(
		`UPDATE tweets 
		 SET status = ?, 
			 updatedAt = ?
		 WHERE id IN (${placeholders}) 
		 AND userId = ? 
		 AND status != ?`,
		[
			newStatus,
			Date.now(),
			...tweetIds,
			userId,
			TweetStatus.POSTED
		]
	);

	return {
		success: true,
		affected: result.changes || 0,
		message: `Changed ${result.changes || 0} tweets to ${status}`
	};
}
