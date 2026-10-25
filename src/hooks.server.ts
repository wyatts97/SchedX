import path from 'node:path';
import { redirect } from '@sveltejs/kit';
import type { Handle, HandleServerError, ServerInit } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { loadConfig } from '#lib/server/config.js';
import { setRuntime } from '#lib/server/runtime.js';
import { initDb } from '#lib/server/db/index.js';
import { hasUser, SESSION_COOKIE, validateSession } from '#lib/server/auth/index.js';
import { startScheduler } from '#lib/server/scheduler/loop.js';
import { logger, errorMessage } from '#lib/server/logger.js';
import type { Theme } from '#lib/shared/types.js';

export const init: ServerInit = async () => {
	if (building) return;
	const config = loadConfig();
	setRuntime(config);
	initDb(path.resolve(config.dataDir, 'schedx.db'));
	logger.info(
		{ dataDir: path.resolve(config.dataDir), xMode: config.xMode, push: !!config.vapid },
		'SchedX started'
	);
	if (config.xMode === 'live' && !config.xClientId) {
		logger.warn('X_CLIENT_ID is not set: connecting X accounts is disabled until it is configured');
	}
	if (config.scheduler) startScheduler();
};

const THEMES: Theme[] = ['system', 'light', 'dark', 'black'];
const THEME_COLOR: Record<Exclude<Theme, 'system'>, string> = {
	light: '#ffffff',
	dark: '#15202b',
	black: '#000000'
};

function themeColorMeta(theme: Theme): string {
	// In the installed iOS app, dark themes draw under a translucent status bar (white clock on our
	// dark header). Light and "match device" keep iOS's own opaque bar so the clock never ends up
	// white-on-white. iOS reads this when the app launches.
	const statusBar = theme === 'dark' || theme === 'black' ? 'black-translucent' : 'default';
	const appleMeta = `<meta name="apple-mobile-web-app-status-bar-style" content="${statusBar}" />`;
	if (theme !== 'system') {
		return `<meta name="theme-color" content="${THEME_COLOR[theme]}" />${appleMeta}`;
	}
	return (
		`<meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLOR.light}" />` +
		`<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLOR.dark}" />` +
		appleMeta
	);
}

/** Routes reachable without a session. */
const PUBLIC = ['/login', '/setup', '/api/health'];
let setupDone = false;

export const handle: Handle = async ({ event, resolve }) => {
	const cookieTheme = event.cookies.get('theme') as Theme | undefined;
	event.locals.theme = cookieTheme && THEMES.includes(cookieTheme) ? cookieTheme : 'system';
	event.locals.sidebarCollapsed = event.cookies.get('sidebar') === 'collapsed';

	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const session = validateSession(token);
		if (session) {
			event.locals.user = session.user;
			event.locals.sessionId = session.sessionId;
			event.cookies.set(SESSION_COOKIE, token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: event.url.protocol === 'https:',
				expires: new Date(session.expiresAt)
			});
		} else {
			event.cookies.delete(SESSION_COOKIE, { path: '/' });
		}
	}

	const pathname = event.url.pathname;
	const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

	setupDone ||= hasUser();
	if (!setupDone && pathname !== '/setup' && !pathname.startsWith('/api/health')) {
		redirect(303, '/setup');
	}
	if (setupDone && !event.locals.user && !isPublic) {
		if (pathname.startsWith('/api/') || event.request.method !== 'GET') {
			return Response.json({ error: 'Not signed in' }, { status: 401 });
		}
		const next = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + event.url.search)}`;
		redirect(303, `/login${next}`);
	}

	const theme = event.locals.theme;
	const response = await resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%schedx.theme%', theme).replace('%schedx.themeColor%', themeColorMeta(theme))
	});

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}
	return response;
};

export const handleError: HandleServerError = (caught) => {
	// Unknown errors are bugs (or infrastructure problems): log them, keep details off the page.
	if (caught.kind === 'unknown') {
		logger.error(
			{ err: errorMessage(caught.error), path: caught.event.url.pathname },
			'unhandled server error'
		);
		return { message: 'Something went wrong.' };
	}
};
