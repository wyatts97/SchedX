<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { Plus, X, GripVertical, Image as ImageIcon, Smile } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toastStore';
	import FileUpload from '$lib/components/FileUpload.svelte';

	const dispatch = createEventDispatcher();

	export let selectedAccountId: string | null = null;
	export let maxTweets = 25; // Twitter's thread limit

	interface ThreadTweet {
		content: string;
		media: { url: string; type: string }[];
		position: number;
	}

	let tweets: ThreadTweet[] = [
		{ content: '', media: [], position: 1 },
		{ content: '', media: [], position: 2 }
	];

	let autoNumbering = true;
	let numberingStyle: '1/5' | '(1/5)' | '[1/5]' | '1.' = '1/5';
	let showEmojiPicker: { [key: number]: boolean } = {};
	let textareaRefs: { [key: number]: HTMLTextAreaElement } = {};

	$: totalTweets = tweets.length;

	onMount(async () => {
		if (typeof window !== 'undefined') {
			await import('emoji-picker-element');
		}
	});

	function handleEmojiSelect(index: number, event: any) {
		const emoji = event.detail.unicode;
		if (textareaRefs[index]) {
			const textarea = textareaRefs[index];
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const text = tweets[index].content;
			tweets[index].content = text.substring(0, start) + emoji + text.substring(end);
			showEmojiPicker[index] = false;
			
			// Restore cursor position
			setTimeout(() => {
				textarea.focus();
				textarea.setSelectionRange(start + emoji.length, start + emoji.length);
			}, 0);
		}
	}

	function toggleEmojiPicker(index: number) {
		showEmojiPicker[index] = !showEmojiPicker[index];
		showEmojiPicker = { ...showEmojiPicker }; // Trigger reactivity
	}

	function addTweet() {
		if (tweets.length >= maxTweets) {
			toastStore.error('Limit Reached', `Maximum ${maxTweets} tweets per thread`);
			return;
		}
		tweets = [...tweets, { content: '', media: [], position: tweets.length + 1 }];
	}

	function removeTweet(index: number) {
		if (tweets.length <= 2) {
			toastStore.error('Minimum Required', 'Thread must have at least 2 tweets');
			return;
		}
		tweets = tweets.filter((_, i) => i !== index).map((t, i) => ({ ...t, position: i + 1 }));
	}

	function getNumbering(position: number): string {
		if (!autoNumbering) return '';
		
		switch (numberingStyle) {
			case '1/5':
				return `${position}/${totalTweets} `;
			case '(1/5)':
				return `(${position}/${totalTweets}) `;
			case '[1/5]':
				return `[${position}/${totalTweets}] `;
			case '1.':
				return `${position}. `;
			default:
				return '';
		}
	}

	function getContentWithNumbering(tweet: ThreadTweet): string {
		return getNumbering(tweet.position) + tweet.content;
	}

	function handleMediaChange(index: number, event: CustomEvent) {
		tweets[index].media = event.detail;
		tweets = [...tweets]; // Trigger reactivity
	}

	function getCharCount(tweet: ThreadTweet): number {
		return getContentWithNumbering(tweet).length;
	}

	function validateThread(): boolean {
		// Check if all tweets have content
		for (let i = 0; i < tweets.length; i++) {
			const content = getContentWithNumbering(tweets[i]);
			if (!content.trim()) {
				toastStore.error('Empty Tweet', `Tweet ${i + 1} cannot be empty`);
				return false;
			}
			if (content.length > 280) {
				toastStore.error('Too Long', `Tweet ${i + 1} exceeds 280 characters`);
				return false;
			}
		}
		return true;
	}

	export function getThreadData() {
		if (!validateThread()) return null;
		
		return {
			tweets: tweets.map(t => ({
				content: getContentWithNumbering(t),
				media: t.media,
				position: t.position
			}))
		};
	}
</script>

<div class="space-y-4">
	<!-- Thread Settings -->
	<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						bind:checked={autoNumbering}
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-numbering</span>
				</label>
				
				{#if autoNumbering}
					<select
						bind:value={numberingStyle}
						class="rounded-lg border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
					>
						<option value="1/5">1/5 Style</option>
						<option value="(1/5)">(1/5) Style</option>
						<option value="[1/5]">[1/5] Style</option>
						<option value="1.">1. Style</option>
					</select>
				{/if}
			</div>
			
			<span class="text-sm text-gray-500 dark:text-gray-400">
				{totalTweets} / {maxTweets} tweets
			</span>
		</div>
	</div>

	<!-- Thread Tweets -->
	<div class="space-y-3">
		{#each tweets as tweet, index (tweet.position)}
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div class="mb-2 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<GripVertical class="h-4 w-4 text-gray-400" />
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Tweet {index + 1}
						</span>
						{#if autoNumbering}
							<span class="text-xs text-gray-500 dark:text-gray-400">
								(will show as: {getNumbering(tweet.position).trim()})
							</span>
						{/if}
					</div>
					
					<div class="flex items-center gap-2">
						<span
							class="text-sm {getCharCount(tweet) > 280
								? 'text-red-600'
								: getCharCount(tweet) > 260
									? 'text-yellow-600'
									: 'text-gray-500'}"
						>
							{getCharCount(tweet)}/280
						</span>
						{#if tweets.length > 2}
							<button
								on:click={() => removeTweet(index)}
								class="rounded-lg p-1 text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
								title="Remove tweet"
							>
								<X class="h-4 w-4" />
							</button>
						{/if}
					</div>
				</div>

				<div class="relative">
					<textarea
						bind:this={textareaRefs[index]}
						bind:value={tweet.content}
						placeholder="What's happening?"
						rows="3"
						maxlength="280"
						class="block w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
					></textarea>
					<button
						type="button"
						class="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
						on:click={() => toggleEmojiPicker(index)}
						title="Add emoji"
					>
						<Smile class="h-4 w-4" />
					</button>
					{#if showEmojiPicker[index]}
						<div class="absolute right-0 top-full z-50 mt-2">
							<emoji-picker on:emoji-click={(e: any) => handleEmojiSelect(index, e)}></emoji-picker>
						</div>
					{/if}
				</div>

				<!-- Media Upload for this tweet -->
				<div class="mt-2">
					<FileUpload
						on:changeMedia={(e) => handleMediaChange(index, e)}
						{selectedAccountId}
						maxFiles={4}
					/>
				</div>
			</div>
		{/each}
	</div>

	<!-- Add Tweet Button -->
	{#if tweets.length < maxTweets}
		<button
			on:click={addTweet}
			class="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 transition-all duration-200 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
		>
			<Plus class="h-4 w-4" />
			Add Tweet to Thread
		</button>
	{/if}
</div>
