import { writable } from 'svelte/store';
import type { ToastMessage, ToastAction } from '$lib/types';

function createToastStore() {
	const { subscribe, set, update } = writable<ToastMessage[]>([]);

	const addToast = (toast: Omit<ToastMessage, 'id'>) => {
		const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const newToast: ToastMessage = {
			id,
			duration: 5000, // Default 5 seconds
			dismissible: true,
			...toast
		};

		update((toasts) => [...toasts, newToast]);
		return id;
	};

	const removeToast = (id: string) => {
		update((toasts) => toasts.filter((toast) => toast.id !== id));
	};

	const clearAll = () => {
		set([]);
	};

	// Convenience methods for different toast types
	const success = (title: string, message?: string, options?: Partial<ToastMessage>) => {
		return addToast({ type: 'success', title, message, ...options });
	};

	const error = (title: string, message?: string, options?: Partial<ToastMessage>) => {
		return addToast({ type: 'error', title, message, duration: 7000, ...options });
	};

	const warning = (title: string, message?: string, options?: Partial<ToastMessage>) => {
		return addToast({ type: 'warning', title, message, ...options });
	};

	const info = (title: string, message?: string, options?: Partial<ToastMessage>) => {
		return addToast({ type: 'info', title, message, ...options });
	};

	// Error handling with correlation ID
	const apiError = (
		message: string,
		correlationId?: string,
		options?: Partial<ToastMessage>
	) => {
		return addToast({
			type: 'error',
			title: 'Request Failed',
			message,
			correlationId,
			duration: 7000,
			...options
		});
	};

	// Network error
	const networkError = (options?: Partial<ToastMessage>) => {
		return addToast({
			type: 'error',
			title: 'Network Error',
			message: 'Unable to connect to the server. Please check your internet connection.',
			duration: 7000,
			...options
		});
	};

	return {
		subscribe,
		add: addToast,
		remove: removeToast,
		clearAll,
		success,
		error,
		warning,
		info,
		apiError,
		networkError
	};
}

export const toastStore = createToastStore();
