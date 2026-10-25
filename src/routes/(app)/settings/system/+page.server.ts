import path from 'node:path';
import { fail } from '@sveltejs/kit';
import {
	backupDatabase,
	getHeartbeat,
	listBackups,
	schedulerRunning
} from '#lib/server/scheduler/loop.js';
import { rt } from '#lib/server/runtime.js';
import { listAccounts } from '#lib/server/x/accounts.js';
import { csvToCompose } from '#lib/server/posts/csv.js';
import { ComposeError, savePost } from '#lib/server/posts/service.js';
import { version } from '$app/env';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	backups: await listBackups(),
	scheduler: { running: schedulerRunning(), heartbeat: getHeartbeat() },
	info: {
		version,
		dataDir: path.resolve(rt().dataDir),
		xMode: rt().xMode,
		node: process.version
	}
});

export const actions: Actions = {
	backup: async () => {
		const file = await backupDatabase();
		return { backedUp: path.basename(file) };
	},
	import: async ({ request, locals }) => {
		const form = await request.formData();
		const file = form.get('csv');
		if (!(file instanceof File) || file.size === 0)
			return fail(400, { importError: 'Choose a CSV file.' });
		if (file.size > 2_000_000) return fail(400, { importError: 'CSV files are limited to 2 MB.' });
		const results = csvToCompose(await file.text(), listAccounts(), locals.user!.timezone);
		const errors: string[] = [];
		let created = 0;
		for (const r of results) {
			if (r.error || !r.input) {
				errors.push(`Line ${r.line}: ${r.error}`);
				continue;
			}
			try {
				savePost(r.input);
				created++;
			} catch (err) {
				errors.push(
					`Line ${r.line}: ${err instanceof ComposeError ? err.message : 'could not be saved'}`
				);
			}
		}
		return { imported: created, importErrors: errors.slice(0, 50) };
	}
};
