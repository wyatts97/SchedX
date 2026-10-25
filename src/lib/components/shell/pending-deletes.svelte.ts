import { getContext, setContext } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import { refreshAll } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { api } from '#lib/utils.js';

const KEY = Symbol('pending-deletes');
const UNDO_MS = 5000;

export interface DeleteRequest {
	url: string;
	method?: 'POST' | 'DELETE';
	body?: unknown;
}

interface Pending {
	ids: string[];
	requests: DeleteRequest[];
	timer: ReturnType<typeof setTimeout>;
}

/**
 * Deletes with an Undo window instead of a confirm() prompt: the items disappear from every list
 * right away, and the delete is only sent once the toast's few seconds are up. One instance per
 * app shell (context), never module state, because the server renders many users' pages.
 */
export class PendingDeletes {
	/** Ids hidden from lists while their delete waits out the undo window. */
	readonly hidden = new SvelteSet<string>();
	#pending = new Set<Pending>();

	/** The list without anything that is waiting to be deleted. */
	visible<T extends { id: string }>(list: T[]): T[] {
		return this.hidden.size ? list.filter((x) => !this.hidden.has(x.id)) : list;
	}

	schedule({ ids, label, requests }: { ids: string[]; label: string; requests: DeleteRequest[] }) {
		for (const id of ids) this.hidden.add(id);
		const entry: Pending = { ids, requests, timer: setTimeout(() => this.#commit(entry), UNDO_MS) };
		this.#pending.add(entry);
		toast(label, {
			duration: UNDO_MS,
			action: { label: 'Undo', onClick: () => this.#undo(entry) }
		});
	}

	#undo(entry: Pending) {
		if (!this.#pending.delete(entry)) return;
		clearTimeout(entry.timer);
		for (const id of entry.ids) this.hidden.delete(id);
	}

	async #commit(entry: Pending) {
		if (!this.#pending.delete(entry)) return;
		const results = await Promise.allSettled(
			entry.requests.map((r) => api(r.url, r.body, r.method ?? 'POST'))
		);
		const failed = results.find((r) => r.status === 'rejected');
		if (failed) toast.error((failed.reason as Error).message);
		await refreshAll();
		for (const id of entry.ids) this.hidden.delete(id);
	}

	/** Sends everything still waiting, without waiting for answers (the tab is going away). */
	flush() {
		for (const entry of this.#pending) {
			clearTimeout(entry.timer);
			for (const r of entry.requests) {
				void fetch(r.url, {
					method: r.method ?? 'POST',
					headers: r.body === undefined ? undefined : { 'content-type': 'application/json' },
					body: r.body === undefined ? undefined : JSON.stringify(r.body),
					keepalive: true
				});
			}
		}
		this.#pending.clear();
	}

	listen(): () => void {
		const onHide = () => this.flush();
		window.addEventListener('pagehide', onHide);
		return () => window.removeEventListener('pagehide', onHide);
	}
}

export function providePendingDeletes(): PendingDeletes {
	return setContext(KEY, new PendingDeletes());
}

export function usePendingDeletes(): PendingDeletes {
	return getContext<PendingDeletes>(KEY);
}
