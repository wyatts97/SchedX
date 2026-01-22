import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'sidebar_collapsed';

function createSidebarStore() {
	// Get initial value from localStorage
	const initialValue = browser ? localStorage.getItem(STORAGE_KEY) === 'true' : false;
	
	const { subscribe, set, update } = writable<boolean>(initialValue);

	return {
		subscribe,
		toggle: () => {
			update(value => {
				const newValue = !value;
				if (browser) {
					localStorage.setItem(STORAGE_KEY, String(newValue));
				}
				return newValue;
			});
		},
		collapse: () => {
			set(true);
			if (browser) {
				localStorage.setItem(STORAGE_KEY, 'true');
			}
		},
		expand: () => {
			set(false);
			if (browser) {
				localStorage.setItem(STORAGE_KEY, 'false');
			}
		}
	};
}

export const sidebarCollapsed = createSidebarStore();
