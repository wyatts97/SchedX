<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	export let tweetLink: string = '';
	export let theme: 'light' | 'dark' = 'light';

	let containerEl: HTMLElement;
	let scriptLoaded = false;

	onMount(() => {
		if (!browser) return;

		const loadScript = () => {
			// Check if script already exists
			const existingScript = document.querySelector(
				'script[src*="platform.twitter.com/widgets.js"]'
			);

			if (existingScript) {
				scriptLoaded = true;
				// Script exists, just trigger processing
				processWidgets();
				return;
			}

			// Create new script
			const script = document.createElement('script');
			script.src = 'https://platform.twitter.com/widgets.js';
			script.async = true;
			script.charset = 'utf-8';
			
			script.onload = () => {
				scriptLoaded = true;
				processWidgets();
			};

			script.onerror = () => {
				console.error('[TweetEmbedFixed] Failed to load widgets.js');
			};

			document.head.appendChild(script);
		};

		const processWidgets = () => {
			// Wait for twttr to be available
			const checkTwitter = setInterval(() => {
				if ((window as any).twttr?.widgets) {
					clearInterval(checkTwitter);
					
					// Process only this container's blockquotes
					if (containerEl) {
						(window as any).twttr.widgets.load(containerEl);
					}
				}
			}, 100);

			// Timeout after 5 seconds
			setTimeout(() => clearInterval(checkTwitter), 5000);
		};

		loadScript();
	});
</script>

<div bind:this={containerEl} class="tweet-wrapper" data-theme={theme}>
	<blockquote class="twitter-tweet" data-theme={theme} data-conversation="none">
		<a href={`https://twitter.com/${tweetLink}`}>Loading Tweet...</a>
	</blockquote>
</div>

<style>
	.tweet-wrapper {
		display: flex;
		justify-content: center;
		margin-bottom: 12px;
		border-radius: 13px;
		overflow: hidden;
		width: 100%;
	}

	.tweet-wrapper :global(iframe) {
		border-radius: 13px !important;
	}

	.twitter-tweet {
		display: block;
		margin: 0;
		padding: 0;
	}

	.twitter-tweet a {
		color: #1da1f2;
		font-weight: bold;
		text-decoration: none;
	}
</style>
