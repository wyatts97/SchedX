/**
 * Inline validation action for form inputs
 * Validates on blur and shows error messages
 */

export interface ValidationRule {
	validate: (value: string) => boolean;
	message: string;
}

export interface ValidateOnBlurOptions {
	rules: ValidationRule[];
	onValidate?: (isValid: boolean, errors: string[]) => void;
	errorClass?: string;
	successClass?: string;
}

const defaultErrorClass = 'border-red-500 focus:border-red-500 focus:ring-red-500/20';
const defaultSuccessClass = 'border-green-500 focus:border-green-500 focus:ring-green-500/20';

export function validateOnBlur(node: HTMLInputElement | HTMLTextAreaElement, options: ValidateOnBlurOptions) {
	const { rules, onValidate, errorClass = defaultErrorClass, successClass = defaultSuccessClass } = options;
	
	let errorElement: HTMLElement | null = null;
	let hasBeenBlurred = false;
	
	function createErrorElement(): HTMLElement {
		const el = document.createElement('p');
		el.className = 'mt-1 text-sm text-red-500 animate-fade-in';
		el.setAttribute('role', 'alert');
		el.setAttribute('aria-live', 'polite');
		return el;
	}
	
	function validate(): { isValid: boolean; errors: string[] } {
		const value = node.value;
		const errors: string[] = [];
		
		for (const rule of rules) {
			if (!rule.validate(value)) {
				errors.push(rule.message);
			}
		}
		
		return { isValid: errors.length === 0, errors };
	}
	
	function showErrors(errors: string[]) {
		// Remove success class
		node.classList.remove(...successClass.split(' '));
		
		// Add error class
		node.classList.add(...errorClass.split(' '));
		
		// Create or update error element
		if (!errorElement) {
			errorElement = createErrorElement();
			node.parentNode?.insertBefore(errorElement, node.nextSibling);
		}
		
		errorElement.textContent = errors[0]; // Show first error
		errorElement.style.display = 'block';
		
		// Set aria-invalid
		node.setAttribute('aria-invalid', 'true');
		node.setAttribute('aria-describedby', errorElement.id || 'validation-error');
	}
	
	function showSuccess() {
		// Remove error class
		node.classList.remove(...errorClass.split(' '));
		
		// Add success class (only if field has value)
		if (node.value.trim()) {
			node.classList.add(...successClass.split(' '));
		}
		
		// Hide error element
		if (errorElement) {
			errorElement.style.display = 'none';
		}
		
		// Clear aria-invalid
		node.removeAttribute('aria-invalid');
		node.removeAttribute('aria-describedby');
	}
	
	function clearValidation() {
		node.classList.remove(...errorClass.split(' '), ...successClass.split(' '));
		if (errorElement) {
			errorElement.style.display = 'none';
		}
		node.removeAttribute('aria-invalid');
		node.removeAttribute('aria-describedby');
	}
	
	function handleBlur() {
		hasBeenBlurred = true;
		const { isValid, errors } = validate();
		
		if (isValid) {
			showSuccess();
		} else {
			showErrors(errors);
		}
		
		onValidate?.(isValid, errors);
	}
	
	function handleInput() {
		// Only validate on input if field has been blurred before
		if (hasBeenBlurred) {
			const { isValid, errors } = validate();
			
			if (isValid) {
				showSuccess();
			} else {
				showErrors(errors);
			}
			
			onValidate?.(isValid, errors);
		}
	}
	
	function handleFocus() {
		// Clear validation styling on focus to reduce noise
		// Will re-validate on blur
	}
	
	node.addEventListener('blur', handleBlur);
	node.addEventListener('input', handleInput);
	node.addEventListener('focus', handleFocus);
	
	return {
		update(newOptions: ValidateOnBlurOptions) {
			// Update options if needed
		},
		destroy() {
			node.removeEventListener('blur', handleBlur);
			node.removeEventListener('input', handleInput);
			node.removeEventListener('focus', handleFocus);
			
			if (errorElement) {
				errorElement.remove();
			}
			
			clearValidation();
		}
	};
}

// Common validation rules
export const validationRules = {
	required: (message = 'This field is required'): ValidationRule => ({
		validate: (value) => value.trim().length > 0,
		message
	}),
	
	minLength: (min: number, message?: string): ValidationRule => ({
		validate: (value) => value.length >= min,
		message: message || `Must be at least ${min} characters`
	}),
	
	maxLength: (max: number, message?: string): ValidationRule => ({
		validate: (value) => value.length <= max,
		message: message || `Must be no more than ${max} characters`
	}),
	
	email: (message = 'Please enter a valid email address'): ValidationRule => ({
		validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
		message
	}),
	
	url: (message = 'Please enter a valid URL'): ValidationRule => ({
		validate: (value) => {
			try {
				new URL(value);
				return true;
			} catch {
				return false;
			}
		},
		message
	}),
	
	pattern: (regex: RegExp, message: string): ValidationRule => ({
		validate: (value) => regex.test(value),
		message
	}),
	
	tweetLength: (message = 'Tweet must be 280 characters or less'): ValidationRule => ({
		validate: (value) => value.length <= 280,
		message
	})
};
