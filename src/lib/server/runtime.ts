import path from 'node:path';

export interface RuntimeConfig {
	dataDir: string;
	encryptionKey: string;
	appUrl?: string;
	xMode: 'live' | 'mock';
	xClientId?: string;
	xClientSecret?: string;
	vapid?: { publicKey: string; privateKey: string; subject: string };
	maxUploadBytes: number;
	scheduler: boolean;
}

let current: RuntimeConfig | undefined;

/**
 * Runtime configuration is set once at server start (hooks `init`) or by tests. Library code
 * reads it through `rt()` instead of importing env modules, so it stays testable.
 */
export function setRuntime(config: RuntimeConfig): void {
	current = config;
}

export function rt(): RuntimeConfig {
	if (!current) throw new Error('Runtime config not initialised');
	return current;
}

export function dataPath(...parts: string[]): string {
	return path.resolve(rt().dataDir, ...parts);
}
