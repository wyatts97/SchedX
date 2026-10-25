import { z } from 'zod';
import * as env from '$app/env/private';
import type { RuntimeConfig } from './runtime.js';

const schema = z
	.object({
		DATA_DIR: z.string().default('./data'),
		ENCRYPTION_KEY: z
			.string({ error: 'ENCRYPTION_KEY is required (run `npm run gen:secrets`)' })
			.min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
		APP_URL: z
			.url({ error: 'APP_URL must be a full URL like https://schedx.example.com' })
			.optional(),
		X_API_MODE: z.enum(['live', 'mock']).default('live'),
		X_CLIENT_ID: z.string().optional(),
		X_CLIENT_SECRET: z.string().optional(),
		VAPID_PUBLIC_KEY: z.string().optional(),
		VAPID_PRIVATE_KEY: z.string().optional(),
		VAPID_SUBJECT: z.string().default('mailto:admin@localhost'),
		MAX_UPLOAD_MB: z.coerce.number().int().positive().default(100),
		SCHEDULER: z.enum(['on', 'off']).default('on')
	})
	.refine((c) => c.X_API_MODE === 'mock' || !c.X_CLIENT_ID || !!c.X_CLIENT_SECRET, {
		message: 'X_CLIENT_SECRET is required when X_CLIENT_ID is set'
	});

export function loadConfig(): RuntimeConfig {
	const parsed = schema.safeParse({
		DATA_DIR: env.DATA_DIR,
		ENCRYPTION_KEY: env.ENCRYPTION_KEY,
		APP_URL: env.APP_URL,
		X_API_MODE: env.X_API_MODE,
		X_CLIENT_ID: env.X_CLIENT_ID,
		X_CLIENT_SECRET: env.X_CLIENT_SECRET,
		VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
		VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY,
		VAPID_SUBJECT: env.VAPID_SUBJECT,
		MAX_UPLOAD_MB: env.MAX_UPLOAD_MB,
		SCHEDULER: env.SCHEDULER
	});
	if (!parsed.success) {
		const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`);
		throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
	}
	const c = parsed.data;
	return {
		dataDir: c.DATA_DIR,
		encryptionKey: c.ENCRYPTION_KEY,
		appUrl: c.APP_URL?.replace(/\/+$/, ''),
		xMode: c.X_API_MODE,
		xClientId: c.X_CLIENT_ID,
		xClientSecret: c.X_CLIENT_SECRET,
		vapid:
			c.VAPID_PUBLIC_KEY && c.VAPID_PRIVATE_KEY
				? {
						publicKey: c.VAPID_PUBLIC_KEY,
						privateKey: c.VAPID_PRIVATE_KEY,
						subject: c.VAPID_SUBJECT
					}
				: undefined,
		maxUploadBytes: c.MAX_UPLOAD_MB * 1024 * 1024,
		scheduler: c.SCHEDULER === 'on'
	};
}
