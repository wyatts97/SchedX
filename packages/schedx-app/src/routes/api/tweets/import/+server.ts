/**
 * CSV Import API for Tweets
 * Supports importing tweets from CSV files with columns:
 * - content (required): Tweet text
 * - scheduledDate (optional): ISO date or relative format
 * - accountId (optional): Twitter account ID
 * - status (optional): draft, scheduled, queued (default: draft)
 */

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getDbInstance, getRawDbInstance } from '$lib/server/db';
import { TweetStatus } from '@schedx/shared-lib/types/types';
import type { Tweet } from '@schedx/shared-lib/types/types';
import logger from '$lib/server/logger';
import { getAdminUserId } from '$lib/server/adminCache';
import { sanitizeTweetContent } from '$lib/utils/twitter';

interface CsvRow {
	content: string;
	scheduledDate?: string;
	accountId?: string;
	status?: string;
}

interface ImportResult {
	success: boolean;
	imported: number;
	failed: number;
	errors: { row: number; error: string }[];
	tweets: { id: string; content: string; status: string }[];
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		// Validate admin session
		const adminSession = cookies.get('admin_session');
		if (!adminSession) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = await getAdminUserId();
		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const defaultAccountId = formData.get('accountId') as string | null;
		const defaultStatus = (formData.get('status') as string) || 'draft';

		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		if (!file.name.endsWith('.csv')) {
			return json({ error: 'File must be a CSV' }, { status: 400 });
		}

		// Read and parse CSV
		const csvText = await file.text();
		const rows = parseCsv(csvText);

		if (rows.length === 0) {
			return json({ error: 'CSV file is empty or has no valid rows' }, { status: 400 });
		}

		if (rows.length > 500) {
			return json({ error: 'Maximum 500 tweets per import' }, { status: 400 });
		}

		// Validate default account if provided
		const db = getDbInstance();
		let validAccountId: string | null = null;
		
		if (defaultAccountId) {
			const accounts = await db.getAllUserAccounts();
			const account = accounts.find((a: any) => 
				a.providerAccountId === defaultAccountId || a.id === defaultAccountId
			);
			if (account) {
				validAccountId = account.providerAccountId;
			}
		}

		// Process rows
		const result: ImportResult = {
			success: true,
			imported: 0,
			failed: 0,
			errors: [],
			tweets: []
		};

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const rowNum = i + 2; // +2 because CSV is 1-indexed and has header

			try {
				// Validate content
				if (!row.content || row.content.trim().length === 0) {
					result.errors.push({ row: rowNum, error: 'Content is required' });
					result.failed++;
					continue;
				}

				const sanitizedContent = sanitizeTweetContent(row.content);
				
				if (sanitizedContent.length > 280) {
					result.errors.push({ row: rowNum, error: `Content exceeds 280 characters (${sanitizedContent.length})` });
					result.failed++;
					continue;
				}

				// Parse status
				let status: TweetStatus;
				const rowStatus = row.status?.toLowerCase() || defaultStatus;
				switch (rowStatus) {
					case 'scheduled':
						status = TweetStatus.SCHEDULED;
						break;
					case 'queued':
						status = TweetStatus.QUEUED;
						break;
					case 'draft':
					default:
						status = TweetStatus.DRAFT;
						break;
				}

				// Parse scheduled date
				let scheduledDate = new Date();
				if (row.scheduledDate) {
					const parsed = parseDate(row.scheduledDate);
					if (!parsed) {
						result.errors.push({ row: rowNum, error: `Invalid date format: ${row.scheduledDate}` });
						result.failed++;
						continue;
					}
					scheduledDate = parsed;
				}

				// Use row accountId or default
				const accountId = row.accountId || validAccountId;

				// Create tweet
				const tweet: Partial<Tweet> = {
					userId,
					content: sanitizedContent,
					scheduledDate,
					status,
					twitterAccountId: accountId || undefined,
					media: [],
					createdAt: new Date(),
					updatedAt: new Date()
				};

				const tweetId = await db.saveTweet(tweet as Tweet);

				result.imported++;
				result.tweets.push({
					id: tweetId,
					content: sanitizedContent.substring(0, 50) + (sanitizedContent.length > 50 ? '...' : ''),
					status: rowStatus
				});

			} catch (error) {
				result.errors.push({ 
					row: rowNum, 
					error: error instanceof Error ? error.message : 'Unknown error' 
				});
				result.failed++;
			}
		}

		logger.info(`CSV import completed: ${result.imported} imported, ${result.failed} failed out of ${rows.length} rows`);

		return json(result);

	} catch (error) {
		logger.error(`CSV import error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		return json({ 
			error: 'Failed to import CSV',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};

/**
 * Parse CSV text into rows
 */
function parseCsv(text: string): CsvRow[] {
	const lines = text.split(/\r?\n/).filter(line => line.trim());
	
	if (lines.length < 2) {
		return []; // Need at least header + 1 data row
	}

	// Parse header
	const headerLine = lines[0];
	const headers = parseCsvLine(headerLine).map(h => h.toLowerCase().trim());

	// Validate required headers
	if (!headers.includes('content')) {
		throw new Error('CSV must have a "content" column');
	}

	// Parse data rows
	const rows: CsvRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const values = parseCsvLine(lines[i]);
		
		const row: CsvRow = {
			content: ''
		};

		for (let j = 0; j < headers.length; j++) {
			const header = headers[j];
			const value = values[j] || '';

			switch (header) {
				case 'content':
				case 'text':
				case 'tweet':
					row.content = value;
					break;
				case 'scheduleddate':
				case 'scheduled_date':
				case 'date':
				case 'time':
				case 'datetime':
					row.scheduledDate = value;
					break;
				case 'accountid':
				case 'account_id':
				case 'account':
					row.accountId = value;
					break;
				case 'status':
				case 'type':
					row.status = value;
					break;
			}
		}

		if (row.content) {
			rows.push(row);
		}
	}

	return rows;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		const nextChar = line[i + 1];

		if (char === '"' && !inQuotes) {
			inQuotes = true;
		} else if (char === '"' && inQuotes) {
			if (nextChar === '"') {
				// Escaped quote
				current += '"';
				i++;
			} else {
				// End of quoted value
				inQuotes = false;
			}
		} else if (char === ',' && !inQuotes) {
			result.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}

	result.push(current.trim());
	return result;
}

/**
 * Parse date string in various formats
 */
function parseDate(dateStr: string): Date | null {
	const trimmed = dateStr.trim();

	// Try ISO format first
	const isoDate = new Date(trimmed);
	if (!isNaN(isoDate.getTime())) {
		return isoDate;
	}

	// Try relative formats like "+1h", "+30m", "+1d"
	const relativeMatch = trimmed.match(/^\+(\d+)([hdm])$/i);
	if (relativeMatch) {
		const amount = parseInt(relativeMatch[1]);
		const unit = relativeMatch[2].toLowerCase();
		const now = new Date();

		switch (unit) {
			case 'h':
				return new Date(now.getTime() + amount * 60 * 60 * 1000);
			case 'd':
				return new Date(now.getTime() + amount * 24 * 60 * 60 * 1000);
			case 'm':
				return new Date(now.getTime() + amount * 60 * 1000);
		}
	}

	// Try common date formats
	const formats = [
		/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/, // 2024-01-15 14:30
		/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/, // 01/15/2024 14:30
		/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/, // 2024/01/15 14:30
	];

	for (const format of formats) {
		const match = trimmed.match(format);
		if (match) {
			try {
				let year: number, month: number, day: number, hour: number, minute: number;
				
				if (format.source.startsWith('^(\\d{4})')) {
					[, year, month, day, hour, minute] = match.map(Number) as [any, number, number, number, number, number];
				} else {
					[, month, day, year, hour, minute] = match.map(Number) as [any, number, number, number, number, number];
				}

				const date = new Date(year, month - 1, day, hour, minute);
				if (!isNaN(date.getTime())) {
					return date;
				}
			} catch {
				continue;
			}
		}
	}

	return null;
}

// GET endpoint to download a sample CSV template
export const GET: RequestHandler = async ({ cookies }) => {
	// Validate admin session
	const adminSession = cookies.get('admin_session');
	if (!adminSession) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const sampleCsv = `content,scheduledDate,status
"Hello, Twitter! This is my first scheduled tweet.",2024-12-25 10:00,scheduled
"Another great tweet with some tips and tricks!",+1d,draft
"Check out our new feature! #announcement",+2h,queued
"This tweet will be saved as a draft for later editing.",,draft`;

	return new Response(sampleCsv, {
		headers: {
			'Content-Type': 'text/csv',
			'Content-Disposition': 'attachment; filename="tweet-import-template.csv"'
		}
	});
};
