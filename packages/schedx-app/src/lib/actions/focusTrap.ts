/**
 * Focus trap action for modals and dialogs
 * Traps focus within the element and returns focus to the triggering element on close
 */

const FOCUSABLE_SELECTORS = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
	'[contenteditable]'
].join(', ');

interface FocusTrapOptions {
	onEscape?: () => void;
	initialFocus?: string; // Selector for initial focus element
	returnFocus?: boolean; // Whether to return focus to trigger element on unmount
}

export function focusTrap(node: HTMLElement, options: FocusTrapOptions = {}) {
	const { onEscape, initialFocus, returnFocus = true } = options;
	
	// Store the element that triggered the modal
	const previouslyFocused = document.activeElement as HTMLElement;
	
	// Get all focusable elements within the trap
	function getFocusableElements(): HTMLElement[] {
		return Array.from(node.querySelectorAll(FOCUSABLE_SELECTORS)) as HTMLElement[];
	}
	
	// Focus the first focusable element or specified initial focus
	function setInitialFocus() {
		if (initialFocus) {
			const initialElement = node.querySelector(initialFocus) as HTMLElement;
			if (initialElement) {
				initialElement.focus();
				return;
			}
		}
		
		const focusable = getFocusableElements();
		if (focusable.length > 0) {
			focusable[0].focus();
		} else {
			// If no focusable elements, focus the container itself
			node.setAttribute('tabindex', '-1');
			node.focus();
		}
	}
	
	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && onEscape) {
			event.preventDefault();
			onEscape();
			return;
		}
		
		if (event.key !== 'Tab') return;
		
		const focusable = getFocusableElements();
		if (focusable.length === 0) return;
		
		const firstFocusable = focusable[0];
		const lastFocusable = focusable[focusable.length - 1];
		
		// Shift + Tab on first element -> move to last
		if (event.shiftKey && document.activeElement === firstFocusable) {
			event.preventDefault();
			lastFocusable.focus();
		}
		// Tab on last element -> move to first
		else if (!event.shiftKey && document.activeElement === lastFocusable) {
			event.preventDefault();
			firstFocusable.focus();
		}
	}
	
	// Prevent focus from leaving the trap
	function handleFocusIn(event: FocusEvent) {
		if (!node.contains(event.target as Node)) {
			event.stopPropagation();
			setInitialFocus();
		}
	}
	
	// Set up the focus trap
	node.addEventListener('keydown', handleKeydown);
	document.addEventListener('focusin', handleFocusIn);
	
	// Set initial focus after a brief delay to ensure modal is rendered
	requestAnimationFrame(() => {
		setInitialFocus();
	});
	
	return {
		update(newOptions: FocusTrapOptions) {
			// Options can be updated if needed
		},
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
			document.removeEventListener('focusin', handleFocusIn);
			
			// Return focus to the element that triggered the modal
			if (returnFocus && previouslyFocused && typeof previouslyFocused.focus === 'function') {
				previouslyFocused.focus();
			}
		}
	};
}
