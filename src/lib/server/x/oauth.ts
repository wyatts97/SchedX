import { TwitterApi } from 'twitter-api-v2';
import { eq, lt } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { rt } from '../runtime.js';
import { classifyXError } from './errors.js';
import { REQUIRED_SCOPES, upsertAccount, withLedger, type AccountRow } from './accounts.js';
import { LiveXApi } from './live.js';
import { MockXApi } from './mock.js';
import { XError } from './types.js';

const STATE_TTL_MS = 10 * 60 * 1000;

export function xConfigured(): boolean {
	const c = rt();
	return c.xMode === 'mock' || !!(c.xClientId && c.xClientSecret);
}

export function callbackUrl(requestOrigin: string): string {
	return `${rt().appUrl ?? requestOrigin}/auth/x/callback`;
}

/** Starts the OAuth 2.0 PKCE flow and returns the X authorize URL. */
export function beginConnect(requestOrigin: string): string {
	const { xClientId, xClientSecret } = rt();
	if (!xClientId || !xClientSecret)
		throw new XError('invalid', 'X_CLIENT_ID / X_CLIENT_SECRET are not set');
	const redirectUri = callbackUrl(requestOrigin);
	const app = new TwitterApi({ clientId: xClientId, clientSecret: xClientSecret });
	const { url, state, codeVerifier } = app.generateOAuth2AuthLink(redirectUri, {
		scope: REQUIRED_SCOPES
	});
	const db = getDb();
	db.delete(schema.oauthStates).where(lt(schema.oauthStates.expiresAt, Date.now())).run();
	db.insert(schema.oauthStates)
		.values({ state, codeVerifier, redirectUri, expiresAt: Date.now() + STATE_TTL_MS })
		.run();
	return url;
}

export async function completeConnect(state: string, code: string): Promise<AccountRow> {
	const db = getDb();
	const saved = db
		.select()
		.from(schema.oauthStates)
		.where(eq(schema.oauthStates.state, state))
		.get();
	db.delete(schema.oauthStates).where(eq(schema.oauthStates.state, state)).run();
	if (!saved || saved.expiresAt < Date.now()) {
		throw new XError('invalid', 'This sign-in link expired. Please try connecting again.');
	}
	const { xClientId, xClientSecret } = rt();
	const app = new TwitterApi({ clientId: xClientId!, clientSecret: xClientSecret! });
	let login;
	try {
		login = await app.loginWithOAuth2({
			code,
			codeVerifier: saved.codeVerifier,
			redirectUri: saved.redirectUri
		});
	} catch (err) {
		throw classifyXError(err, 'auth');
	}
	const user = await withLedger(new LiveXApi(login.client), {}).me();
	const missing = REQUIRED_SCOPES.filter((s) => !login.scope.includes(s as never));
	if (missing.length) {
		throw new XError('forbidden', `X did not grant required permissions: ${missing.join(', ')}`);
	}
	return upsertAccount({
		user,
		accessToken: login.accessToken,
		refreshToken: login.refreshToken,
		expiresIn: login.expiresIn,
		scopes: login.scope
	});
}

/** Mock mode: "connect" a fake account without leaving the app. */
export async function connectMockAccount(): Promise<AccountRow> {
	const n = getDb().select().from(schema.accounts).all().length + 1;
	const user = await new MockXApi({
		id: `mock-${Date.now()}`,
		username: `mock_user_${n}`,
		name: `Mock User ${n}`
	}).me();
	return upsertAccount({
		user,
		accessToken: 'mock-access-token',
		refreshToken: 'mock-refresh-token',
		expiresIn: 60 * 60 * 24 * 365,
		scopes: REQUIRED_SCOPES
	});
}
