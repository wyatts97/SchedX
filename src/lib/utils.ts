import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

/** For a dialog's onInteractOutside: pressing a toast (say, its Undo) shouldn't close the dialog. */
export function ignoreToastClicks(e: Event): void {
	if ((e.target as Element | null)?.closest?.('[data-sonner-toaster]')) e.preventDefault();
}

/** A failed app request: the server's message, plus its status and full JSON body. */
export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly data: Record<string, unknown>
	) {
		super(message);
	}
}

/** POSTs JSON to an app endpoint and throws an ApiError with the server's message on failure. */
export async function api<T = unknown>(url: string, body?: unknown, method = 'POST'): Promise<T> {
	const res = await fetch(url, {
		method,
		headers: body === undefined ? undefined : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok)
		throw new ApiError(
			(data as { error?: string }).error ?? `Request failed (${res.status})`,
			res.status,
			data
		);
	return data as T;
}
