// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SafeUser } from '#lib/server/auth/index.js';
import type { Theme } from '#lib/shared/types.js';

declare global {
	namespace App {
		interface Locals {
			user?: SafeUser;
			sessionId?: string;
			theme: Theme;
			sidebarCollapsed: boolean;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
