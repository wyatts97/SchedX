<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import TweetCreate from '$lib/components/TweetCreate.svelte';
	import TweetPreview from '$lib/components/TweetPreview.svelte';
	import { CheckCircle, XCircle } from 'lucide-svelte';
	import logger from '$lib/logger';

	export let data: PageData;

	let selectedAccountId = data.accounts && data.accounts.length > 0 ? data.accounts[0]?.id : '';
	let tweetContent = '';
	let tweetMedia: { url: string; type: string }[] = [];
	let selectedAccount = data.accounts && data.accounts.length > 0 ? data.accounts[0] : null;

	function handleAccountChange(e: CustomEvent<string>) {
		const id = e.detail;
		selectedAccount = data.accounts.find((a: any) => a.id === id) || selectedAccount;
	}
	function handleContentInput(e: any) {
		tweetContent = e.detail;
	}
	function handleMediaChange(e: any) {
		logger.debug('Post page received media change:', e.detail);
		tweetMedia = e.detail;
		logger.debug('Post page tweetMedia updated to:', tweetMedia);
	}

	function handleSubmit(e: any) {
		const { action, success } = e.detail;

		// Clear form content for drafts and templates on success
		if (success && (action === 'draft' || action === 'template')) {
			tweetContent = '';
			tweetMedia = [];
		}
		// Toast notifications are handled in TweetCreate component
	}

	onMount(() => {
		if (browser) {
			const initPreline = () => {
				if (typeof window !== 'undefined' && window.HSStaticMethods) {
					logger.debug('Initializing Preline components...');
					window.HSStaticMethods.autoInit();
				}
			};
			setTimeout(initPreline, 100);
			setTimeout(initPreline, 500);
			setTimeout(initPreline, 1000);
		}
	});
</script>

<svelte:head>
	<title>SchedX - Post</title>
	<meta name="description" content="Create and schedule a new tweet" />
</svelte:head>
<div class="mx-auto max-w-5xl">
	<h1 class="theme-dark:text-white mb-6 text-3xl font-bold text-gray-900 dark:text-white">
		Schedule a Tweet
	</h1>

	<div class="flex w-full flex-col gap-8 md:flex-row">
		<div class="flex-1">
			<TweetCreate
				accounts={data.accounts}
				selectedAccountId={selectedAccountId}
				on:accountChange={handleAccountChange}
				on:contentInput={handleContentInput}
				on:changeMedia={handleMediaChange}
				on:submit={handleSubmit}
			/>
		</div>
		<div class="flex flex-1 items-start justify-center">
			<TweetPreview
				avatarUrl={selectedAccount?.profileImage || '/avatar.png'}
				displayName={selectedAccount?.displayName || selectedAccount?.username || 'Your Account'}
				username={selectedAccount?.username || 'username'}
				content={tweetContent}
				media={tweetMedia}
				createdAt={new Date()}
			/>
		</div>
	</div>
</div>
