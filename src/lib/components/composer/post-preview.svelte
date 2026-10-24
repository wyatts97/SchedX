<script lang="ts">
	import Tweet from '../tweet/tweet.svelte';
	import type { EditorItem } from './types.js';
	import type { TweetAuthor } from '../tweet/types.js';

	let {
		items,
		account,
		at,
		tz
	}: { items: EditorItem[]; account: TweetAuthor | null; at: number | null; tz: string } = $props();

	const tweetItems = $derived(
		items.map((i) => ({
			text: i.text,
			poll: i.poll,
			media: i.media.map((m) => ({ url: m.url, thumbUrl: m.thumbUrl, kind: m.kind, alt: m.alt }))
		}))
	);
	const author = $derived(
		account ?? { displayName: 'Your account', username: 'handle', avatarUrl: null }
	);
</script>

<Tweet {author} items={tweetItems} {at} {tz} showXLogo showActions />
