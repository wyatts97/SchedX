import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import logger from '$lib/logger';

export const GET: RequestHandler = async () => {
	try {
		const uploadsDir = path.resolve(process.cwd(), 'uploads');
		const avatarsDir = path.resolve(process.cwd(), 'uploads/avatars');

		const uploadsExists = existsSync(uploadsDir);
		const avatarsExists = existsSync(avatarsDir);

		let uploadsFiles: string[] = [];
		let avatarsFiles: string[] = [];

		if (uploadsExists) {
			try {
				uploadsFiles = readdirSync(uploadsDir);
			} catch (error) {
				logger.error('Error reading uploads directory');
			}
		}

		if (avatarsExists) {
			try {
				avatarsFiles = readdirSync(avatarsDir);
			} catch (error) {
				logger.error('Error reading avatars directory');
			}
		}

		return json({
			debug: {
				uploadsDir,
				avatarsDir,
				uploadsExists,
				avatarsExists,
				uploadsFiles,
				avatarsFiles,
				cwd: process.cwd()
			}
		});
	} catch (error) {
		logger.error('Debug error');
		return json({ error: 'Debug failed' }, { status: 500 });
	}
};
