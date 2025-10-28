<script lang="ts">
	import StatsOverview from '../StatsOverview.svelte';
	import RecentActivity from '../RecentActivity.svelte';
	import type { Tweet } from '$lib/stores/dashboardStore';
	import type { UserAccount, DashboardAnalytics, TwitterApp } from '$lib/types';
	import { createEventDispatcher } from 'svelte';

	export let analytics: DashboardAnalytics;
	export let apps: TwitterApp[] = [];
	export let tweets: Tweet[] = [];
	export let accounts: UserAccount[] = [];

	const dispatch = createEventDispatcher();

	function handleEditTweet(event: CustomEvent) {
		dispatch('editTweet', event.detail);
	}

	function handleDeleteTweet(event: CustomEvent) {
		dispatch('deleteTweet', event.detail);
	}
</script>

<div class="space-y-6">
	<!-- Stats Overview -->
	<StatsOverview {analytics} {apps} />

	<!-- Recent Activity - Full Width -->
	<div class="rounded-lg bg-white shadow dark:bg-gray-800">
		<RecentActivity 
			{tweets} 
			{accounts}
			on:editTweet={handleEditTweet}
			on:deleteTweet={handleDeleteTweet}
		/>
	</div>
</div>
