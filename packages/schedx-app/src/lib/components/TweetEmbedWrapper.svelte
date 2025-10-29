<script lang="ts">
	import { Tweet } from 'sveltekit-embed';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	export let tweetLink: string = '';
	export let theme: 'light' | 'dark' = 'light';

	let containerEl: HTMLElement;
	let isLoading = true;
	let hasError = false;
	let isReady = false;

	onMount(() => {
		if (!browser || !tweetLink) {
			hasError = true;
			isLoading = false;
			return;
		}

		// Mark as ready immediately so Tweet component renders
		isReady = true;

		// Wait for sveltekit-embed's Tweet to load widgets.js, then process
		const processInterval = setInterval(() => {
			if ((window as any).twttr?.widgets && containerEl) {
				clearInterval(processInterval);
				
				// Call the missing twttr.widgets.load() that sveltekit-embed doesn't call
				(window as any).twttr.widgets.load(containerEl);
				
				// Hide loading after tweets render
				setTimeout(() => {
					isLoading = false;
				}, 2000);
			}
		}, 100);

		// Timeout if it takes too long
		setTimeout(() => {
			clearInterval(processInterval);
			if (isLoading) {
				hasError = true;
				isLoading = false;
			}
		}, 5000);
	});
</script>

<div class="tweet-embed-container">
	{#if isLoading && !hasError}
		<div class="tweet-loading">
			<div class="loading-spinner"></div>
			<a
				href={`https://twitter.com/${tweetLink}`}
				target="_blank"
				rel="noopener noreferrer"
				class="tweet-link"
			>
				Loading Tweet...
			</a>
		</div>
	{:else if hasError}
		<div class="tweet-error">
			<svg class="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<p class="error-text">Failed to load tweet</p>
			<a
				href={`https://twitter.com/${tweetLink}`}
				target="_blank"
				rel="noopener noreferrer"
				class="tweet-link"
			>
				View on Twitter/X
			</a>
		</div>
	{/if}
	
	{#if isReady}
		<div bind:this={containerEl} class="tweet-container">
			<Tweet {tweetLink} {theme} />
		</div>
	{/if}
</div>

<style>
	.tweet-embed-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		min-height: 200px;
	}

	.tweet-container {
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.tweet-loading,
	.tweet-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2rem;
		text-align: center;
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		background: #f9fafb;
		width: 100%;
		max-width: 550px;
	}

	:global(.dark) .tweet-loading,
	:global(.dark) .tweet-error {
		background: #1f2937;
		border-color: #374151;
		color: #e5e7eb;
	}

	.loading-spinner {
		width: 2rem;
		height: 2rem;
		border: 3px solid #e5e7eb;
		border-top-color: #1da1f2;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	:global(.dark) .loading-spinner {
		border-color: #374151;
		border-top-color: #1da1f2;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-icon {
		width: 2.5rem;
		height: 2.5rem;
		color: #ef4444;
	}

	.error-text {
		font-weight: 500;
		color: #6b7280;
	}

	:global(.dark) .error-text {
		color: #9ca3af;
	}

	.tweet-link {
		color: #1da1f2;
		text-decoration: none;
		font-weight: 500;
		font-size: 0.875rem;
	}

	.tweet-link:hover {
		text-decoration: underline;
	}
</style>
