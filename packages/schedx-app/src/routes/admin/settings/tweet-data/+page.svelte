<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { ArrowLeft, Database, AlertCircle, CheckCircle, Trash2, Eye, EyeOff } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let loading = true;
	let hasApiKey = false;
	let apiKeyInput = '';
	let showApiKey = false;
	let saving = false;
	let testing = false;
	let deleting = false;

	onMount(async () => {
		if (browser) {
			const initPreline = () => {
				if (typeof window !== 'undefined' && window.HSStaticMethods) {
					window.HSStaticMethods.autoInit();
				}
			};
			setTimeout(initPreline, 100);
			setTimeout(initPreline, 500);
		}

		await checkApiKeyStatus();
	});

	async function checkApiKeyStatus() {
		loading = true;
		try {
			const res = await fetch('/api/twitter/cookie');
			if (res.ok) {
				const data = await res.json();
				hasApiKey = data.hasCookie; // API still returns 'hasCookie' for backward compatibility
			}
		} catch (error) {
			console.error('Failed to check API key status:', error);
			toast.error('Failed to load API key status');
		} finally {
			loading = false;
		}
	}

	async function saveApiKey() {
		if (!apiKeyInput.trim()) {
			toast.error('Please enter a Rettiwt API key');
			return;
		}

		saving = true;
		try {
			const res = await fetch('/api/twitter/cookie', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cookie: apiKeyInput })
			});

			const data = await res.json();

			if (res.ok) {
				toast.success('Rettiwt API key saved successfully');
				hasApiKey = true;
				apiKeyInput = '';
				showApiKey = false;
			} else {
				toast.error(data.message || 'Failed to save API key');
			}
		} catch (error) {
			console.error('Failed to save API key:', error);
			toast.error('Failed to save API key');
		} finally {
			saving = false;
		}
	}

	async function deleteApiKey() {
		if (!confirm('Are you sure you want to remove your Rettiwt API key? This will disable enhanced analytics access.')) {
			return;
		}

		deleting = true;
		try {
			const res = await fetch('/api/twitter/cookie', {
				method: 'DELETE'
			});

			if (res.ok) {
				toast.success('Rettiwt API key removed successfully');
				hasApiKey = false;
				apiKeyInput = '';
			} else {
				toast.error('Failed to remove API key');
			}
		} catch (error) {
			console.error('Failed to remove API key:', error);
			toast.error('Failed to remove API key');
		} finally {
			deleting = false;
		}
	}

	function toggleShowApiKey() {
		showApiKey = !showApiKey;
	}
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<a
				href="/admin/settings"
				class="mb-4 inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
			>
				<ArrowLeft class="mr-2 h-4 w-4" />
				Back to Settings
			</a>
			<div class="flex items-center gap-3">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/20"
				>
					<Database class="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
				</div>
				<div>
					<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Tweet Data Settings</h1>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Configure optional Twitter cookie for enhanced analytics
					</p>
				</div>
			</div>
		</div>

		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
			</div>
		{:else}
			<!-- Information Card -->
			<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
				<div class="flex gap-3">
					<AlertCircle class="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
					<div class="flex-1">
						<h3 class="text-sm font-medium text-blue-900 dark:text-blue-300">
							What is this feature?
						</h3>
						<div class="mt-2 text-sm text-blue-800 dark:text-blue-400">
							<p class="mb-2">
								By default, Rettiwt-API fetches public Twitter data without authentication. This works for most analytics needs.
							</p>
							<p class="mb-2">
								<strong>Optional Enhancement:</strong> If you add your Twitter/X API Key (generated from your cookies), the app can access:
							</p>
							<ul class="ml-4 list-disc space-y-1">
								<li>Adult-marked or age-restricted tweets</li>
								<li>Private account data (if you follow them)</li>
								<li>More detailed analytics</li>
							</ul>
							<p class="mt-2">
								<strong>Security:</strong> Your API Key is encrypted with AES-256-GCM before storage and never shared with third parties.
							</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Status Card -->
			<div class="mb-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
				<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Current Status</h2>
				<div class="flex items-center gap-3">
					{#if hasApiKey}
						<CheckCircle class="h-6 w-6 text-green-500" />
						<div>
							<p class="font-medium text-gray-900 dark:text-white">API Key Configured</p>
							<p class="text-xs text-gray-700 dark:text-gray-300">
								Engagement data is automatically pulled once per day at your scheduled time using Rettiwt-API. No Twitter Developer account required.
							</p>
						</div>
					{:else}
						<AlertCircle class="h-6 w-6 text-gray-400" />
						<div>
							<p class="font-medium text-gray-900 dark:text-white">No API Key Configured</p>
							<p class="text-sm text-gray-500 dark:text-gray-400">
								Using public API access only
							</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- API Key Management Card -->
			<div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
				<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
					{hasApiKey ? 'Update API Key' : 'Add API Key'}
				</h2>

				<!-- Instructions -->
				<div class="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
					<h3 class="mb-2 text-sm font-medium text-gray-900 dark:text-white">
						How to get your Twitter API Key:
					</h3>
					<div class="space-y-3 text-sm text-gray-700 dark:text-gray-300">
						<p class="font-medium">Option 1: Using Browser Extension (Recommended)</p>
						<ol class="ml-4 list-decimal space-y-1">
							<li><strong>Chrome/Edge:</strong> Install <a href="https://chromewebstore.google.com/detail/x-auth-helper/bkdmompkbkdenlcmjjbhfhndmjdkdlkl" target="_blank" class="text-blue-600 hover:underline dark:text-blue-400">X Auth Helper</a></li>
							<li><strong>Firefox:</strong> Install <a href="https://addons.mozilla.org/en-US/firefox/addon/rettiwt-auth-helper/" target="_blank" class="text-blue-600 hover:underline dark:text-blue-400">Rettiwt Auth Helper</a></li>
							<li>Open Twitter/X in incognito/private mode and log in</li>
							<li>Click the extension icon and click "Get Key" / "Get API Key"</li>
							<li>Copy the generated API Key and paste it below</li>
						</ol>
						<p class="mt-3 text-xs text-gray-600 dark:text-gray-400">
							💡 The API Key is a base64-encoded version of your Twitter cookies and will remain valid for 5 years or until you change your password.
						</p>
					</div>
				</div>

				<!-- API Key Input Form -->
				<form on:submit|preventDefault={saveApiKey} class="space-y-4">
					<div>
						<label for="cookie" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Twitter API Key
						</label>
						<div class="relative">
							<input
								id="apikey"
								type={showApiKey ? 'text' : 'password'}
								bind:value={apiKeyInput}
								placeholder="Paste your Twitter API Key here (from browser extension)"
								class="block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-12 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
								required
							/>
							<button
								type="button"
								on:click={toggleShowApiKey}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
							>
								{#if showApiKey}
									<EyeOff class="h-5 w-5" />
								{:else}
									<Eye class="h-5 w-5" />
								{/if}
							</button>
						</div>
						<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
							Your API Key will be encrypted before storage
						</p>
					</div>

					<div class="flex gap-3">
						<button
							type="submit"
							disabled={saving || !apiKeyInput.trim()}
							class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{#if saving}
								<div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
								Saving...
							{:else}
								Save API Key
							{/if}
						</button>

						{#if hasApiKey}
							<button
								type="button"
								on:click={deleteApiKey}
								disabled={deleting}
								class="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-3 text-sm font-medium text-red-600 shadow-sm transition-all duration-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:border-red-800 dark:bg-gray-700 dark:text-red-400 dark:hover:bg-gray-600"
							>
								{#if deleting}
									<div class="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
									Removing...
								{:else}
									<Trash2 class="h-4 w-4" />
									Remove API Key
								{/if}
							</button>
						{/if}
					</div>
				</form>
			</div>

			<!-- Security Notice -->
			<div class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
				<h3 class="mb-2 text-sm font-medium text-gray-900 dark:text-white">
					🔒 Security & Privacy
				</h3>
				<ul class="space-y-1 text-sm text-gray-700 dark:text-gray-300">
					<li>• API keys are encrypted with AES-256-GCM encryption</li>
					<li>• Stored securely in your database with a dedicated encryption key</li>
					<li>• Never transmitted to third parties</li>
					<li>• Only used for Rettiwt-API requests on your behalf</li>
					<li>• Can be removed at any time</li>
				</ul>
			</div>
		{/if}
	</div>
</div>
