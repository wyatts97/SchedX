<script lang="ts">
	import { onMount } from 'svelte';
	import { toastStore } from '$lib/stores/toastStore';
	import { Sparkles, Key, CheckCircle, XCircle, Loader2, Eye, EyeOff, ExternalLink } from 'lucide-svelte';

	let loading = true;
	let saving = false;
	let testing = false;
	let showApiKey = false;
	let usageStats: any = null;
	let loadingStats = false;
	let settings = {
		enabled: false,
		apiKey: '',
		defaultModel: 'meta-llama/llama-3.2-3b-instruct:free'
	};

	const availableModels = [
		// Fast & Lightweight (Best for Tweets)
		{ 
			value: 'meta-llama/llama-3.2-3b-instruct:free', 
			label: 'Llama 3.2 3B', 
			description: 'Fast, efficient, optimized for short-form content',
			category: 'fast',
			badge: 'Recommended'
		},
		{ 
			value: 'meta-llama/llama-3.1-8b-instruct:free', 
			label: 'Llama 3.1 8B', 
			description: 'Balanced speed and quality',
			category: 'fast'
		},
		{ 
			value: 'google/gemini-flash-1.5:free', 
			label: 'Gemini 1.5 Flash', 
			description: 'Google\'s fast model, great for creative content',
			category: 'fast'
		},
		
		// Creative & Engaging
		{ 
			value: 'mistralai/mistral-7b-instruct:free', 
			label: 'Mistral 7B', 
			description: 'Creative and witty, good for engaging tweets',
			category: 'creative'
		},
		{ 
			value: 'nousresearch/hermes-3-llama-3.1-405b:free', 
			label: 'Hermes 3 405B', 
			description: 'Highly capable, excellent for professional content',
			category: 'creative',
			badge: 'Most Capable'
		},
		{ 
			value: 'microsoft/phi-3-medium-128k-instruct:free', 
			label: 'Phi-3 Medium', 
			description: 'Microsoft model, good reasoning abilities',
			category: 'creative'
		},
		
		// Specialized
		{ 
			value: 'qwen/qwen-2-7b-instruct:free', 
			label: 'Qwen 2 7B', 
			description: 'Strong multilingual support',
			category: 'specialized'
		},
		{ 
			value: 'openchat/openchat-7b:free', 
			label: 'OpenChat 7B', 
			description: 'Conversational and natural tone',
			category: 'specialized'
		},
		{ 
			value: 'google/gemma-2-9b-it:free', 
			label: 'Gemma 2 9B', 
			description: 'Open model from Google, safe and reliable',
			category: 'specialized'
		}
	];

	const categories = [
		{ id: 'fast', label: '⚡ Fast & Lightweight', description: 'Best for quick tweet generation' },
		{ id: 'creative', label: '✨ Creative & Engaging', description: 'Better quality, slightly slower' },
		{ id: 'specialized', label: '🎯 Specialized', description: 'Unique capabilities' }
	];

	let selectedCategory = 'fast';

	onMount(async () => {
		await loadSettings();
		await loadUsageStats();
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

	async function loadUsageStats() {
		loadingStats = true;
		try {
			const response = await fetch('/api/ai/usage?timeframe=month');
			if (response.ok) {
				const data = await response.json();
				usageStats = data.stats;
			}
		} catch (error) {
			console.error('Failed to load usage stats:', error);
		} finally {
			loadingStats = false;
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
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">AI Model Selection</h3>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Choose the AI model for tweet generation • All models are free with OpenRouter
					</p>
				</div>

				<!-- Category Tabs -->
				<div class="mb-4 flex gap-2 overflow-x-auto pb-2">
					{#each categories as category}
						<button
							type="button"
							on:click={() => selectedCategory = category.id}
							disabled={!settings.enabled}
							class="flex-shrink-0 rounded-lg border px-4 py-2.5 text-left transition-colors disabled:opacity-50 {selectedCategory === category.id
								? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
								: 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'}"
						>
							<div class="text-sm font-semibold {selectedCategory === category.id ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white'}">
								{category.label}
							</div>
							<div class="text-xs {selectedCategory === category.id ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'}">
								{category.description}
							</div>
						</button>
					{/each}
				</div>

				<!-- Models in Selected Category -->
				<div class="space-y-2">
					{#each availableModels.filter(m => m.category === selectedCategory) as model}
						<label
							class="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 transition-all hover:shadow-sm dark:border-gray-700 {settings.defaultModel === model.value 
								? 'border-purple-500 bg-purple-50 shadow-sm dark:border-purple-500 dark:bg-purple-900/20' 
								: 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}"
						>
							<input
								type="radio"
								bind:group={settings.defaultModel}
								value={model.value}
								disabled={!settings.enabled}
								class="mt-1 h-4 w-4 border-gray-300 text-purple-600 focus:ring-purple-500"
							/>
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<span class="font-medium text-gray-900 dark:text-white">{model.label}</span>
									{#if model.badge}
										<span class="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
											{model.badge}
										</span>
									{/if}
									<span class="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
										FREE
									</span>
								</div>
								<div class="mt-1 text-sm text-gray-600 dark:text-gray-400">{model.description}</div>
							</div>
						</label>
					{/each}
				</div>

				<!-- Info Banner -->
				<div class="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
					<strong>💡 Tip:</strong> Start with Llama 3.2 3B for fast results. Try different models to find your preferred style.
				</div>
			</div>
			
			<!-- Usage Statistics -->
			{#if usageStats}
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
					<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Usage Statistics (Last 30 Days)</h3>
					
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<!-- Total Requests -->
						<div class="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
							<div class="text-sm font-medium text-purple-600 dark:text-purple-400">Total Generations</div>
							<div class="mt-1 text-2xl font-bold text-purple-900 dark:text-purple-100">{usageStats.totalRequests}</div>
						</div>
						
						<!-- Success Rate -->
						<div class="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
							<div class="text-sm font-medium text-green-600 dark:text-green-400">Success Rate</div>
							<div class="mt-1 text-2xl font-bold text-green-900 dark:text-green-100">
								{usageStats.totalRequests > 0 ? Math.round((usageStats.successfulRequests / usageStats.totalRequests) * 100) : 0}%
							</div>
						</div>
						
						<!-- Cached Requests -->
						<div class="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
							<div class="text-sm font-medium text-blue-600 dark:text-blue-400">Cached Results</div>
							<div class="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-100">{usageStats.cachedRequests}</div>
							<div class="text-xs text-blue-600 dark:text-blue-400">⚡ Instant responses</div>
						</div>
						
						<!-- Total Tokens -->
						<div class="rounded-lg bg-orange-50 p-4 dark:bg-orange-900/20">
							<div class="text-sm font-medium text-orange-600 dark:text-orange-400">Cost Savings</div>
							<div class="mt-1 text-2xl font-bold text-orange-900 dark:text-orange-100">100%</div>
							<div class="text-xs text-orange-600 dark:text-orange-400">All models free</div>
						</div>
					</div>
					
					<!-- Model Breakdown -->
					{#if Object.keys(usageStats.byModel).length > 0}
						<div class="mt-4">
							<h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Usage by Model</h4>
							<div class="space-y-2">
								{#each Object.entries(usageStats.byModel) as [model, count]}
									<div class="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm dark:bg-gray-700">
										<span class="font-mono text-xs text-gray-600 dark:text-gray-400">{model}</span>
										<span class="font-semibold text-gray-900 dark:text-white">{count} requests</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

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
