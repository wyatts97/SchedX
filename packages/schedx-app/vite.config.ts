import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from monorepo root
config({ path: resolve(process.cwd(), '../../.env') });

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const host = env.HOST || '127.0.0.1';
	const port = parseInt(env.PORT || '5173', 10);

	return {
		plugins: [sveltekit()],
		ssr: {
			external: ['react', 'react-dom']
		},
		resolve: {
			dedupe: ['react', 'react-dom', 'styled-components', 'konva', 'react-konva'],
			alias: {
				react: 'react',
				'react-dom': 'react-dom',
				'styled-components': 'styled-components'
			}
		},
		optimizeDeps: {
			include: ['react', 'react-dom', 'styled-components', 'filerobot-image-editor'],
			exclude: []
		},
		server: {
			host,
			port,
			strictPort: true,
			fs: {
				allow: ['../uploads']
			}
		},
		preview: {
			host,
			port,
			strictPort: true
		},
		build: {
			rollupOptions: {
				external: ['bcryptjs']
			}
		}
	};
});
