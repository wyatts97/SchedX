import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter({
			// Increase body size limit for file uploads
			bodySizeLimit: parseInt(process.env.BODY_SIZE_LIMIT) || 20485760
		}),
		csrf: {
			// Disable CSRF origin check for Docker/self-hosted deployments
			// This allows access from local network IPs
			checkOrigin: false
		},
		alias: {
			$components: 'src/lib/components',
			$lib: 'src/lib'
		}
	},
	vitePlugin: {
		inspector: false
	}
};

export default config;
