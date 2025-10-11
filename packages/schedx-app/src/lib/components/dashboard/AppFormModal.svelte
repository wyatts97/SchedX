<script lang="ts">
	import { onMount } from 'svelte';
	import { dashboardStore, type TwitterApp } from '$lib/stores/dashboardStore';
	import { API } from '$lib/api';
	import { goto } from '$app/navigation';

	export let editingApp: TwitterApp | null;

	let appForm: Partial<TwitterApp> = {};
	let appError = '';
	let appSuccess = '';
	let savingApp = false;

	onMount(() => {
		if (editingApp) {
			appForm = { ...editingApp };
		} else {
			appForm = {
				name: '',
				clientId: '',
				clientSecret: '',
				consumerKey: '',
				consumerSecret: '',
				accessToken: '',
				accessTokenSecret: '',
				callbackUrl: ''
			};
		}
	});

	function validateAppForm() {
		if (!appForm.name?.trim()) {
			appError = 'App name is required';
			return false;
		}

		if (!appForm.clientId?.trim()) {
			appError = 'Client ID is required';
			return false;
		}

		if (!appForm.clientSecret?.trim()) {
			appError = 'Client Secret is required';
			return false;
		}

		if (!appForm.callbackUrl?.trim()) {
			appError = 'Callback URL is required';
			return false;
		}

		try {
			const url = new URL(appForm.callbackUrl);
			if (!url.protocol.startsWith('http')) {
				appError = 'Callback URL must use HTTP or HTTPS protocol';
				return false;
			}
		} catch {
			appError = 'Invalid callback URL format';
			return false;
		}

		if (!appForm.consumerKey?.trim()) {
			appError = 'Consumer Key (API Key) is required for media uploads';
			return false;
		}

		if (!appForm.consumerSecret?.trim()) {
			appError = 'Consumer Secret (API Secret) is required for media uploads';
			return false;
		}

		if (!appForm.accessToken?.trim()) {
			appError = 'Access Token is required for media uploads';
			return false;
		}

		if (!appForm.accessTokenSecret?.trim()) {
			appError = 'Access Token Secret is required for media uploads';
			return false;
		}

		return true;
	}

	async function saveApp() {
		if (!validateAppForm()) {
			return;
		}

		savingApp = true;
		appError = '';
		appSuccess = '';

		try {
			const url = editingApp && editingApp.id ? API.TWITTER_APP_BY_ID(editingApp.id) : API.TWITTER_APPS;
			const method = editingApp ? 'PUT' : 'POST';

			const dataToSend = editingApp ? { ...appForm, id: editingApp.id } : appForm;

			const response = await fetch(url, {
				method,
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(dataToSend)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to save Twitter app');
			}

			const result = await response.json();

			if (!editingApp && result.app?.id) {
				window.location.href = `${API.AUTH_SIGNIN_TWITTER}?twitterAppId=${result.app.id}`;
				return;
			}

			appSuccess = editingApp
				? 'Twitter app updated successfully!'
				: 'Twitter app created successfully!';

			if (editingApp) {
				// Update existing app in store
				dashboardStore.update((state) => ({
					...state,
					data: {
						...state.data,
						apps: state.data.apps.map((app: TwitterApp) => (app.id === editingApp.id ? result.app : app))
					}
				}));
				
				// Close modal after update
				setTimeout(() => {
					dashboardStore.closeAppForm();
				}, 800);
			} else {
				// Add new app to store
				dashboardStore.update((state) => ({
					...state,
					data: {
						...state.data,
						apps: [...state.data.apps, result.app]
					}
				}));
				
				// Close modal and redirect to accounts for new apps
				setTimeout(() => {
					dashboardStore.closeAppForm();
					goto('/accounts');
				}, 800);
			}
		} catch (error) {
			appError = error instanceof Error ? error.message : 'Failed to save Twitter app';
		} finally {
			savingApp = false;
		}
	}
</script>

<div class="fixed inset-0 z-50 overflow-y-auto">
	<div
		class="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0"
	>
		<div
			class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
			on:click={() => dashboardStore.closeAppForm()}
			on:keydown={(e) => e.key === 'Enter' && dashboardStore.closeAppForm()}
			role="presentation"
		></div>
		<div
			class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all dark:bg-gray-800 sm:my-8 sm:w-full sm:max-w-lg sm:align-middle"
			role="dialog"
			aria-modal="true"
			aria-labelledby="app-form-modal-title"
		>
			<div class="bg-white px-4 pb-4 pt-5 dark:bg-gray-800 sm:p-6 sm:pb-4">
				<h3 id="app-form-modal-title" class="mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-white">
					{editingApp ? 'Edit Twitter App' : 'Add Twitter App'}
				</h3>

				{#if appError}
					<div
						class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
					>
						{appError}
					</div>
				{/if}

				{#if appSuccess}
					<div
						class="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200"
					>
						{appSuccess}
					</div>
				{/if}

				<form on:submit|preventDefault={saveApp} class="space-y-4">
					<div>
						<label for="appName" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>App Name</label
						>
						<input
							id="appName"
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
							bind:value={appForm.name}
							required
							placeholder="My Twitter App"
						/>
					</div>

					<!-- OAuth 2.0 Section -->
					<div class="border-t border-gray-200 pt-4 dark:border-gray-700">
						<h4 class="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
							OAuth 2.0 Credentials (Required)
						</h4>
						<p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
							Used for user authentication and basic tweet posting.
						</p>

						<div class="space-y-4">
							<div>
								<label
									for="clientId"
									class="block text-sm font-medium text-gray-700 dark:text-gray-300"
									>Client ID</label
								>
								<input
									id="clientId"
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
									bind:value={appForm.clientId}
									required
									placeholder="Your Twitter Client ID"
								/>
							</div>

							<div>
								<label
									for="clientSecret"
									class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>
									Client Secret</label
								>
								<input
									id="clientSecret"
									type="password"
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
									bind:value={appForm.clientSecret}
									required
									placeholder="Your Twitter Client Secret"
								/>
							</div>

							<div>
								<label
									for="callbackUrl"
									class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>
									Callback URL</label
								>
								<input
									id="callbackUrl"
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
									bind:value={appForm.callbackUrl}
									required
									placeholder="http://localhost:5173/api/auth/signin/twitter"
								/>
								<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
									Must match your Twitter app's callback URL
								</p>
							</div>
						</div>
					</div>

					<!-- OAuth 1.0a Section -->
					<div class="border-t border-gray-200 pt-4 dark:border-gray-700">
						<h4 class="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
							OAuth 1.0a Credentials (Required for Media Uploads)
						</h4>
						<p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
							Required for uploading images and videos with tweets. Get these from your Twitter
							Developer Portal.
						</p>

						<div class="space-y-4">
							<div>
								<label
									for="consumerKey"
									class="block text-sm font-medium text-gray-700 dark:text-gray-300"
									>Consumer Key (API Key)</label
								>
								<input
									id="consumerKey"
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
									bind:value={appForm.consumerKey}
									required
									placeholder="Your Twitter API Key"
								/>
								<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
									Usually the same as your Client ID
								</p>
							</div>

							<div>
								<label
									for="consumerSecret"
									class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>
									Consumer Secret (API Secret)</label
								>
								<input
									id="consumerSecret"
									type="password"
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
									bind:value={appForm.consumerSecret}
									required
									placeholder="Your Twitter API Secret"
								/>
								<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
									Usually the same as your Client Secret
								</p>
							</div>

							<div>
								<label
									for="accessToken"
									class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>
									Access Token</label
								>
								<input
									id="accessToken"
									type="password"
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
									bind:value={appForm.accessToken}
									required
									placeholder="Your OAuth 1.0a Access Token"
								/>
								<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
									Generate this in your Twitter Developer Portal
								</p>
							</div>

							<div>
								<label
									for="accessTokenSecret"
									class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>
									Access Token Secret</label
								>
								<input
									id="accessTokenSecret"
									type="password"
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
									bind:value={appForm.accessTokenSecret}
									required
									placeholder="Your OAuth 1.0a Access Token Secret"
								/>
								<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
									Generate this in your Twitter Developer Portal
								</p>
							</div>

							<!-- Help Section -->
							<div class="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
								<h5 class="mb-2 text-sm font-medium text-blue-800 dark:text-blue-200">
									How to get these credentials:
								</h5>
								<ol class="space-y-1 text-xs text-blue-700 dark:text-blue-300">
									<li>1. Go to the Twitter Developer Portal and create a new Twitter App</li>
									<li>
										2. Go to the "Keys and tokens" tab and generate your Client ID and Client Secret
									</li>
									<li>3. Go to the "Authentication settings" tab and set your Callback URL</li>
									<li>
										4. Go to the "Permissions" tab and make sure you have the "Read and write"
										permission
									</li>
									<li>
										5. Go to the "Keys and tokens" tab and generate your OAuth 1.0a credentials
										(Access Token and Access Token Secret)
									</li>
									<li>
										6. <strong>Important:</strong> OAuth 1.0a credentials are required for media uploads
									</li>
								</ol>
							</div>
						</div>
					</div>

					<div class="bg-gray-50 px-4 py-3 dark:bg-gray-700 sm:flex sm:flex-row-reverse sm:px-6">
						<button
							type="submit"
							class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 sm:ml-3 sm:w-auto"
							disabled={savingApp}
						>
							{savingApp ? 'Saving...' : 'Save'}
						</button>
						<button
							type="button"
							class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500 sm:mt-0 sm:w-auto"
							on:click={() => dashboardStore.closeAppForm()}
						>
							Cancel
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
</div>