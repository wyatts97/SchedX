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
			external: ['react', 'react-dom'],
			noExternal: ['@schedule-x/calendar', '@schedule-x/svelte', '@schedule-x/drag-and-drop']
		},
		resolve: {
			dedupe: ['react', 'react-dom', 'styled-components', 'preact'],
			alias: {
				react: 'react',
				'react-dom': 'react-dom',
				'styled-components': 'styled-components'
			}
		},
		optimizeDeps: {
			include: [
				'react', 
				'react-dom', 
				'styled-components',
				'@schedule-x/calendar',
				'@schedule-x/svelte',
				'@schedule-x/drag-and-drop',
				'@preact/signals',
				'preact',
				'date-fns',
				'date-fns-tz'
			],
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
				external: ['bcryptjs'],
				output: {
					// OPTIMIZATION: Manual chunking for better caching
					manualChunks: {
						// Vendor chunks - rarely change
						'vendor-ui': ['preline'],
						'vendor-charts': ['apexcharts'],
						'vendor-dates': ['date-fns', 'date-fns-tz', 'air-datepicker'],
						'vendor-calendar': ['@schedule-x/calendar', '@schedule-x/svelte', '@schedule-x/drag-and-drop'],
						// Twitter/API deps
						'vendor-twitter': ['twitter-api-v2', 'rettiwt-api']
					}
				}
			},
			// OPTIMIZATION: Increase chunk size warning threshold
			chunkSizeWarningLimit: 600,
			// OPTIMIZATION: Enable minification
			minify: 'esbuild',
			// OPTIMIZATION: Generate source maps only in development
			sourcemap: process.env.NODE_ENV !== 'production'
		}
	};
});
