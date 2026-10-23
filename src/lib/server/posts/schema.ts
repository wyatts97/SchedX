import { z } from 'zod';
import type { ComposeInput } from '../../shared/compose.js';

const pollSchema = z.object({
	options: z
		.array(z.string().trim().min(1, 'Poll options cannot be empty').max(25, 'Poll options are max 25 characters'))
		.min(2, 'A poll needs at least 2 options')
		.max(4, 'A poll can have at most 4 options'),
	durationMinutes: z.number().int().min(5).max(10080)
});

export const composeSchema = z.object({
	id: z.string().optional(),
	accountIds: z.array(z.string()).min(1, 'Choose an account'),
	items: z
		.array(
			z.object({
				text: z.string().max(25_000),
				media: z
					.array(z.object({ id: z.string(), altText: z.string().max(1000).default('') }))
					.max(4),
				poll: pollSchema.nullable().optional()
			})
		)
		.min(1)
		.max(25, 'Threads are limited to 25 posts'),
	options: z
		.object({
			replySettings: z.enum(['everyone', 'following', 'mentionedUsers', 'subscribers', 'verified']).optional(),
			communityId: z.string().trim().regex(/^\d*$/, 'Community ID must be numeric').optional(),
			shareWithFollowers: z.boolean().optional(),
			madeWithAi: z.boolean().optional(),
			paidPartnership: z.boolean().optional()
		})
		.default({}),
	action: z.enum(['draft', 'schedule', 'queue', 'now']),
	scheduledAt: z.number().int().nullable().optional(),
	recurrence: z
		.object({
			freq: z.enum(['daily', 'weekly', 'monthly']),
			interval: z.number().int().min(1).max(30),
			until: z.number().int().nullable()
		})
		.nullable()
		.optional()
}) satisfies z.ZodType<ComposeInput, unknown>;
