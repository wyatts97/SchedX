/**
 * Enhanced API Client with retry logic and error handling
 */

export interface ApiError {
	message: string;
	status: number;
	correlationId?: string;
	details?: any;
}

export interface RetryOptions {
	maxRetries?: number;
	retryDelay?: number;
	retryableStatuses?: number[];
	onRetry?: (attempt: number, error: ApiError) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
	maxRetries: 3,
	retryDelay: 1000,
	retryableStatuses: [408, 429, 500, 502, 503, 504],
	onRetry: () => {}
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryable(status: number, retryableStatuses: number[]): boolean {
	return retryableStatuses.includes(status);
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number, baseDelay: number): number {
	return baseDelay * Math.pow(2, attempt - 1);
}

/**
 * Parse API error response
 */
async function parseErrorResponse(response: Response): Promise<ApiError> {
	const correlationId = response.headers.get('X-Correlation-ID') || undefined;
	
	let details: any;
	try {
		details = await response.json();
	} catch {
		details = await response.text();
	}

	return {
		message: details?.error || details?.message || `Request failed with status ${response.status}`,
		status: response.status,
		correlationId,
		details
	};
}

/**
 * Enhanced fetch with retry logic
 */
export async function fetchWithRetry(
	url: string,
	options: RequestInit = {},
	retryOptions: RetryOptions = {}
): Promise<Response> {
	const opts = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
	let lastError: ApiError | null = null;

	for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
		try {
			const response = await fetch(url, options);

			// If successful, return response
			if (response.ok) {
				return response;
			}

			// Parse error
			const error = await parseErrorResponse(response);
			lastError = error;

			// Check if retryable
			if (!isRetryable(error.status, opts.retryableStatuses) || attempt === opts.maxRetries) {
				throw error;
			}

			// Calculate delay with exponential backoff
			const delay = getBackoffDelay(attempt, opts.retryDelay);
			
			// Call retry callback
			opts.onRetry(attempt, error);

			// Wait before retry
			await sleep(delay);
		} catch (error) {
			// Network errors or non-retryable errors
			if (error instanceof Error && !('status' in error)) {
				// Network error
				if (attempt === opts.maxRetries) {
					throw {
						message: error.message || 'Network error',
						status: 0,
						details: error
					} as ApiError;
				}

				// Retry network errors
				const delay = getBackoffDelay(attempt, opts.retryDelay);
				opts.onRetry(attempt, {
					message: error.message,
					status: 0
				});
				await sleep(delay);
			} else {
				// Re-throw API errors
				throw error;
			}
		}
	}

	// Should never reach here, but TypeScript needs it
	throw lastError || new Error('Request failed');
}

/**
 * GET request with retry
 */
export async function get<T = any>(
	url: string,
	options: RequestInit = {},
	retryOptions?: RetryOptions
): Promise<T> {
	const response = await fetchWithRetry(url, { ...options, method: 'GET' }, retryOptions);
	return response.json();
}

/**
 * POST request with retry
 */
export async function post<T = any>(
	url: string,
	data?: any,
	options: RequestInit = {},
	retryOptions?: RetryOptions
): Promise<T> {
	const response = await fetchWithRetry(
		url,
		{
			...options,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			},
			body: data ? JSON.stringify(data) : undefined
		},
		retryOptions
	);
	return response.json();
}

/**
 * PUT request with retry
 */
export async function put<T = any>(
	url: string,
	data?: any,
	options: RequestInit = {},
	retryOptions?: RetryOptions
): Promise<T> {
	const response = await fetchWithRetry(
		url,
		{
			...options,
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			},
			body: data ? JSON.stringify(data) : undefined
		},
		retryOptions
	);
	return response.json();
}

/**
 * DELETE request with retry
 */
export async function del<T = any>(
	url: string,
	options: RequestInit = {},
	retryOptions?: RetryOptions
): Promise<T> {
	const response = await fetchWithRetry(url, { ...options, method: 'DELETE' }, retryOptions);
	return response.json();
}

/**
 * Handle API error and return user-friendly message
 */
export function getErrorMessage(error: any): string {
	if (error && typeof error === 'object') {
		if ('message' in error) {
			return error.message;
		}
		if ('error' in error) {
			return error.error;
		}
	}
	
	if (typeof error === 'string') {
		return error;
	}
	
	return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if error is network error
 */
export function isNetworkError(error: any): boolean {
	return error && typeof error === 'object' && error.status === 0;
}

/**
 * Check if error is authentication error
 */
export function isAuthError(error: any): boolean {
	return error && typeof error === 'object' && (error.status === 401 || error.status === 403);
}

/**
 * Check if error is rate limit error
 */
export function isRateLimitError(error: any): boolean {
	return error && typeof error === 'object' && error.status === 429;
}

export default {
	get,
	post,
	put,
	del,
	fetchWithRetry,
	getErrorMessage,
	isNetworkError,
	isAuthError,
	isRateLimitError
};
