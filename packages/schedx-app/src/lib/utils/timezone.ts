/**
 * Timezone Utility Functions
 * Handles automatic timezone detection and common timezone operations
 */

/**
 * Get the user's timezone from the browser
 */
export function detectTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return 'UTC';
	}
}

/**
 * Get a list of common timezones with labels
 */
export function getCommonTimezones(): Array<{ value: string; label: string; offset: string }> {
	const timezones = [
		// Americas
		{ value: 'America/New_York', label: 'Eastern Time (US)', region: 'Americas' },
		{ value: 'America/Chicago', label: 'Central Time (US)', region: 'Americas' },
		{ value: 'America/Denver', label: 'Mountain Time (US)', region: 'Americas' },
		{ value: 'America/Los_Angeles', label: 'Pacific Time (US)', region: 'Americas' },
		{ value: 'America/Anchorage', label: 'Alaska Time', region: 'Americas' },
		{ value: 'Pacific/Honolulu', label: 'Hawaii Time', region: 'Americas' },
		{ value: 'America/Toronto', label: 'Eastern Time (Canada)', region: 'Americas' },
		{ value: 'America/Vancouver', label: 'Pacific Time (Canada)', region: 'Americas' },
		{ value: 'America/Mexico_City', label: 'Mexico City', region: 'Americas' },
		{ value: 'America/Sao_Paulo', label: 'São Paulo', region: 'Americas' },
		{ value: 'America/Buenos_Aires', label: 'Buenos Aires', region: 'Americas' },
		
		// Europe
		{ value: 'Europe/London', label: 'London (GMT/BST)', region: 'Europe' },
		{ value: 'Europe/Paris', label: 'Paris (CET)', region: 'Europe' },
		{ value: 'Europe/Berlin', label: 'Berlin (CET)', region: 'Europe' },
		{ value: 'Europe/Amsterdam', label: 'Amsterdam (CET)', region: 'Europe' },
		{ value: 'Europe/Rome', label: 'Rome (CET)', region: 'Europe' },
		{ value: 'Europe/Madrid', label: 'Madrid (CET)', region: 'Europe' },
		{ value: 'Europe/Moscow', label: 'Moscow', region: 'Europe' },
		{ value: 'Europe/Istanbul', label: 'Istanbul', region: 'Europe' },
		
		// Asia/Pacific
		{ value: 'Asia/Dubai', label: 'Dubai', region: 'Asia' },
		{ value: 'Asia/Kolkata', label: 'India (IST)', region: 'Asia' },
		{ value: 'Asia/Singapore', label: 'Singapore', region: 'Asia' },
		{ value: 'Asia/Hong_Kong', label: 'Hong Kong', region: 'Asia' },
		{ value: 'Asia/Shanghai', label: 'China (CST)', region: 'Asia' },
		{ value: 'Asia/Tokyo', label: 'Tokyo (JST)', region: 'Asia' },
		{ value: 'Asia/Seoul', label: 'Seoul (KST)', region: 'Asia' },
		{ value: 'Australia/Sydney', label: 'Sydney (AEST)', region: 'Pacific' },
		{ value: 'Australia/Melbourne', label: 'Melbourne (AEST)', region: 'Pacific' },
		{ value: 'Australia/Perth', label: 'Perth (AWST)', region: 'Pacific' },
		{ value: 'Pacific/Auckland', label: 'Auckland (NZST)', region: 'Pacific' },
		
		// Other
		{ value: 'UTC', label: 'UTC (Coordinated Universal Time)', region: 'Other' },
	];

	// Add current offset to each timezone
	return timezones.map(tz => {
		const offset = getTimezoneOffset(tz.value);
		return {
			value: tz.value,
			label: tz.label,
			offset
		};
	});
}

/**
 * Get the UTC offset string for a timezone (e.g., "UTC-05:00")
 */
export function getTimezoneOffset(timezone: string): string {
	try {
		const now = new Date();
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: timezone,
			timeZoneName: 'shortOffset'
		});
		
		const parts = formatter.formatToParts(now);
		const offsetPart = parts.find(p => p.type === 'timeZoneName');
		return offsetPart?.value || 'UTC';
	} catch {
		return 'UTC';
	}
}

/**
 * Format a date in a specific timezone
 */
export function formatInTimezone(date: Date, timezone: string, options?: Intl.DateTimeFormatOptions): string {
	try {
		return new Intl.DateTimeFormat('en-US', {
			...options,
			timeZone: timezone
		}).format(date);
	} catch {
		return date.toLocaleString();
	}
}

/**
 * Check if a timezone string is valid
 */
export function isValidTimezone(timezone: string): boolean {
	try {
		Intl.DateTimeFormat(undefined, { timeZone: timezone });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get timezone from localStorage or detect it
 */
export function getStoredOrDetectedTimezone(): string {
	if (typeof window === 'undefined') {
		return 'UTC';
	}
	
	const stored = localStorage.getItem('userTimezone');
	if (stored && isValidTimezone(stored)) {
		return stored;
	}
	
	return detectTimezone();
}

/**
 * Store timezone in localStorage
 */
export function storeTimezone(timezone: string): void {
	if (typeof window !== 'undefined') {
		localStorage.setItem('userTimezone', timezone);
	}
}

/**
 * Sync timezone with server - auto-detect and save if not set
 */
export async function syncTimezone(): Promise<string> {
	try {
		// Get current server timezone
		const response = await fetch('/api/admin/timezone');
		if (!response.ok) {
			throw new Error('Failed to fetch timezone');
		}
		
		const data = await response.json();
		
		// If server has UTC (default), auto-detect and update
		if (data.timezone === 'UTC') {
			const detected = detectTimezone();
			if (detected !== 'UTC') {
				// Update server with detected timezone
				await fetch('/api/admin/timezone', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ timezone: detected })
				});
				storeTimezone(detected);
				return detected;
			}
		}
		
		// Store and return server timezone
		storeTimezone(data.timezone);
		return data.timezone;
	} catch (error) {
		console.error('Failed to sync timezone:', error);
		return getStoredOrDetectedTimezone();
	}
}
