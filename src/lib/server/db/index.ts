import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';

export type DB = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

let instance: DB | undefined;

/** Folder holding the generated SQL migrations (copied next to the build in Docker). */
function migrationsFolder(): string {
	const candidates = [
		process.env.MIGRATIONS_DIR,
		path.resolve(process.cwd(), 'drizzle'),
		path.resolve(process.cwd(), '..', 'drizzle')
	].filter(Boolean) as string[];
	const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'meta', '_journal.json')));
	if (!found)
		throw new Error(`Could not find migrations folder (looked in ${candidates.join(', ')})`);
	return found;
}

/** Opens (and migrates) a database. `:memory:` is used by tests. */
export function openDb(file: string): DB {
	if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
	const client = new Database(file);
	client.pragma('journal_mode = WAL');
	client.pragma('synchronous = NORMAL');
	client.pragma('foreign_keys = ON');
	client.pragma('busy_timeout = 5000');
	const db = drizzle(client, { schema }) as DB;
	migrate(db, { migrationsFolder: migrationsFolder() });
	return db;
}

export function initDb(file: string): DB {
	instance?.$client.close();
	instance = openDb(file);
	return instance;
}

export function getDb(): DB {
	if (!instance) throw new Error('Database not initialised');
	return instance;
}

export { schema };
