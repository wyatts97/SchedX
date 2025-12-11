/**
 * Superforms Configuration and Utilities
 * 
 * This module provides centralized form handling using sveltekit-superforms.
 * Benefits:
 * - Automatic client/server validation with Zod
 * - Progressive enhancement (works without JS)
 * - Built-in loading states and error handling
 * - Type-safe form data
 * 
 * Usage:
 * 1. Define schema in $lib/validation/schemas.ts
 * 2. Create +page.server.ts with form action
 * 3. Use superForm() in +page.svelte
 * 
 * @see https://superforms.rocks/
 */

import { superForm as baseSuperForm, type SuperValidated } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { AnyZodObject } from 'zod';

// Re-export commonly used functions
export { superForm } from 'sveltekit-superforms';
export { zod } from 'sveltekit-superforms/adapters';
export { superValidate, message, setError, fail } from 'sveltekit-superforms';

// Default superForm options for consistent behavior across the app
export const defaultFormOptions = {
	// Show errors only after form submission or field blur
	validationMethod: 'oninput' as const,
	// Delay before showing validation errors (ms)
	delayMs: 300,
	// Reset form after successful submission
	resetForm: false,
	// Enable tainted field tracking
	taintedMessage: null,
	// Scroll to first error
	scrollToError: 'smooth' as const,
	// Auto-focus first error field
	autoFocusOnError: 'detect' as const,
	// Clear errors on input
	clearOnSubmit: 'errors-and-message' as const
};

/**
 * Create a superForm with app-wide defaults
 * Use this instead of importing superForm directly for consistent behavior
 */
export function createForm<T extends AnyZodObject>(
	form: SuperValidated<T>,
	options?: Parameters<typeof baseSuperForm>[1]
) {
	return baseSuperForm(form, {
		...defaultFormOptions,
		...options
	});
}

// Type helpers
export type { SuperValidated, Infer, InferIn } from 'sveltekit-superforms';
