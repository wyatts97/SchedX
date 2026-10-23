import { eq } from 'drizzle-orm';
import { getDb, schema } from './db/index.js';
import { DEFAULT_RATES, NOTIFICATION_EVENTS } from '../shared/types.js';
import type { NotificationEvent, Rates } from '../shared/types.js';

export interface BudgetSettings {
	/** Hard monthly cap in USD. 0 disables the cap. */
	monthlyUsd: number;
	/** Push a warning when spend crosses this percentage of the cap. */
	warnPct: number;
	/** Day of month (1–28) the X billing cycle starts on. */
	cycleDay: number;
}

export interface PublishingPause {
	reason: 'credits' | 'manual';
	since: number;
	message?: string;
}

export interface AppSettings {
	rates: Rates;
	budget: BudgetSettings;
	/** Posts missed while the server was down are still published if within this many minutes. */
	catchUpMinutes: number;
	notifications: Record<NotificationEvent, boolean>;
	publishingPaused: PublishingPause | null;
	budgetWarnedCycle: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
	rates: DEFAULT_RATES,
	budget: { monthlyUsd: 10, warnPct: 80, cycleDay: 1 },
	catchUpMinutes: 15,
	notifications: Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e.id, true])) as Record<
		NotificationEvent,
		boolean
	>,
	publishingPaused: null,
	budgetWarnedCycle: null
};

export function getSettings(): AppSettings {
	const rows = getDb().select().from(schema.settings).all();
	const stored = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<AppSettings>;
	return {
		...DEFAULT_SETTINGS,
		...stored,
		rates: { ...DEFAULT_SETTINGS.rates, ...(stored.rates ?? {}) },
		budget: { ...DEFAULT_SETTINGS.budget, ...(stored.budget ?? {}) },
		notifications: { ...DEFAULT_SETTINGS.notifications, ...(stored.notifications ?? {}) }
	};
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
	setRaw(key, value);
}

export function getRaw(key: string): unknown {
	return getDb().select().from(schema.settings).where(eq(schema.settings.key, key)).get()?.value;
}

/** Stores a JSON value; `null`/`undefined` removes the key so the default applies. */
export function setRaw(key: string, value: unknown): void {
	if (value === null || value === undefined) {
		getDb().delete(schema.settings).where(eq(schema.settings.key, key)).run();
		return;
	}
	getDb()
		.insert(schema.settings)
		.values({ key, value, updatedAt: Date.now() })
		.onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: Date.now() } })
		.run();
}
