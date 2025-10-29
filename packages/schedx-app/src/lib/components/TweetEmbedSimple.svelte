<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	export let tweetLink: string = '';
	export let theme: 'light' | 'dark' = 'light';

	let scriptLoaded = false;

	onMount(() => {
		if (!browser) return;

		// Load Twitter widgets script if not already loaded
		if (!document.querySelector('script[src="https://platform.twitter.com/widgets.js"]')) {
			const script = document.createElement('script');
			script.src = 'https://platform.twitter.com/widgets.js';
			script.async = true;
			script.charset = 'utf-8';
			script.onload = () => {
				console.log('[TweetEmbedSimple] Twitter widgets loaded');
				scriptLoaded = true;
				// Force widgets to process any tweets on the page
				if ((window as any).twttr?.widgets) {
					(window as any).twttr.widgets.load();
				}
			};
			document.head.appendChild(script);
		} else {
			scriptLoaded = true;
			// If script already exists, force it to process tweets
			if ((window as any).twttr?.widgets) {
				setTimeout(() => {
					(window as any).twttr.widgets.load();
				}, 100);
			}
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
