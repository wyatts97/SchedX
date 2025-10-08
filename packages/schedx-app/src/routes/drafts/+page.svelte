<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import TweetCreate from '$lib/components/TweetCreate.svelte';
	import TweetPreview from '$lib/components/TweetPreview.svelte';
	import { AlertTriangle, CheckCircle, XCircle } from 'lucide-svelte';
	import logger from '$lib/logger';

	export let data: PageData;

	let selectedAccountId = data.selectedAccountId;
	let tweetContent = '';
	let tweetMedia: { url: string; type: string }[] = [];
	let selectedAccount =
		(data.accounts || []).find((a: any) => a.id === selectedAccountId) ||
		(data.accounts && data.accounts[0]) ||
		null;
	let submitMessage = '';
	let submitType: 'success' | 'error' = 'success';

	function handleAccountChange(e: CustomEvent<string>) {
		const id = e.detail;
		selectedAccount = (data.accounts || []).find((a: any) => a.id === id) || selectedAccount;
	}
	function handleContentInput(e: any) {
		tweetContent = e.detail;
	}
	function handleMediaChange(e: any) {
		tweetMedia = e.detail;
	}

	function handleSubmit(e: any) {
		const { action, success, message, error } = e.detail;

		if (success) {
			submitMessage =
				message || `${action.charAt(0).toUpperCase() + action.slice(1)} saved successfully!`;
			submitType = 'success';

			// Clear form content for drafts and templates
			if (action === 'draft' || action === 'template') {
				tweetContent = '';
				tweetMedia = [];
			}
		} else {
			submitMessage = error || 'Failed to save tweet';
			submitType = 'error';
		}

		// Clear message after 5 seconds
		setTimeout(() => {
			submitMessage = '';
		}, 5000);
	}

	onMount(() => {
		if (browser) {
			const initPreline = () => {
				if (typeof window !== 'undefined' && window.HSStaticMethods) {
					logger.debug('Initializing Drafts page Preline components...');
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
	<title>SchedX - Drafts</title>
	<meta name="description" content="View and manage your tweet drafts" />
</svelte:head>

<div class="mx-auto max-w-5xl">
	<h1 class="mb-6 text-3xl font-bold">Your Drafts</h1>

	<!-- Submit Message -->
	{#if submitMessage}
		<div
			class="mb-4 flex items-center gap-2 rounded-lg p-4 {submitType === 'success'
				? 'border border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200'
				: 'border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'}"
		>
			{#if submitType === 'success'}
				<CheckCircle class="h-5 w-5" />
			{:else}
				<XCircle class="h-5 w-5" />
			{/if}
			<span>{submitMessage}</span>
		</div>
	{/if}

	<div class="flex w-full flex-col gap-8 md:flex-row">
		<div class="flex-1">
			<TweetCreate
				accounts={(data.accounts || []).map((a: any) => ({
					...a,
					id: a.id || a.providerAccountId || ''
				}))}
				{selectedAccountId}
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

	{#if data.drafts && data.drafts.length > 0}
		<div class="mt-8 grid grid-cols-1 gap-4">
			{#each data.drafts as draft (draft.id)}
				<div class="relative">
					<div
						class="mb-4 rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800"
					>
						<div class="p-6">
							<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
								Preview Draft
							</h2>
							<p class="mb-2 text-lg">{draft.content}</p>
							<div class="flex flex-wrap gap-2">
								{#each draft.media || [] as media (media.url)}
									<img src={media.url} alt="Media" class="h-16 w-16 rounded-md object-cover" />
								{/each}
							</div>
							<div class="mt-2 flex gap-2">
								<button
									class="inline-flex items-center justify-center rounded-lg bg-transparent px-3 py-1.5 text-xs font-medium text-gray-700 transition-all duration-200 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
									>Preview</button
								>
								<button
									class="inline-flex items-center justify-center rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all duration-200 hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
									>Edit</button
								>
								<!-- Add buttons for Schedule, Delete as needed -->
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="mt-8 text-center text-gray-500">
			No drafts found. Save a tweet as a draft to see it here.
		</div>
	{/if}
</div>
