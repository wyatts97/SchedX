import { defineEnvVars } from '@sveltejs/kit/env';

// Values are validated strictly in `loadConfig()` (src/lib/server/config.ts) at server start,
// so a build without a populated environment (e.g. `docker build`) still succeeds.
const optional = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

export const variables = defineEnvVars({
	DATA_DIR: {
		description: 'Directory for the SQLite database, uploads and backups. Default ./data',
		schema: optional
	},
	ENCRYPTION_KEY: {
		description: 'Secret (32+ chars) used to encrypt X tokens at rest. Generate: npm run gen:secrets',
		schema: optional
	},
	APP_URL: {
		description: 'Public URL of the app, e.g. https://schedx.example.com (used for the X OAuth callback)',
		schema: optional
	},
	X_CLIENT_ID: { description: 'OAuth 2.0 Client ID from the X Developer Console', schema: optional },
	X_CLIENT_SECRET: {
		description: 'OAuth 2.0 Client Secret from the X Developer Console',
		schema: optional
	},
	X_API_MODE: {
		description: '"live" (default) talks to the real X API; "mock" uses a fake client that costs nothing',
		schema: optional
	},
	VAPID_PUBLIC_KEY: { description: 'Web push public key', schema: optional },
	VAPID_PRIVATE_KEY: { description: 'Web push private key', schema: optional },
	VAPID_SUBJECT: { description: 'Web push contact, e.g. mailto:you@example.com', schema: optional },
	MAX_UPLOAD_MB: { description: 'Max media upload size in MB (default 100)', schema: optional },
	LOG_LEVEL: { description: 'pino log level (default info)', schema: optional },
	SCHEDULER: { description: '"on" (default) or "off"', schema: optional }
});
