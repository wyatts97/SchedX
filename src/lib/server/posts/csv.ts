import { fromLocalInput } from '../../shared/time.js';
import type { AccountView, ComposeInput } from '../../shared/compose.js';

/** Minimal RFC 4180 parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(input: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input; // strip BOM
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += c;
	}
	if (field || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((r) => r.some((f) => f.trim()));
}

export interface CsvRowResult {
	line: number;
	input?: ComposeInput;
	error?: string;
}

/**
 * Columns (header row required): `text`, optional `scheduled_at` (ISO 8601, or
 * `YYYY-MM-DD HH:mm` in your time zone; empty = add to queue) and optional `account` (handle).
 */
export function csvToCompose(csv: string, accounts: AccountView[], tz: string): CsvRowResult[] {
	const rows = parseCsv(csv);
	if (!rows.length) return [{ line: 1, error: 'The file is empty.' }];
	const header = rows[0].map((h) => h.trim().toLowerCase());
	const col = (name: string) => header.indexOf(name);
	const textCol = col('text');
	if (textCol === -1) return [{ line: 1, error: 'Missing a "text" column in the header row.' }];
	const atCol = col('scheduled_at');
	const accountCol = col('account');
	const fallback = accounts.find((a) => a.isDefault) ?? accounts[0];

	return rows.slice(1).map((r, i) => {
		const line = i + 2;
		const text = r[textCol]?.trim() ?? '';
		if (!text) return { line, error: 'Empty text' };
		const handle = accountCol >= 0 ? r[accountCol]?.trim().replace(/^@/, '').toLowerCase() : '';
		const account = handle ? accounts.find((a) => a.username.toLowerCase() === handle) : fallback;
		if (!account)
			return { line, error: handle ? `Unknown account @${handle}` : 'No account connected' };
		const raw = atCol >= 0 ? r[atCol]?.trim() : '';
		let scheduledAt: number | null = null;
		if (raw) {
			scheduledAt = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
				? Date.parse(raw)
				: fromLocalInput(raw.replace(' ', 'T'), tz);
			if (!scheduledAt || Number.isNaN(scheduledAt))
				return { line, error: `Unreadable date "${raw}"` };
		}
		return {
			line,
			input: {
				accountIds: [account.id],
				items: [{ text, media: [] }],
				options: {},
				action: scheduledAt ? 'schedule' : 'queue',
				scheduledAt
			}
		};
	});
}
