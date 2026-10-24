import { fail } from '@sveltejs/kit';
import { updateTimezone } from '#lib/server/auth/index.js';
import { getSettings, setSetting } from '#lib/server/settings.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ catchUpMinutes: getSettings().catchUpMinutes });

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const timezone = String(form.get('timezone') ?? '');
		const catchUp = Number(form.get('catchUpMinutes'));
		try {
			new Intl.DateTimeFormat(undefined, { timeZone: timezone });
		} catch {
			return fail(400, { error: 'Unknown time zone.' });
		}
		if (!Number.isInteger(catchUp) || catchUp < 0 || catchUp > 24 * 60) {
			return fail(400, { error: 'Catch-up window must be between 0 and 1440 minutes.' });
		}
		updateTimezone(locals.user!.id, timezone);
		setSetting('catchUpMinutes', catchUp);
		return { saved: true };
	}
};
