import type { Action } from 'svelte/action';

export interface FileDropOptions {
	ondrop: (files: File[]) => void;
	/** Called with true when files are dragged over the element, false when they leave. */
	onover?: (over: boolean) => void;
	disabled?: boolean;
}

function carriesFiles(e: DragEvent): boolean {
	return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
}

/**
 * Turns an element into a file drop target. Uses the legacy enter/leave counter so moving over
 * child elements doesn't flicker, and ignores non-file drags (e.g. selected text in a textarea).
 */
export const fileDrop: Action<HTMLElement, FileDropOptions> = (node, initial) => {
	let options = initial;
	let depth = 0;

	const enter = (e: DragEvent) => {
		if (!carriesFiles(e) || options.disabled) return;
		e.preventDefault();
		e.stopPropagation();
		if (++depth === 1) options.onover?.(true);
	};
	const over = (e: DragEvent) => {
		if (!carriesFiles(e) || options.disabled) return;
		e.preventDefault();
		e.stopPropagation();
		e.dataTransfer!.dropEffect = 'copy';
	};
	const leave = (e: DragEvent) => {
		if (!carriesFiles(e) || options.disabled) return;
		e.stopPropagation();
		depth = Math.max(0, depth - 1);
		if (depth === 0) options.onover?.(false);
	};
	const drop = (e: DragEvent) => {
		if (!carriesFiles(e)) return;
		e.preventDefault();
		e.stopPropagation();
		depth = 0;
		options.onover?.(false);
		if (options.disabled) return;
		const files = Array.from(e.dataTransfer?.files ?? []);
		if (files.length) options.ondrop(files);
	};

	node.addEventListener('dragenter', enter);
	node.addEventListener('dragover', over);
	node.addEventListener('dragleave', leave);
	node.addEventListener('drop', drop);
	return {
		update(next) {
			options = next;
		},
		destroy() {
			node.removeEventListener('dragenter', enter);
			node.removeEventListener('dragover', over);
			node.removeEventListener('dragleave', leave);
			node.removeEventListener('drop', drop);
		}
	};
};

/** Stops the browser from navigating to a file that is dropped outside every drop target. */
export function blockStrayDrops(): () => void {
	const prevent = (e: DragEvent) => {
		if (carriesFiles(e)) e.preventDefault();
	};
	window.addEventListener('dragover', prevent);
	window.addEventListener('drop', prevent);
	return () => {
		window.removeEventListener('dragover', prevent);
		window.removeEventListener('drop', prevent);
	};
}

/** Files pasted into an element (e.g. a screenshot pasted into the post text). */
export function pastedFiles(e: ClipboardEvent): File[] {
	return Array.from(e.clipboardData?.files ?? []);
}
