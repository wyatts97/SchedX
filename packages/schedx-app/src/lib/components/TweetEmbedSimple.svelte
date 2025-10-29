<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	export let tweetLink: string = '';
	export let theme: 'light' | 'dark' = 'light';

	let scriptLoaded = false;

	onMount(() => {
		if (!browser) {
			console.error('[TweetEmbedSimple] Not in browser environment');
			return;
		}

		console.log('[TweetEmbedSimple] Component mounted for tweet:', tweetLink);

		// Load Twitter widgets script if not already loaded
		const existingScript = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
		
		if (!existingScript) {
			console.log('[TweetEmbedSimple] Creating new widgets.js script tag');
			const script = document.createElement('script');
			script.src = 'https://platform.twitter.com/widgets.js';
			script.async = true;
			script.charset = 'utf-8';
			script.onload = () => {
				console.log('[TweetEmbedSimple] Twitter widgets loaded successfully');
				scriptLoaded = true;
				// Wait a bit then force widgets to process any tweets on the page
				setTimeout(() => {
					if ((window as any).twttr?.widgets) {
						console.log('[TweetEmbedSimple] Calling twttr.widgets.load()');
						(window as any).twttr.widgets.load();
					} else {
						console.error('[TweetEmbedSimple] twttr.widgets not available after load');
					}
				}, 500);
			};
			script.onerror = (error) => {
				console.error('[TweetEmbedSimple] Failed to load Twitter widgets script:', error);
			};
			document.head.appendChild(script);
			console.log('[TweetEmbedSimple] Script tag appended to head');
		} else {
			console.log('[TweetEmbedSimple] Widgets script already exists');
			scriptLoaded = true;
			// If script already exists, force it to process tweets
			setTimeout(() => {
				if ((window as any).twttr?.widgets) {
					console.log('[TweetEmbedSimple] Calling twttr.widgets.load() on existing script');
					(window as any).twttr.widgets.load();
				} else {
					console.error('[TweetEmbedSimple] twttr.widgets not available on existing script');
				}
			}, 500);
		}
	});
</script>

<!-- Use Twitter's standard blockquote method - more reliable than createTweet() -->
<div class="tweet-wrapper">
	<blockquote 
		class="twitter-tweet" 
		data-theme={theme}
		data-conversation="none"
		data-cards="visible"
		data-dnt="true"
	>
		<a href={`https://twitter.com/${tweetLink}`}>
			{#if scriptLoaded}
				Loading Tweet...
			{:else}
				Loading...
			{/if}
		</a>
	</blockquote>
</div>

<style>
	.tweet-wrapper {
		display: flex;
		justify-content: center;
		width: 100%;
		min-height: 200px;
	}

	.twitter-tweet {
		margin: 0 auto !important;
	}
</style>
