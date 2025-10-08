// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: any;
			isAuthenticated: boolean;
			isAdmin: boolean;
			correlationId?: string;
			user?: {
				id: string;
				username: string;
				displayName: string;
				avatar: string;
				email: string;
			};
			auth: () => Promise<any>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Preline UI global types
	interface Window {
		HSStaticMethods: {
			autoInit: () => void;
		};
		HSThemeSwitch: {
			getInstance: (
				target: Element | string,
				isInstance?: boolean
			) => {
				element: {
					destroy: () => void;
				};
			};
			new (
				element: Element,
				options?: any
			): {
				element: {
					destroy: () => void;
				};
			};
		};
		HSFileUpload: {
			getInstance: (
				target: Element | string,
				isInstance?: boolean
			) => {
				element: {
					dropzone: {
						on: (event: string, callback: (file: any, response?: any) => void) => void;
					};
				};
			};
			new (
				element: Element,
				options?: any
			): {
				element: {
					dropzone: {
						on: (event: string, callback: (file: any, response?: any) => void) => void;
					};
				};
			};
		};

		VanillaCalendar: any;
	}
}

export {};
