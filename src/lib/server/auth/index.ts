import { hash, verify } from '@node-rs/argon2';
import { and, eq, gt, lt, ne } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { randomToken, sha256 } from '../crypto.js';

export const SESSION_COOKIE = 'schedx_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_MS = 15 * 24 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 10;

export type User = typeof schema.users.$inferSelect;
export type SafeUser = Pick<User, 'id' | 'username' | 'timezone'>;

export function hasUser(): boolean {
	return !!getDb().select({ id: schema.users.id }).from(schema.users).limit(1).get();
}

export function hashPassword(password: string): Promise<string> {
	return hash(password);
}

export async function createUser(username: string, password: string, timezone: string) {
	const passwordHash = await hashPassword(password);
	return getDb()
		.insert(schema.users)
		.values({ username: username.trim(), passwordHash, timezone })
		.returning()
		.get();
}

export async function verifyLogin(username: string, password: string): Promise<User | null> {
	const user = getDb()
		.select()
		.from(schema.users)
		.where(eq(schema.users.username, username.trim()))
		.get();
	// Always run a verify so timing doesn't reveal whether the username exists.
	dummyHash ??= await hash(randomToken());
	const ok = await verify(user?.passwordHash ?? dummyHash, password).catch(() => false);
	return user && ok ? user : null;
}

let dummyHash: string | undefined;

export function createSession(userId: string, userAgent: string | null) {
	const token = randomToken();
	const expiresAt = Date.now() + SESSION_TTL_MS;
	getDb()
		.insert(schema.sessions)
		.values({ id: sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 200) ?? null })
		.run();
	return { token, expiresAt };
}

/** Returns the user for a session token, sliding the expiry when it is getting old. */
export function validateSession(
	token: string
): { user: SafeUser; expiresAt: number; sessionId: string } | null {
	const db = getDb();
	const sessionId = sha256(token);
	const row = db
		.select({ session: schema.sessions, user: schema.users })
		.from(schema.sessions)
		.innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
		.where(and(eq(schema.sessions.id, sessionId), gt(schema.sessions.expiresAt, Date.now())))
		.get();
	if (!row) return null;
	let expiresAt = row.session.expiresAt;
	if (expiresAt - Date.now() < SESSION_REFRESH_MS) {
		expiresAt = Date.now() + SESSION_TTL_MS;
		db.update(schema.sessions).set({ expiresAt }).where(eq(schema.sessions.id, sessionId)).run();
	}
	const { id, username, timezone } = row.user;
	return { user: { id, username, timezone }, expiresAt, sessionId };
}

export function deleteSession(token: string): void {
	getDb()
		.delete(schema.sessions)
		.where(eq(schema.sessions.id, sha256(token)))
		.run();
}

export async function changePassword(
	userId: string,
	current: string,
	next: string,
	keepSessionId: string
) {
	const db = getDb();
	const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
	if (!user || !(await verify(user.passwordHash, current).catch(() => false))) {
		return { ok: false as const, error: 'Current password is incorrect.' };
	}
	db.update(schema.users)
		.set({ passwordHash: await hashPassword(next), passwordChangedAt: Date.now() })
		.where(eq(schema.users.id, userId))
		.run();
	// Sign out every other session.
	db.delete(schema.sessions)
		.where(and(eq(schema.sessions.userId, userId), ne(schema.sessions.id, keepSessionId)))
		.run();
	return { ok: true as const };
}

export function listSessions(userId: string) {
	return getDb()
		.select()
		.from(schema.sessions)
		.where(and(eq(schema.sessions.userId, userId), gt(schema.sessions.expiresAt, Date.now())))
		.all();
}

export function revokeOtherSessions(userId: string, keepSessionId: string): void {
	getDb()
		.delete(schema.sessions)
		.where(and(eq(schema.sessions.userId, userId), ne(schema.sessions.id, keepSessionId)))
		.run();
}

export function purgeExpiredSessions(): number {
	return getDb().delete(schema.sessions).where(lt(schema.sessions.expiresAt, Date.now())).run()
		.changes;
}

export function updateTimezone(userId: string, timezone: string): void {
	getDb().update(schema.users).set({ timezone }).where(eq(schema.users.id, userId)).run();
}

export function getUser(): SafeUser | null {
	const u = getDb().select().from(schema.users).limit(1).get();
	return u ? { id: u.id, username: u.username, timezone: u.timezone } : null;
}
