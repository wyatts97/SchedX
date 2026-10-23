import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { setRuntime } from '#lib/server/runtime.js';
import { getDb, initDb, schema } from '#lib/server/db/index.js';
import { createUser } from '#lib/server/auth/index.js';
import { upsertAccount } from '#lib/server/x/accounts.js';
import { mockStore } from '#lib/server/x/mock.js';
import { saveMedia } from '#lib/server/media/storage.js';
import { setSetting, DEFAULT_SETTINGS } from '#lib/server/settings.js';

export const TZ = 'America/New_York';

export async function setupTestEnv(opts: { budget?: number } = {}) {
	const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schedx-test-'));
	setRuntime({
		dataDir,
		encryptionKey: 'test-encryption-key-test-encryption-key',
		xMode: 'mock',
		maxUploadBytes: 100 * 1024 * 1024,
		scheduler: false
	});
	initDb(':memory:');
	mockStore.latencyMs = 0;
	mockStore.posts.clear();
	await createUser('tester', 'correct horse battery', TZ);
	setSetting('budget', { ...DEFAULT_SETTINGS.budget, monthlyUsd: opts.budget ?? 0 });
	const account = upsertAccount({
		user: { id: 'x-user-1', username: 'tester', name: 'Tester' },
		accessToken: 'mock',
		refreshToken: 'mock',
		expiresIn: 3600 * 24,
		scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access']
	});
	return { dataDir, account, db: getDb() };
}

export async function makeImage(): Promise<string> {
	const png = await sharp({
		create: { width: 32, height: 32, channels: 3, background: { r: 29, g: 155, b: 240 } }
	})
		.png()
		.toBuffer();
	const row = await saveMedia({ data: png, mime: 'image/png', originalName: 'blue.png' });
	return row.id;
}

export function postRow(id: string) {
	const db = getDb();
	return db.select().from(schema.posts).all().find((p) => p.id === id)!;
}

export function itemRows(postId: string) {
	return getDb()
		.select()
		.from(schema.postItems)
		.all()
		.filter((i) => i.postId === postId)
		.sort((a, b) => a.position - b.position);
}
