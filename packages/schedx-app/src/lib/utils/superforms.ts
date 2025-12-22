/**
 * Superforms Utilities
 * Helper functions and configurations for sveltekit-superforms
 */

import { superForm, type SuperValidated } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { z } from 'zod';

/**
 * Default Superforms configuration
 * Provides consistent behavior across all forms
 */
export const defaultFormConfig = {
	// Reset form on successful submission
	resetForm: true,
	// Show validation errors immediately
	validationMethod: 'oninput' as const,
	// Delay before showing errors (ms)
	delayMs: 300,
	// Timeout for form submission (ms)
	timeoutMs: 10000,
	// Clear errors on input
	clearOnSubmit: 'errors-and-message' as const
};

/**
 * Create a client-side superform with default configuration
 * Use this in Svelte components for consistent form handling
 */
export function createClientForm<T extends z.ZodType>(
	schema: T,
	initialData?: Partial<z.infer<T>>
) {
	// For client-side only forms, we create a minimal validated object
	const defaults = schema.parse(initialData || {});
	
	return {
		schema,
		defaults,
		validate: (data: unknown) => schema.safeParse(data)
	};
}

/**
 * Format Zod validation errors for display
 */
export function formatZodErrors(errors: z.ZodError): Record<string, string[]> {
	const formatted: Record<string, string[]> = {};
	
	for (const error of errors.errors) {
		const path = error.path.join('.');
		if (!formatted[path]) {
			formatted[path] = [];
		}
		formatted[path].push(error.message);
	}
	
	return formatted;
}

/**
 * Get first error message for a field
 */
export function getFieldError(
	errors: Record<string, string[]> | undefined,
	field: string
): string | undefined {
	return errors?.[field]?.[0];
}

/**
 * Check if a field has errors
 */
export function hasFieldError(
	errors: Record<string, string[]> | undefined,
	field: string
): boolean {
	return Boolean(errors?.[field]?.length);
}
