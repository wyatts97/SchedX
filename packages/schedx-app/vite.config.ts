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
				external: ['bcryptjs']
			}
		}
	};
});
