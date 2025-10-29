<script lang="ts">
	import PublishedTweets from '../tweets/PublishedTweets.svelte';
	import ScheduledTweets from '../tweets/ScheduledTweets.svelte';
	import type { Tweet } from '$lib/stores/dashboardStore';
	import type { UserAccount } from '$lib/types';
	import { createEventDispatcher } from 'svelte';

	export let tweets: Tweet[] = [];
	export let accounts: UserAccount[] = [];
	
	// Debug logging
	$: console.log('TweetsTab - Received tweets:', tweets.length, tweets);
	$: console.log('TweetsTab - Received accounts:', accounts.length, accounts);

	const dispatch = createEventDispatcher();

	function handleEditTweet(event: CustomEvent) {
		dispatch('editTweet', event.detail);
	}

	function handleDeleteTweet(event: CustomEvent) {
		dispatch('deleteTweet', event.detail);
	}
</script>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
	<!-- Published Tweets (Left) -->
	<PublishedTweets {tweets} {accounts} />

	<!-- Scheduled Tweets (Right) -->
	<ScheduledTweets 
		{tweets} 
		{accounts} 
		on:editTweet={handleEditTweet}
		on:deleteTweet={handleDeleteTweet}
	/>
</div>
