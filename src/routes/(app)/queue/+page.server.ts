import { getSlots, nextFreeSlot } from '#lib/server/scheduler/queue.js';
import { listQueue } from '#lib/server/posts/service.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { accounts, tz } = await parent();
	const requested = url.searchParams.get('account');
	const account =
		accounts.find((a) => a.id === requested) ?? accounts.find((a) => a.isDefault) ?? accounts[0];
	if (!account) return { accountId: null, slots: [], queue: [], nextSlot: null };
	return {
		accountId: account.id,
		slots: getSlots(account.id),
		queue: listQueue(account.id),
		nextSlot: nextFreeSlot(account.id, tz)
	};
};
