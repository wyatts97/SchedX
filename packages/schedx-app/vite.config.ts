import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from monorepo root
config({ path: resolve(process.cwd(), '../../.env') });

export default defineConfig(({ mode }: { mode: string }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const host = env.HOST || '127.0.0.1';
	const port = parseInt(env.PORT || '5173', 10);

	return {
		plugins: [sveltekit()],
		ssr: {
			noExternal: ['@schedule-x/calendar', '@schedule-x/svelte', '@schedule-x/drag-and-drop']
		},
		optimizeDeps: {
			include: [
				'@schedule-x/calendar',
				'@schedule-x/svelte',
				'@schedule-x/drag-and-drop',
				'date-fns',
				'date-fns-tz'
			]
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
				output: {
					// OPTIMIZATION: Manual chunking for better caching
					// Use function form to avoid errors with SSR-external modules
					// IMPORTANT: Only chunk client-side code, not API routes
					manualChunks(id: string) {
						// Skip API routes - let SvelteKit handle them to preserve exports
						if (id.includes('/routes/api/')) return undefined;
						
						if (id.includes('node_modules')) {
							// Vendor chunks - split by library for better caching
							if (id.includes('preline')) return 'vendor-ui';
							if (id.includes('chart.js')) return 'vendor-charts';
							if (id.includes('date-fns')) return 'vendor-dates';
							if (id.includes('@schedule-x')) return 'vendor-calendar';
							if (id.includes('lucide-svelte')) return 'vendor-icons';
							if (id.includes('@tanstack')) return 'vendor-query';
							if (id.includes('rettiwt-api') || id.includes('twitter-api')) return 'vendor-twitter';
							if (id.includes('zod') || id.includes('sveltekit-superforms')) return 'vendor-forms';
							if (id.includes('pino')) return 'vendor-logger';
							if (id.includes('better-sqlite3')) return 'vendor-db';
							// Catch-all for remaining node_modules
							return 'vendor';
						}
						
						// Route-based chunks - split by PAGE routes for lazy loading (not API routes)
						if (id.includes('/routes/admin/') && !id.includes('/routes/api/')) return 'route-admin';
						if (id.includes('/routes/queue/') && !id.includes('/routes/api/')) return 'route-queue';
						if (id.includes('/routes/scheduled/')) return 'route-scheduled';
						if (id.includes('/routes/history/')) return 'route-history';
						if (id.includes('/routes/gallery/')) return 'route-gallery';
						if (id.includes('/routes/drafts/') && !id.includes('/routes/api/')) return 'route-drafts';
						if (id.includes('/routes/thread/') && !id.includes('/routes/api/')) return 'route-thread';
						if (id.includes('/routes/post/') && !id.includes('/routes/api/')) return 'route-post';
					}
					// Note: Removed experimentalMinChunkSize as it can interfere with SvelteKit's server builds
				}
			},
			// OPTIMIZATION: Increase chunk size warning threshold
			chunkSizeWarningLimit: 600,
			// OPTIMIZATION: Enable minification
			minify: 'esbuild',
			// OPTIMIZATION: Generate source maps only in development
			sourcemap: process.env.NODE_ENV !== 'production',
			// OPTIMIZATION: Modern browser target
			target: 'es2020',
			// OPTIMIZATION: Split CSS per chunk
			cssCodeSplit: true,
			// OPTIMIZATION: Faster builds
			reportCompressedSize: false
		}
	};
});
