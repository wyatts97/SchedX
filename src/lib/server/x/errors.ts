import { ApiPartialResponseError, ApiRequestError, ApiResponseError } from 'twitter-api-v2';
import { XError } from './types.js';

/** Which call failed. A failed *post* create may still have gone through on X's side. */
export type XPhase = 'post' | 'media' | 'read' | 'auth';

const NOT_SENT_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH']);

function describe(data: unknown): string {
	if (!data || typeof data !== 'object') return '';
	const d = data as Record<string, unknown>;
	const errors = Array.isArray(d.errors) ? (d.errors as Record<string, unknown>[]) : [];
	const parts = [d.detail, errors[0]?.message, errors[0]?.detail, d.title, d.error_description, d.error];
	return (parts.find((p) => typeof p === 'string' && p.trim()) as string | undefined) ?? '';
}

function mentionsCredits(text: string): boolean {
	return /credit|spend(ing)? (cap|limit)|usage ?cap|billing|payment required|balance/i.test(text);
}

export function classifyXError(err: unknown, phase: XPhase): XError {
	if (err instanceof XError) return err;

	if (err instanceof ApiResponseError) {
		const status = err.code;
		const detail = describe(err.data) || err.message;
		const msg = `X API ${status}: ${detail}`;
		if (status === 401) return new XError('auth', msg, { status });
		if (status === 402 || mentionsCredits(detail)) return new XError('credits', msg, { status });
		if (status === 403) {
			if (/duplicate/i.test(detail)) return new XError('duplicate', msg, { status });
			return new XError('forbidden', msg, { status });
		}
		if (status === 429) {
			const reset = err.rateLimit?.reset;
			return new XError('rate_limit', msg, {
				status,
				retryAt: reset ? reset * 1000 + 1000 : Date.now() + 15 * 60 * 1000
			});
		}
		if (status === 400 || status === 404 || status === 413 || status === 422) {
			if (/invalid_grant|refresh token/i.test(detail)) return new XError('auth', msg, { status });
			return new XError('invalid', msg, { status });
		}
		if (status >= 500) {
			// X may have created the post before failing; verify instead of blindly retrying.
			return new XError(phase === 'post' ? 'ambiguous' : 'transient', msg, { status });
		}
		return new XError('unknown', msg, { status });
	}

	if (err instanceof ApiPartialResponseError) {
		return new XError(phase === 'post' ? 'ambiguous' : 'transient', `X API: ${err.message}`);
	}

	if (err instanceof ApiRequestError) {
		const code = (err.requestError as NodeJS.ErrnoException | undefined)?.code ?? '';
		const msg = `Network error talking to X: ${err.requestError?.message ?? err.message}`;
		if (phase === 'post' && !NOT_SENT_CODES.has(code)) return new XError('ambiguous', msg);
		return new XError('transient', msg);
	}

	return new XError('unknown', err instanceof Error ? err.message : String(err));
}

/** Permanent errors are not retried. */
export function isPermanent(kind: XError['kind']): boolean {
	return kind === 'duplicate' || kind === 'forbidden' || kind === 'invalid';
}
