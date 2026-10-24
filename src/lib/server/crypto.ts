import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { rt } from './runtime.js';

const VERSION = 'v1';

function key(): Buffer {
	return createHash('sha256').update(rt().encryptionKey).digest();
}

/** AES-256-GCM. Output format: `v1:<iv>:<tag>:<ciphertext>` (base64url parts). */
export function encrypt(plaintext: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key(), iv);
	const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return [
		VERSION,
		iv.toString('base64url'),
		tag.toString('base64url'),
		ct.toString('base64url')
	].join(':');
}

export function decrypt(payload: string): string {
	const [version, iv, tag, ct] = payload.split(':');
	if (version !== VERSION || !iv || !tag || ct === undefined) {
		throw new Error('Unsupported encrypted payload');
	}
	const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
	decipher.setAuthTag(Buffer.from(tag, 'base64url'));
	return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString(
		'utf8'
	);
}

export function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
	return randomBytes(bytes).toString('base64url');
}
