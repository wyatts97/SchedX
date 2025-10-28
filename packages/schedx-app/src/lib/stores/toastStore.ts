import { toast } from 'svelte-sonner';

interface ToastOptions {
    actions?: Array<{
        label: string;
        url: string;
        target?: '_blank' | '_self';
        variant?: 'primary' | 'secondary';
    }>;
    duration?: number;
}

// Map existing toastStore API to svelte-sonner so callers don't need to change
export const toastStore = {
    // Basic types with optional third parameter for legacy compatibility
    success: (title: string, message?: string, options?: ToastOptions) => {
        const sonnerOptions: any = {
            description: message || undefined,
            duration: options?.duration
        };
        
        // Map actions to sonner's action format
        if (options?.actions && options.actions.length > 0) {
            const firstAction = options.actions[0];
            sonnerOptions.action = {
                label: firstAction.label,
                onClick: () => window.open(firstAction.url, firstAction.target || '_blank')
            };
        }
        
        return toast.success(title, sonnerOptions);
    },
    error: (title: string, message?: string, options?: ToastOptions) => {
        const sonnerOptions: any = {
            description: message || undefined,
            duration: options?.duration
        };
        
        if (options?.actions && options.actions.length > 0) {
            const firstAction = options.actions[0];
            sonnerOptions.action = {
                label: firstAction.label,
                onClick: () => window.open(firstAction.url, firstAction.target || '_blank')
            };
        }
        
        return toast.error(title, sonnerOptions);
    },
    warning: (title: string, message?: string, options?: ToastOptions) => {
        const sonnerOptions: any = {
            description: message || undefined,
            duration: options?.duration
        };
        
        if (options?.actions && options.actions.length > 0) {
            const firstAction = options.actions[0];
            sonnerOptions.action = {
                label: firstAction.label,
                onClick: () => window.open(firstAction.url, firstAction.target || '_blank')
            };
        }
        
        return toast.warning ? toast.warning(title, sonnerOptions) : toast(title, sonnerOptions);
    },
    info: (title: string, message?: string, options?: ToastOptions) => {
        const sonnerOptions: any = {
            description: message || undefined,
            duration: options?.duration
        };
        
        if (options?.actions && options.actions.length > 0) {
            const firstAction = options.actions[0];
            sonnerOptions.action = {
                label: firstAction.label,
                onClick: () => window.open(firstAction.url, firstAction.target || '_blank')
            };
        }
        
        return toast.info ? toast.info(title, sonnerOptions) : toast(title, sonnerOptions);
    },

    // Convenience helpers preserving prior semantics
    apiError: (message: string, _correlationId?: string) =>
        toast.error('Request Failed', { description: message }),
    networkError: () =>
        toast.error('Network Error', {
            description: 'Unable to connect to the server. Please check your internet connection.'
        })
};
