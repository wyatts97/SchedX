import { getContext, setContext } from 'svelte';
import type { Theme } from '#lib/shared/types.js';

export type ResolvedTheme = Exclude<Theme, 'system'>;

const KEY = Symbol('theme');
const ORDER: ResolvedTheme[] = ['light', 'dark', 'black'];

export const THEME_LABELS: Record<Theme, string> = {
	system: 'Match device',
	light: 'Light',
	dark: 'Dim',
	black: 'Lights out'
};

/** Owns the active theme on the client: cookie, `data-theme` and the legacy fade overlay. */
export class ThemeController {
	current = $state<Theme>('system');
	osDark = $state(false);
	/** True while the full-screen overlay is shown during a switch. */
	changing = $state(false);

	constructor(initial: Theme) {
		this.current = initial;
	}

	get resolved(): ResolvedTheme {
		if (this.current !== 'system') return this.current;
		return this.osDark ? 'dark' : 'light';
	}

	/** Track the OS preference so "Match device" resolves correctly. Call from onMount. */
	listen(): () => void {
		const mq = matchMedia('(prefers-color-scheme: dark)');
		const update = () => (this.osDark = mq.matches);
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	}

	set(next: Theme): void {
		const apply = () => {
			this.current = next;
			document.documentElement.dataset.theme = next;
			document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
		};
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			apply();
			return;
		}
		this.changing = true;
		setTimeout(apply, 150);
		setTimeout(() => (this.changing = false), 350);
	}

	/** Legacy single-button cycle: Light → Dim → Lights out. */
	cycle(): void {
		this.set(this.nextAfter(this.resolved));
	}

	nextAfter(theme: ResolvedTheme): ResolvedTheme {
		return ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
	}
}

export function provideTheme(initial: Theme): ThemeController {
	return setContext(KEY, new ThemeController(initial));
}

export function useTheme(): ThemeController {
	return getContext<ThemeController>(KEY);
}
