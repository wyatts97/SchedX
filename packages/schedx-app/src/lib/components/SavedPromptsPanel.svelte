<script lang="ts">
	import { onMount } from 'svelte';
	import { Bookmark, Clock, Trash2, X } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toastStore';
	import { slide, fade } from 'svelte/transition';

	export let isOpen = false;
	export let onUsePrompt: (prompt: string, tone: string, length: string) => void;
	export let onClose: () => void;

	type SavedPrompt = {
		id: string;
		prompt: string;
		tone: string | null;
		length: string | null;
		usageCount: number;
		createdAt: number;
	};

	type HistoryPrompt = {
		id: string;
		prompt: string;
		tone: string | null;
		length: string | null;
		createdAt: number;
	};

	let activeTab: 'saved' | 'history' = 'saved';
	let savedPrompts: SavedPrompt[] = [];
	let historyPrompts: HistoryPrompt[] = [];
	let loading = false;

	onMount(() => {
		loadSavedPrompts();
		loadHistory();
	});

	async function loadSavedPrompts() {
		loading = true;
		try {
			const response = await fetch('/api/prompts/saved');
			if (response.ok) {
				const data = await response.json();
				savedPrompts = data.prompts || [];
			}
		} catch (error) {
			console.error('Failed to load saved prompts:', error);
		} finally {
			loading = false;
		}
	}

	async function loadHistory() {
		try {
			const response = await fetch('/api/prompts/history');
			if (response.ok) {
				const data = await response.json();
				historyPrompts = data.history || [];
			}
		} catch (error) {
			console.error('Failed to load prompt history:', error);
		}
	}

	async function deletePrompt(id: string) {
		try {
			const response = await fetch('/api/prompts/saved', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});

			if (response.ok) {
				savedPrompts = savedPrompts.filter(p => p.id !== id);
				toastStore.success('Prompt deleted');
			} else {
				const data = await response.json();
				toastStore.error(data.error || 'Failed to delete prompt');
			}
		} catch (error) {
			toastStore.error('Failed to delete prompt');
		}
	}

	function usePrompt(prompt: SavedPrompt | HistoryPrompt) {
		onUsePrompt(prompt.prompt, prompt.tone || 'casual', prompt.length || 'medium');
	}

	function formatTime(timestamp: number) {
		const now = Date.now();
		const diff = now - timestamp;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return `${days}d ago`;
	}

	function getToneEmoji(tone: string | null) {
		switch (tone) {
			case 'casual': return '😊';
			case 'professional': return '💼';
			case 'funny': return '😄';
			case 'inspirational': return '✨';
			case 'informative': return '📚';
			default: return '💬';
		}
	}

	function getLengthLabel(length: string | null) {
		switch (length) {
			case 'short': return 'Short';
			case 'medium': return 'Medium';
			case 'long': return 'Long';
			default: return 'Medium';
		}
	}

	// Reload when panel opens
	$: if (isOpen) {
		loadSavedPrompts();
		loadHistory();
	}
</script>

{#if isOpen}
	<!-- Backdrop for mobile -->
	<button
		type="button"
		class="fixed inset-0 z-40 bg-black/50 md:hidden"
		on:click={onClose}
		transition:fade={{ duration: 200 }}
		aria-label="Close saved prompts"
	></button>

	<!-- Panel - Side panel on desktop, bottom drawer on mobile -->
	<div
		class="fixed z-50 bg-white dark:bg-gray-800 shadow-2xl
			md:right-0 md:top-0 md:h-full md:w-96
			bottom-0 left-0 right-0 max-h-[80vh] rounded-t-2xl md:rounded-none"
		transition:slide={{ duration: 300, axis: 'y' }}
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-4">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
				Prompts
			</h3>
			<button
				on:click={onClose}
				class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
			>
				<X class="h-5 w-5" />
			</button>
		</div>

		<!-- Tabs -->
		<div class="flex border-b border-gray-200 dark:border-gray-700">
			<button
				on:click={() => activeTab = 'saved'}
				class="flex-1 px-4 py-3 text-sm font-medium transition-colors
					{activeTab === 'saved'
						? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
						: 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'}"
			>
				<div class="flex items-center justify-center gap-2">
					<Bookmark class="h-4 w-4" />
					<span>Saved ({savedPrompts.length})</span>
				</div>
			</button>
			<button
				on:click={() => activeTab = 'history'}
				class="flex-1 px-4 py-3 text-sm font-medium transition-colors
					{activeTab === 'history'
						? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
						: 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'}"
			>
				<div class="flex items-center justify-center gap-2">
					<Clock class="h-4 w-4" />
					<span>History ({historyPrompts.length})</span>
				</div>
			</button>
		</div>

		<!-- Content -->
		<div class="overflow-y-auto p-4" style="max-height: calc(80vh - 120px);">
			{#if loading}
				<div class="flex items-center justify-center py-8">
					<div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
				</div>
			{:else if activeTab === 'saved'}
				{#if savedPrompts.length === 0}
					<div class="py-8 text-center text-gray-500 dark:text-gray-400">
						<Bookmark class="mx-auto mb-2 h-12 w-12 opacity-50" />
						<p class="text-sm">No saved prompts yet</p>
						<p class="mt-1 text-xs">Click "Save Prompt" to save your favorites</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each savedPrompts as prompt (prompt.id)}
							<div
								class="group rounded-lg border border-gray-200 bg-gray-50 p-3 transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
								transition:slide={{ duration: 200 }}
							>
								<p class="mb-2 line-clamp-2 text-sm text-gray-900 dark:text-white">
									{prompt.prompt}
								</p>
								<div class="mb-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
									<span>{getToneEmoji(prompt.tone)} {prompt.tone || 'Casual'}</span>
									<span>•</span>
									<span>📏 {getLengthLabel(prompt.length)}</span>
									<span>•</span>
									<span>🕐 {formatTime(prompt.createdAt)}</span>
								</div>
								<div class="flex gap-2">
									<button
										on:click={() => usePrompt(prompt)}
										class="flex-1 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600"
									>
										Use Prompt
									</button>
									<button
										on:click={() => deletePrompt(prompt.id)}
										class="rounded-md bg-red-500 px-3 py-1.5 text-white transition-colors hover:bg-red-600"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{:else}
				{#if historyPrompts.length === 0}
					<div class="py-8 text-center text-gray-500 dark:text-gray-400">
						<Clock class="mx-auto mb-2 h-12 w-12 opacity-50" />
						<p class="text-sm">No prompt history yet</p>
						<p class="mt-1 text-xs">Your recent prompts will appear here</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each historyPrompts as prompt (prompt.id)}
							<div
								class="group rounded-lg border border-gray-200 bg-gray-50 p-3 transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
								transition:slide={{ duration: 200 }}
							>
								<p class="mb-2 line-clamp-2 text-sm text-gray-900 dark:text-white">
									{prompt.prompt}
								</p>
								<div class="mb-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
									<span>{getToneEmoji(prompt.tone)} {prompt.tone || 'Casual'}</span>
									<span>•</span>
									<span>📏 {getLengthLabel(prompt.length)}</span>
									<span>•</span>
									<span>🕐 {formatTime(prompt.createdAt)}</span>
								</div>
								<button
									on:click={() => usePrompt(prompt)}
									class="w-full rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600"
								>
									Use Prompt
								</button>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
