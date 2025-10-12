<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import TweetCreate from '$lib/components/TweetCreate.svelte';
	import TweetPreview from '$lib/components/TweetPreview.svelte';
	import { AlertTriangle, CheckCircle, XCircle, FileEdit, Edit, Trash2 } from 'lucide-svelte';
	import logger from '$lib/logger';
	import { invalidateAll } from '$app/navigation';

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
	let showEditDraftModal = false;
	let editingDraft: any = null;

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

			// Clear form content for drafts
			if (action === 'draft') {
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

	function handleEditDraft(draft: any) {
		editingDraft = draft;
		showEditDraftModal = true;
	}

	function handleCloseEditModal() {
		showEditDraftModal = false;
		editingDraft = null;
	}

	async function handleDraftUpdate() {
		showEditDraftModal = false;
		editingDraft = null;
		// Refresh the data
		await invalidateAll();
	}

	async function handleDeleteDraft(draftId: string) {
		if (!confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
			return;
		}

		try {
			const response = await fetch(`/api/tweets/${draftId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete draft');
			}

			submitMessage = 'Draft deleted successfully!';
			submitType = 'success';
			await invalidateAll();

			// Clear message after 3 seconds
			setTimeout(() => {
				submitMessage = '';
			}, 3000);
		} catch (error) {
			submitMessage = 'Failed to delete draft';
			submitType = 'error';

			// Clear message after 5 seconds
			setTimeout(() => {
				submitMessage = '';
			}, 5000);
		}
	}
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
		<div class="mt-8 space-y-4">
			{#each data.drafts as draft (draft.id)}
				{@const account = (data.accounts || []).find((a: any) => a.providerAccountId === draft.twitterAccountId || a.id === draft.twitterAccountId)}
				{#if account}
					<div class="relative rounded-lg border border-gray-200 bg-white shadow transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
						<!-- Action Badges - Top Right -->
						<div class="absolute right-3 top-3 z-10 flex gap-2">
							<button
								type="button"
								on:click={() => handleEditDraft(draft)}
								class="inline-flex items-center gap-2 rounded-full bg-gray-50 px-4 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20 transition-colors hover:bg-gray-100 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/30 dark:hover:bg-gray-500/20"
								title="Edit draft"
							>
								<FileEdit class="h-3.5 w-3.5" />
								<div class="h-3.5 w-px bg-gray-600/20 dark:bg-gray-500/30"></div>
								<Edit class="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								on:click={() => draft.id && handleDeleteDraft(draft.id)}
								class="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-1.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30 dark:hover:bg-red-500/20"
								title="Delete draft"
							>
								<Trash2 class="h-3.5 w-3.5" />
							</button>
						</div>

						<!-- Tweet Preview -->
						<TweetPreview
							avatarUrl={account.profileImage || '/avatar.png'}
							displayName={account.displayName || account.username}
							username={account.username}
							content={draft.content}
							media={draft.media || []}
							createdAt={new Date(draft.createdAt)}
							hideActions={true}
						/>
					</div>
				{/if}
			{/each}
		</div>
	{:else}
		<div class="mt-8 text-center text-gray-500">
			No drafts found. Save a tweet as a draft to see it here.
		</div>
	{/if}

	<!-- Edit Draft Modal -->
	{#if showEditDraftModal && editingDraft}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto overscroll-contain">
			<div class="relative w-full max-w-2xl my-8 rounded-lg bg-white shadow-xl dark:bg-gray-800 max-h-[90vh] flex flex-col overflow-hidden">
				<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700 flex-shrink-0">
					<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Edit Draft</h2>
					<button
						on:click={handleCloseEditModal}
						aria-label="Close edit draft modal"
						class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
					>
						<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<div class="overflow-y-auto overflow-x-hidden overscroll-contain p-6 space-y-6">
					<TweetCreate
						mode="edit"
						tweetId={editingDraft.id}
						initialContent={editingDraft.content}
						initialMedia={editingDraft.media || []}
						accounts={(data.accounts || []).map((a: any) => ({
							...a,
							id: a.id || a.providerAccountId || ''
						}))}
						selectedAccountId={editingDraft.twitterAccountId}
						on:submit={handleDraftUpdate}
					/>
				</div>
			</div>
		</div>
	{/if}
</div>
