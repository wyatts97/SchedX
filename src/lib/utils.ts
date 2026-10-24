import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

/** POSTs JSON to an app endpoint and throws with the server's message on failure. */
export async function api<T = unknown>(url: string, body?: unknown, method = 'POST'): Promise<T> {
	const res = await fetch(url, {
		method,
		headers: body === undefined ? undefined : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok)
		throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
	return data as T;
}
