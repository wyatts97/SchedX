import os from 'node:os';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const dataDir = path.join(os.tmpdir(), `schedx-e2e-${Date.now()}`);

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	use: { baseURL: 'http://127.0.0.1:4173' },
	webServer: {
		command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
		url: 'http://127.0.0.1:4173/api/health',
		timeout: 180_000,
		reuseExistingServer: false,
		env: {
			DATA_DIR: dataDir,
			ENCRYPTION_KEY: 'e2e-encryption-key-e2e-encryption-key-123',
			X_API_MODE: 'mock',
			LOG_LEVEL: 'warn'
		}
	}
});
