<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { X, RefreshCw, ArrowRight, Sparkles, Bookmark, BookmarkCheck, Clock } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toastStore';
	import SavedPromptsPanel from './SavedPromptsPanel.svelte';

	// Puter.js type declarations
	type TweetTone = 'casual' | 'professional' | 'funny' | 'inspirational' | 'informative';
	type TweetLength = 'short' | 'medium' | 'long';

	interface PuterAI {
		chat(prompt: string, options?: { model?: string; temperature?: number; max_tokens?: number }): Promise<{
			message: { content: string };
		}>;
	}

	interface Puter {
		ai: PuterAI;
	}

	export let show = false;
	export let currentContent = '';

	const dispatch = createEventDispatcher();

	let prompt = '';
	let tone: TweetTone = 'casual';
	let length: TweetLength = 'medium';
	let generating = false;
	let generatedTweet = '';
	let showResult = false;
	let showSavedPrompts = false;
	let saving = false;
	let isSaved = false;

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
		if (!prompt.trim()) return;

		generating = true;

		// Add to history
		await addToHistory();

		try {
			// Call backend API endpoint that uses local AI
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

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to generate tweet. Please try again.');
			}

			const data = await response.json();
			let generatedText = data.tweet || '';

			if (!generatedText) {
				throw new Error('No text generated. Please try again.');
			}

			// Clean and validate the tweet
			generatedTweet = cleanTweet(generatedText, length);
			showResult = true;
		} catch (error) {
			toastStore.error(error instanceof Error ? error.message : 'Failed to generate tweet');
		} finally {
			generating = false;
		}
	}

	function buildSystemPrompt(tone: TweetTone, length: TweetLength): string {
		const toneInstructions: Record<TweetTone, string> = {
			casual: 'Write in a friendly, conversational tone.',
			professional: 'Write in a polished, professional tone.',
			funny: 'Write with humor and wit.',
			inspirational: 'Write in an uplifting, motivational tone.',
			informative: 'Write in a clear, educational tone.'
		};

		const lengthInstructions: Record<TweetLength, string> = {
			short: 'Keep it concise, around 100 characters.',
			medium: 'Aim for around 180 characters.',
			long: 'Use the full space, around 280 characters.'
		};

		return `You are a social media expert writing tweets for Twitter/X. ${toneInstructions[tone]} ${lengthInstructions[length]}\n\nRules:\n- Write ONLY the tweet text, nothing else\n- Do NOT include hashtags unless specifically requested\n- Do NOT include quotes around the tweet\n- Do NOT include "Tweet:" or similar prefixes\n- Keep it under 280 characters\n- Make it engaging and authentic\n- Use emojis sparingly and only when appropriate`;
	}

	function cleanTweet(text: string, length: TweetLength): string {
		// Remove common prefixes
		let cleaned = text
			.replace(/^(Tweet:|Here's a tweet:|Here's the tweet:)/i, '')
			.trim();

		// Remove surrounding quotes if entire text is quoted
		if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
		    (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
			cleaned = cleaned.slice(1, -1).trim();
		}

		// Truncate if over 280 characters
		if (cleaned.length > 280) {
			const maxLength = length === 'short' ? 100 : length === 'medium' ? 180 : 280;
			cleaned = cleaned.substring(0, maxLength);
			
			// Try to cut at sentence boundary
			const lastPeriod = cleaned.lastIndexOf('.');
			const lastExclamation = cleaned.lastIndexOf('!');
			const lastQuestion = cleaned.lastIndexOf('?');
			const lastSentence = Math.max(lastPeriod, lastExclamation, lastQuestion);
			
			if (lastSentence > maxLength * 0.7) {
				cleaned = cleaned.substring(0, lastSentence + 1);
			}
		}

		// Validate minimum length
		if (cleaned.length < 10) {
			throw new Error('Generated tweet is too short. Please try again.');
		}

		return cleaned;
	}

	function useTweet() {
		dispatch('use', generatedTweet);
		close();
	}

	async function savePrompt() {
		if (!prompt.trim()) return;

		saving = true;
		try {
			const response = await fetch('/api/prompts/saved', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: prompt.trim(), tone, length })
			});

			if (response.ok) {
				isSaved = true;
				toastStore.success('Prompt saved!');
				setTimeout(() => isSaved = false, 2000);
			} else {
				const data = await response.json();
				toastStore.error(data.error || 'Failed to save prompt');
			}
		} catch (error) {
			toastStore.error('Failed to save prompt');
		} finally {
			saving = false;
		}
	}

	async function addToHistory() {
		try {
			await fetch('/api/prompts/history', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: prompt.trim(), tone, length })
			});
		} catch (error) {
			// Silently fail - history is not critical
		}
	}

	function handleUsePrompt(promptText: string, promptTone: string, promptLength: string) {
		prompt = promptText;
		tone = promptTone as TweetTone;
		length = promptLength as TweetLength;
		showSavedPrompts = false;
	}

	function close() {
		show = false;
		prompt = '';
		generatedTweet = '';
		showResult = false;
		showSavedPrompts = false;
		isSaved = false;
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
					<div class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-pink-600 shadow-sm">
						<Sparkles class="h-5 w-5 text-white" />
					</div>
					<h3 id="ai-generator-title" class="text-lg font-semibold text-gray-900 dark:text-white">
						AI Tweet Suggestions
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
							<span class="text-xs opacity-75">Powered by Local AI • ONNX Runtime</span>
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
				<div class="flex gap-2">
					<button
						type="button"
						on:click={close}
						class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
						disabled={generating}
					>
						Cancel
					</button>
					
					{#if !showResult}
						<!-- Past Prompts Toggle -->
						<button
							type="button"
							on:click={() => showSavedPrompts = !showSavedPrompts}
							class="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
							disabled={generating}
						>
							<Clock class="h-4 w-4" />
							Past Prompts
						</button>
					{/if}
				</div>

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
						<!-- Save Prompt Button -->
						<button
							type="button"
							on:click={savePrompt}
							disabled={saving || !prompt.trim() || isSaved}
							class="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50
								{isSaved 
									? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
									: 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}"
						>
							{#if isSaved}
								<BookmarkCheck class="h-4 w-4" />
								Saved!
							{:else}
								<Bookmark class="h-4 w-4" />
								Save Prompt
							{/if}
						</button>
						
						<!-- Generate Button -->
						<button
							type="button"
							on:click={generate}
							disabled={generating || !prompt.trim()}
							class="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if generating}
								<RefreshCw class="h-4 w-4 animate-spin" />
								Generating...
							{:else}
								<Sparkles class="h-4 w-4" />
								Generate
							{/if}
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
	
	<!-- Saved Prompts Panel -->
	<SavedPromptsPanel 
		isOpen={showSavedPrompts} 
		onUsePrompt={handleUsePrompt}
		onClose={() => showSavedPrompts = false}
	/>
{/if}
