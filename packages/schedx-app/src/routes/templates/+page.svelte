<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
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

	// Template filtering and search
	let selectedCategory = '';
	let searchQuery = '';

	// Computed filtered templates
	$: filteredTemplates = (data.templates || []).filter((template) => {
		// Check if template has category field, otherwise default to 'general'
		const templateCategory = (template as any).templateCategory || 'general';
		const matchesCategory = !selectedCategory || templateCategory === selectedCategory;
		const matchesSearch =
			!searchQuery ||
			template.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(template.templateName &&
				template.templateName.toLowerCase().includes(searchQuery.toLowerCase()));
		return matchesCategory && matchesSearch;
	});

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

	function handleAccountChangeNav(accountId: string) {
		const url = new URL(window.location.href);
		url.searchParams.set('twitterAccountId', accountId);
		window.location.href = url.toString();
	}

	async function useTemplate(template: any) {
		// Redirect to /post with template fields as query params
		const params = new URLSearchParams({
			content: template.content,
			community: template.community || '',
			recurrenceType: template.recurrenceType || '',
			recurrenceInterval: template.recurrenceInterval ? String(template.recurrenceInterval) : '',
			recurrenceEndDate: template.recurrenceEndDate
				? new Date(template.recurrenceEndDate).toISOString().slice(0, 10)
				: ''
		});
		goto(`/post?${params.toString()}`);
	}

	async function deleteTemplate(templateId: any) {
		await fetch('/templates/delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ templateId })
		});
		location.reload();
	}

	function editTemplate(template: any) {
		// For now, just redirect to post page with template data
		// In the future, this could open an edit modal
		useTemplate(template);
	}

	function duplicateTemplate(template: any) {
		// Create a copy of the template with a new name
		const duplicatedTemplate = {
			...template,
			templateName: `${template.templateName || 'Untitled Template'} (Copy)`,
			content: template.content
		};
		useTemplate(duplicatedTemplate);
	}

	onMount(() => {
		if (browser) {
			const initPreline = () => {
				if (typeof window !== 'undefined' && window.HSStaticMethods) {
					logger.debug('Initializing Templates page Preline components...');
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
	<title>SchedX - Templates</title>
	<meta name="description" content="View and manage your tweet templates" />
</svelte:head>

<div class="mx-auto max-w-5xl">
	<h1 class="mb-6 text-3xl font-bold">Your Templates</h1>

	<!-- Submit Message with Preline Alert Styling -->
	{#if submitMessage}
		<div
			class="mb-4 flex items-center gap-2 rounded-lg border p-4 {submitType === 'success'
				? 'theme-lightsout:border-green-800 theme-lightsout:bg-green-900/30 theme-lightsout:text-green-200 border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200'
				: 'theme-lightsout:border-red-800 theme-lightsout:bg-red-900/30 theme-lightsout:text-red-200 border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'}"
		>
			{#if submitType === 'success'}
				<CheckCircle class="h-5 w-5" />
			{:else}
				<XCircle class="h-5 w-5" />
			{/if}
			<span class="text-sm font-medium">{submitMessage}</span>
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
				initialContent={''}
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

	{#if data.templates && data.templates.length > 0}
		<div class="mt-8">
			<!-- Template Header with Preline Styling -->
			<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h2 class="theme-lightsout:text-white text-xl font-semibold text-gray-900 dark:text-white">
					Your Templates ({data.templates.length})
				</h2>
				<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
					<!-- Category Filter Dropdown -->
					<div class="hs-dropdown relative inline-flex [--placement:bottom-left]">
						<button
							type="button"
							class="hs-dropdown-toggle focus:outline-hidden theme-lightsout:border-gray-700 theme-lightsout:bg-gray-800 theme-lightsout:text-white theme-lightsout:hover:bg-gray-700 inline-flex items-center gap-x-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
						>
							{selectedCategory || 'All Categories'}
							<svg
								class="size-4"
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="m6 9 6 6 6-6" />
							</svg>
						</button>

						<div
							class="hs-dropdown-menu duration hs-dropdown-open:opacity-100 theme-lightsout:bg-gray-900 theme-lightsout:border-gray-800 mt-2 hidden min-w-48 rounded-lg bg-white opacity-0 shadow-md transition-[opacity,margin] dark:divide-gray-700 dark:border dark:border-gray-700 dark:bg-gray-800"
						>
							<div class="p-1">
								<button
									class="focus:outline-hidden theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-800 theme-lightsout:hover:text-white flex w-full items-center gap-x-3.5 rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 dark:focus:bg-gray-700 dark:focus:text-gray-300"
									on:click={() => (selectedCategory = '')}
								>
									All Categories
								</button>
								<button
									class="focus:outline-hidden theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-800 theme-lightsout:hover:text-white flex w-full items-center gap-x-3.5 rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 dark:focus:bg-gray-700 dark:focus:text-gray-300"
									on:click={() => (selectedCategory = 'promotional')}
								>
									Promotional
								</button>
								<button
									class="focus:outline-hidden theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-800 theme-lightsout:hover:text-white flex w-full items-center gap-x-3.5 rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 dark:focus:bg-gray-700 dark:focus:text-gray-300"
									on:click={() => (selectedCategory = 'educational')}
								>
									Educational
								</button>
								<button
									class="focus:outline-hidden theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-800 theme-lightsout:hover:text-white flex w-full items-center gap-x-3.5 rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 dark:focus:bg-gray-700 dark:focus:text-gray-300"
									on:click={() => (selectedCategory = 'news')}
								>
									News
								</button>
								<button
									class="focus:outline-hidden theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-800 theme-lightsout:hover:text-white flex w-full items-center gap-x-3.5 rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 dark:focus:bg-gray-700 dark:focus:text-gray-300"
									on:click={() => (selectedCategory = 'engagement')}
								>
									Engagement
								</button>
								<button
									class="focus:outline-hidden theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-800 theme-lightsout:hover:text-white flex w-full items-center gap-x-3.5 rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 dark:focus:bg-gray-700 dark:focus:text-gray-300"
									on:click={() => (selectedCategory = 'product')}
								>
									Product
								</button>
								<button
									class="focus:outline-hidden theme-lightsout:text-gray-300 theme-lightsout:hover:bg-gray-800 theme-lightsout:hover:text-white flex w-full items-center gap-x-3.5 rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 dark:focus:bg-gray-700 dark:focus:text-gray-300"
									on:click={() => (selectedCategory = 'general')}
								>
									General
								</button>
							</div>
						</div>
					</div>

					<!-- Search Input -->
					<div class="relative">
						<input
							type="text"
							placeholder="Search templates..."
							bind:value={searchQuery}
							class="theme-lightsout:border-gray-700 theme-lightsout:bg-gray-800 theme-lightsout:text-white theme-lightsout:placeholder-gray-500 block w-full rounded-lg border border-gray-300 px-3 py-2 pl-10 text-sm placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
						/>
						<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
							<svg
								class="size-4 text-gray-400"
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="11" cy="11" r="8" />
								<path d="m21 21-4.35-4.35" />
							</svg>
						</div>
					</div>
				</div>
			</div>

			<!-- Templates Grid with Preline Card Styling -->
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredTemplates as template (template.id)}
					<div
						class="theme-lightsout:border-gray-800/50 theme-lightsout:bg-gray-900/80 group relative rounded-xl border border-gray-200/50 bg-white/80 p-6 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-lg dark:border-gray-700/50 dark:bg-gray-800/80"
					>
						<!-- Template Header -->
						<div class="mb-4 flex items-start justify-between">
							<div class="flex-1">
								<h3 class="theme-lightsout:text-white font-semibold text-gray-900 dark:text-white">
									{template.templateName || 'Untitled Template'}
								</h3>
								{#if (template as any).templateCategory}
									<span
										class="theme-lightsout:bg-blue-900/30 theme-lightsout:text-blue-200 inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
									>
										{(template as any).templateCategory}
									</span>
								{/if}
							</div>
							<div class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
								<button
									class="theme-lightsout:hover:bg-gray-800 theme-lightsout:hover:text-blue-300 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-500 dark:hover:bg-gray-700 dark:hover:text-blue-400"
									on:click={() => editTemplate(template)}
									title="Edit template"
								>
									<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
										/>
									</svg>
								</button>
								<button
									class="theme-lightsout:hover:bg-gray-800 theme-lightsout:hover:text-red-300 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-700 dark:hover:text-red-400"
									on:click={() => deleteTemplate(template.id)}
									title="Delete template"
								>
									<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							</div>
						</div>

						<!-- Template Content -->
						<div class="mb-4">
							<p
								class="theme-lightsout:text-gray-200 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300"
							>
								{template.content}
							</p>
						</div>

						<!-- Template Media Preview -->
						{#if template.media && template.media.length > 0}
							<div class="mb-4">
								<div class="flex gap-2">
									{#each template.media.slice(0, 3) as media}
										{#if media.type === 'photo' || media.type === 'gif'}
											<img
												src={media.url}
												alt="Template media"
												class="theme-lightsout:border-gray-700 h-12 w-12 rounded-lg border border-gray-200 object-cover dark:border-gray-600"
											/>
										{:else if media.type === 'video'}
											<div
												class="theme-lightsout:bg-gray-800 theme-lightsout:border-gray-700 flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700"
											>
												<svg
													class="theme-lightsout:text-gray-300 h-6 w-6 text-gray-500 dark:text-gray-400"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
											</div>
										{/if}
									{/each}
									{#if template.media.length > 3}
										<div
											class="theme-lightsout:bg-gray-800 theme-lightsout:text-gray-300 theme-lightsout:border-gray-700 flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-gray-100 text-xs font-medium text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
										>
											+{template.media.length - 3}
										</div>
									{/if}
								</div>
							</div>
						{/if}

						<!-- Template Metadata -->
						<div
							class="theme-lightsout:text-gray-500 mb-4 text-xs text-gray-500 dark:text-gray-400"
						>
							<div class="flex items-center justify-between">
								<span>Created: {new Date(template.createdAt).toLocaleDateString()}</span>
								{#if template.twitterAccountId}
									<span>Account: {template.twitterAccountId}</span>
								{/if}
							</div>
						</div>

						<!-- Template Actions with Preline Button Styling -->
						<div class="flex gap-2">
							<button
								class="focus:outline-hidden theme-lightsout:bg-blue-600 theme-lightsout:hover:bg-blue-700 inline-flex flex-1 items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:focus:ring-offset-gray-800"
								on:click={() => useTemplate(template)}
							>
								Use Template
							</button>
							<button
								class="focus:outline-hidden theme-lightsout:border-gray-700 theme-lightsout:bg-gray-800 theme-lightsout:text-white theme-lightsout:hover:bg-gray-700 inline-flex items-center justify-center gap-x-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
								on:click={() => duplicateTemplate(template)}
								title="Duplicate template"
							>
								<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="mt-8 text-center">
			<div
				class="theme-lightsout:text-gray-600 mx-auto mb-4 h-16 w-16 text-gray-400 dark:text-gray-500"
			>
				<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
			</div>
			<h3 class="theme-lightsout:text-white mb-2 text-lg font-medium text-gray-900 dark:text-white">
				No templates found
			</h3>
			<p class="theme-lightsout:text-gray-500 text-gray-500 dark:text-gray-400">
				Save a tweet as a template to see it here.
			</p>
		</div>
	{/if}
</div>
