import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const host = env.HOST || '127.0.0.1';
	const port = parseInt(env.PORT || '5173', 10);

	return {
		plugins: [sveltekit()],
		ssr: {
			external: ['react-filerobot-image-editor', 'react', 'react-dom']
		},
		resolve: {
			dedupe: ['react', 'react-dom'],
			alias: {
				react: 'react',
				'react-dom': 'react-dom'
			}
		},
		optimizeDeps: {
			include: ['react', 'react-dom', 'react-filerobot-image-editor']
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
					manualChunks(id) {
						// Only apply to client build, not SSR
						if (id.includes('node_modules')) {
							// Separate emoji picker into its own chunk
							if (id.includes('emoji-picker-element')) {
								return 'emoji-picker';
							}
							// Separate flatpickr into its own chunk
							if (id.includes('flatpickr')) {
								return 'flatpickr-vendor';
							}
							// Separate React ecosystem (for image editor)
							if (id.includes('react') || id.includes('react-dom') || id.includes('react-filerobot')) {
								return 'react-vendor';
							}
						}
					}
				}
			},
			chunkSizeWarningLimit: 600 // Increase warning threshold slightly
		}
	};
});
