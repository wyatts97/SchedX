import { z } from 'zod';
import { getAccount } from '#lib/server/x/accounts.js';
import { reorderQueue, setSlots, shuffleQueue } from '#lib/server/scheduler/queue.js';
import type { RequestHandler } from './$types';

const body = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('slots'),
		slots: z
			.array(
				z.object({
					weekday: z.number().int().min(1).max(7),
					minutes: z.number().int().min(0).max(1439)
				})
			)
			.max(7 * 48)
	}),
	z.object({ action: z.literal('reorder'), ids: z.array(z.string()).max(1000) }),
	z.object({ action: z.literal('shuffle') })
]);

export const POST: RequestHandler = async ({ params, request }) => {
	if (!getAccount(params.accountId))
		return Response.json({ error: 'Account not found' }, { status: 404 });
	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });
	const input = parsed.data;
	if (input.action === 'slots') setSlots(params.accountId, input.slots);
	else if (input.action === 'reorder') reorderQueue(params.accountId, input.ids);
	else shuffleQueue(params.accountId);
	return Response.json({ ok: true });
};
