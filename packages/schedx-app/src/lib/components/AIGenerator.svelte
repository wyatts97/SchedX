<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { X, RefreshCw, ArrowRight } from 'lucide-svelte';
	import GrokIcon from '$lib/components/icons/GrokIcon.svelte';
	import { toastStore } from '$lib/stores/toastStore';

	export let show = false;
	export let currentContent = '';

	const dispatch = createEventDispatcher();

	let prompt = '';
	let tone: 'casual' | 'professional' | 'funny' | 'inspirational' | 'informative' = 'casual';
	let length: 'short' | 'medium' | 'long' = 'medium';
	let generating = false;
	let generatedTweet = '';
	let showResult = false;

	const toneOptions = [
		{ value: 'casual', label: 'Casual', emoji: '💬' },
		{ value: 'professional', label: 'Professional', emoji: '💼' },
		{ value: 'funny', label: 'Funny', emoji: '😄' },
		{ value: 'inspirational', label: 'Inspirational', emoji: '✨' },
		{ value: 'informative', label: 'Informative', emoji: '📚' }
	];

	const lengthOptions = [
		{ value: 'short', label: 'Short', desc: '~100 chars' },
		{ value: 'medium', label: 'Medium', desc: '~180 chars' },
		{ value: 'long', label: 'Long', desc: '~280 chars' }
	];

	async function generate() {
		if (!prompt.trim()) {
			toastStore.error('Prompt Required', 'Please describe what you want to tweet about');
			return;
		}

		generating = true;
		generatedTweet = '';
		showResult = false;

		try {
			const response = await fetch('/api/ai/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					prompt: prompt.trim(),
					tone,
					length,
					context: currentContent || undefined
				})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to generate tweet');
			}

			generatedTweet = data.tweet;
			showResult = true;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to generate tweet';
			toastStore.error('Generation Failed', errorMessage);
		} finally {
			generating = false;
		}
	}

	function useTweet() {
		dispatch('use', generatedTweet);
		close();
	}

	function close() {
		show = false;
		prompt = '';
		generatedTweet = '';
		showResult = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			close();
		} else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			generate();
		}
	}
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
		on:click={close}
		on:keydown={handleKeydown}
		role="presentation"
	>
		<div
			class="w-full max-w-lg rounded-lg bg-white shadow-xl dark:bg-gray-800"
			on:click|stopPropagation
			on:keydown|stopPropagation
			role="dialog"
			aria-modal="true"
			aria-labelledby="ai-generator-title"
			tabindex="-1"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
			>
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-full bg-black dark:bg-white">
						<GrokIcon size={18} className="text-white dark:text-black" />
					</div>
					<h3 id="ai-generator-title" class="text-lg font-semibold text-gray-900 dark:text-white">
						Grok AI Tweet Generator
					</h3>
				</div>
				<button
					type="button"
					on:click={close}
					class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
					aria-label="Close"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="p-6">
				{#if !showResult}
					<!-- Input Form -->
					<div class="space-y-4">
						<!-- Prompt Input -->
						<div>
							<label
								for="ai-prompt"
								class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
							>
								What should the tweet be about?
							</label>
							<textarea
								id="ai-prompt"
								bind:value={prompt}
								placeholder="E.g., Share tips about productivity, announce a new feature, celebrate a milestone..."
								rows="3"
								class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
								disabled={generating}
							></textarea>
						</div>

						<!-- Tone Selection -->
						<div>
							<div class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
								Tone
							</div>
							<div class="flex flex-wrap gap-2">
								{#each toneOptions as option}
									<button
										type="button"
										on:click={() => (tone = option.value as typeof tone)}
										class="rounded-lg border px-3 py-2 text-sm transition-colors {tone === option.value
											? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
											: 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500'}"
										disabled={generating}
									>
										<span class="mr-1">{option.emoji}</span>
										{option.label}
									</button>
								{/each}
							</div>
						</div>

						<!-- Length Selection -->
						<div>
							<div class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
								Length
							</div>
							<div class="flex gap-2">
								{#each lengthOptions as option}
									<button
										type="button"
										on:click={() => (length = option.value as typeof length)}
										class="flex-1 rounded-lg border px-3 py-2 text-sm transition-colors {length ===
										option.value
											? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
											: 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500'}"
										disabled={generating}
									>
										<div class="font-medium">{option.label}</div>
										<div class="text-xs opacity-70">{option.desc}</div>
									</button>
								{/each}
							</div>
						</div>

						<!-- Info Banner -->
						<div class="rounded-lg bg-purple-50 p-3 text-sm text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
							<strong>💡 Tip:</strong> Be specific! The more details you provide, the better the result.
							<br/>
							<span class="text-xs opacity-75">Powered by Grok AI via Puter.js • Free & Fast</span>
						</div>
					</div>
				{:else}
					<!-- Generated Result -->
					<div class="space-y-4">
						<div>
							<div class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
								Generated Tweet
							</div>
							<div
								class="rounded-lg border border-gray-300 bg-gray-50 p-4 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
							>
								<p class="whitespace-pre-wrap">{generatedTweet}</p>
								<div class="mt-2 text-right text-xs text-gray-500 dark:text-gray-400">
									{generatedTweet.length} / 280 characters
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700"
			>
				<button
					type="button"
					on:click={close}
					class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
					disabled={generating}
				>
					Cancel
				</button>

				<div class="flex gap-2">
					{#if showResult}
						<button
							type="button"
							on:click={() => (showResult = false)}
							class="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
						>
							<RefreshCw class="h-4 w-4" />
							Try Again
						</button>
						<button
							type="button"
							on:click={useTweet}
							class="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
						>
							Use Tweet
							<ArrowRight class="h-4 w-4" />
						</button>
					{:else}
						<button
							type="button"
							on:click={generate}
							disabled={generating || !prompt.trim()}
							class="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
						>
							{#if generating}
								<RefreshCw class="h-4 w-4 animate-spin" />
								Generating...
							{:else}
								<GrokIcon size={16} />
								Generate
							{/if}
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
