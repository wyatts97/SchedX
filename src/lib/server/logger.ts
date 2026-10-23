import pino from 'pino';

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info');

const pretty = process.env.NODE_ENV === 'development' && process.stdout.isTTY;

export const logger = pino({
	level,
	base: undefined,
	transport: pretty ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
	redact: {
		paths: ['*.accessToken', '*.refreshToken', '*.password', '*.codeVerifier', 'headers.cookie'],
		censor: '[redacted]'
	}
});

export function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return typeof err === 'string' ? err : JSON.stringify(err);
}
