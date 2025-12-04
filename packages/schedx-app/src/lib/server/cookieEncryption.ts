import crypto from 'crypto';
import logger from '$lib/server/logger';

/**
 * API key encryption utility for Rettiwt API keys
 * Uses AES-256-GCM encryption with a dedicated encryption key
 */
export class CookieEncryption {
	private static readonly ALGORITHM = 'aes-256-gcm';
	private static readonly KEY_LENGTH = 32;
	private static readonly IV_LENGTH = 16;

	/**
	 * Encrypts a Rettiwt API key string
	 * @param cookie - The API key string to encrypt
	 * @returns Encrypted string in format: iv:tag:encrypted
	 */
	public static encrypt(cookie: string): string {
		if (!cookie) {
			throw new Error('API key string is required for encryption');
		}

		const secret = process.env.API_KEY_ENCRYPTION_KEY;
		if (!secret) {
			throw new Error('API_KEY_ENCRYPTION_KEY environment variable is not set');
		}

		try {
			// Derive a 32-byte key from the secret
			const key = crypto.createHash('sha256').update(secret).digest();
			
			// Generate random IV
			const iv = crypto.randomBytes(this.IV_LENGTH);
			
			// Create cipher
			const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
			
			// Encrypt the cookie
			let encrypted = cipher.update(cookie, 'utf8', 'hex');
			encrypted += cipher.final('hex');
			
			// Get authentication tag
			const tag = cipher.getAuthTag();
			
			// Return format: iv:tag:encrypted
			return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
		} catch (error) {
			logger.error({ error }, 'Failed to encrypt cookie');
			throw new Error('Cookie encryption failed');
		}
	}

	/**
	 * Decrypts a Rettiwt API key string
	 * @param encrypted - The encrypted string in format: iv:tag:encrypted
	 * @returns Decrypted API key string
	 */
	public static decrypt(encrypted: string): string {
		if (!encrypted) {
			throw new Error('Encrypted API key string is required for decryption');
		}

		const secret = process.env.API_KEY_ENCRYPTION_KEY;
		if (!secret) {
			throw new Error('API_KEY_ENCRYPTION_KEY environment variable is not set');
		}

		try {
			// Parse the encrypted string
			const [ivHex, tagHex, data] = encrypted.split(':');
			
			if (!ivHex || !tagHex || !data) {
				throw new Error('Invalid encrypted API key format');
			}

			// Convert hex strings to buffers
			const iv = Buffer.from(ivHex, 'hex');
			const tag = Buffer.from(tagHex, 'hex');
			
			// Derive the same key
			const key = crypto.createHash('sha256').update(secret).digest();
			
			// Create decipher
			const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
			decipher.setAuthTag(tag);
			
			// Decrypt the cookie
			let decrypted = decipher.update(data, 'hex', 'utf8');
			decrypted += decipher.final('utf8');
			
			return decrypted;
		} catch (error) {
			logger.error({ error }, 'Failed to decrypt API key');
			throw new Error('API key decryption failed');
		}
	}

	/**
	 * Validates that the encryption key is properly configured
	 * @returns true if the key is valid, false otherwise
	 */
	public static isConfigured(): boolean {
		const secret = process.env.API_KEY_ENCRYPTION_KEY;
		return !!secret && secret.length >= 32;
	}
}
