<script lang="ts">
	import { onMount } from 'svelte';
	import { toastStore } from '$lib/stores/toastStore';
	import { Sparkles, Key, CheckCircle, XCircle, Loader2, Eye, EyeOff, ExternalLink } from 'lucide-svelte';

	let loading = true;
	let saving = false;
	let testing = false;
	let showApiKey = false;
	let settings = {
		enabled: false,
		apiKey: '',
		defaultModel: 'meta-llama/llama-4-scout:free'
	};

	const availableModels = [
		{ value: 'meta-llama/llama-4-scout:free', label: 'Llama 4 Scout (Recommended)', description: 'Fast, efficient, great for tweets' },
		{ value: 'meta-llama/llama-4-maverick:free', label: 'Llama 4 Maverick', description: 'More capable, slightly slower' },
		{ value: 'openrouter/optimus-alpha', label: 'Optimus Alpha', description: 'OpenRouter optimized, very fast' },
		{ value: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small 3.1', description: 'Balanced performance' },
		{ value: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek Chat V3', description: 'Good for creative content' }
	];

	onMount(async () => {
		await loadSettings();
	});

	async function loadSettings() {
		loading = true;
		try {
			const response = await fetch('/api/admin/openrouter');
			if (!response.ok) {
				if (response.status === 404) {
					// No settings yet, use defaults
					loading = false;
					return;
				}
				throw new Error('Failed to load settings');
			}
			const data = await response.json();
			settings = data.settings;
		} catch (error) {
			toastStore.error('Failed to load OpenRouter settings');
		} finally {
			loading = false;
		}
	}

	async function saveSettings() {
		// Validate API key if enabled
		if (settings.enabled && !settings.apiKey.trim()) {
			toastStore.error('API key is required when OpenRouter is enabled');
			return;
		}

		if (settings.enabled && !settings.apiKey.startsWith('sk-or-')) {
			toastStore.error('Invalid API key format. OpenRouter keys start with "sk-or-"');
			return;
		}

		saving = true;
		try {
			const response = await fetch('/api/admin/openrouter', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(settings)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to save settings');
			}

			toastStore.success('OpenRouter settings saved successfully');
		} catch (error) {
			toastStore.error(error instanceof Error ? error.message : 'Failed to save settings');
		} finally {
			saving = false;
		}
	}

	async function testConnection() {
		if (!settings.apiKey.trim()) {
			toastStore.error('Please enter an API key first');
			return;
		}

		testing = true;
		try {
			const response = await fetch('/api/admin/openrouter/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKey: settings.apiKey, model: settings.defaultModel })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Connection test failed');
			}

			toastStore.success('Connection test successful!');
		} catch (error) {
			toastStore.error(error instanceof Error ? error.message : 'Connection test failed');
		} finally {
			testing = false;
		}
	}
</script>

<svelte:head>
	<title>OpenRouter AI - SchedX Admin</title>
</svelte:head>

<div class="mx-auto max-w-4xl p-6">
	<div class="mb-8">
		<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-white">OpenRouter AI Settings</h1>
		<p class="text-gray-600 dark:text-gray-400">
			Configure OpenRouter API for AI-powered tweet suggestions
		</p>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-gray-400" />
		</div>
	{:else}
		<div class="space-y-6">
			<!-- Enable/Disable Toggle -->
			<div
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="flex items-start justify-between">
					<div class="flex items-start space-x-4">
						<div
							class="flex h-12 w-12 items-center justify-center rounded-lg {settings.enabled
								? 'bg-purple-100 dark:bg-purple-900/20'
								: 'bg-gray-100 dark:bg-gray-700'}"
						>
							{#if settings.enabled}
								<Sparkles class="h-6 w-6 text-purple-600 dark:text-purple-400" />
							{:else}
								<Sparkles class="h-6 w-6 text-gray-400" />
							{/if}
						</div>
						<div>
							<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
								AI Tweet Suggestions
							</h3>
							<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
								Enable AI-powered tweet generation using OpenRouter
							</p>
						</div>
					</div>
					<label class="relative inline-flex cursor-pointer items-center">
						<input
							type="checkbox"
							bind:checked={settings.enabled}
							class="peer sr-only"
						/>
						<div
							class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-purple-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-purple-800"
						></div>
					</label>
				</div>
			</div>

			<!-- API Key Configuration -->
			<div
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="mb-4 flex items-center justify-between">
					<div class="flex items-center space-x-3">
						<Key class="h-5 w-5 text-gray-400" />
						<h3 class="text-lg font-semibold text-gray-900 dark:text-white">API Key</h3>
					</div>
					<a
						href="https://openrouter.ai/keys"
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400"
					>
						Get API Key
						<ExternalLink class="h-4 w-4" />
					</a>
				</div>

				<div class="space-y-4">
					<div>
						<label for="apiKey" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							OpenRouter API Key
						</label>
						<div class="relative">
							<input
								id="apiKey"
								type={showApiKey ? 'text' : 'password'}
								bind:value={settings.apiKey}
								placeholder="sk-or-v1-..."
								class="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 pr-10 text-gray-900 focus:border-purple-500 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
								disabled={!settings.enabled}
							/>
							<button
								type="button"
								on:click={() => (showApiKey = !showApiKey)}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
								disabled={!settings.enabled}
							>
								{#if showApiKey}
									<EyeOff class="h-5 w-5" />
								{:else}
									<Eye class="h-5 w-5" />
								{/if}
							</button>
						</div>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Your API key is encrypted and stored securely in the database
						</p>
					</div>

					<button
						type="button"
						on:click={testConnection}
						disabled={!settings.enabled || !settings.apiKey.trim() || testing}
						class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
					>
						{#if testing}
							<Loader2 class="h-4 w-4 animate-spin" />
							Testing...
						{:else}
							<CheckCircle class="h-4 w-4" />
							Test Connection
						{/if}
					</button>
				</div>
			</div>

			<!-- Model Selection -->
			<div
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="mb-4">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Default Model</h3>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Choose the AI model for tweet generation
					</p>
				</div>

				<div class="space-y-2">
					{#each availableModels as model}
						<label
							class="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50 {settings.defaultModel === model.value ? 'border-purple-500 bg-purple-50 dark:border-purple-500 dark:bg-purple-900/20' : ''}"
						>
							<input
								type="radio"
								bind:group={settings.defaultModel}
								value={model.value}
								disabled={!settings.enabled}
								class="mt-1 h-4 w-4 border-gray-300 text-purple-600 focus:ring-purple-500"
							/>
							<div class="flex-1">
								<div class="font-medium text-gray-900 dark:text-white">{model.label}</div>
								<div class="text-sm text-gray-600 dark:text-gray-400">{model.description}</div>
							</div>
						</label>
					{/each}
				</div>
			</div>

			<!-- Save Button -->
			<div class="flex justify-end gap-3">
				<button
					type="button"
					on:click={saveSettings}
					disabled={saving}
					class="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if saving}
						<Loader2 class="h-4 w-4 animate-spin" />
						Saving...
					{:else}
						<CheckCircle class="h-4 w-4" />
						Save Settings
					{/if}
				</button>
			</div>
		</div>
	{/if}
</div>
