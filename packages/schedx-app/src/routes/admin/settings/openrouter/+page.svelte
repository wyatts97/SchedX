<script lang="ts">
  import { onMount } from 'svelte';
  import { toastStore } from '$lib/stores/toastStore';
  import { Sparkles, CheckCircle, Loader2, Key, Settings, Zap, Search, X } from 'lucide-svelte';

  let loading = true;
  let saving = false;
  let testing = false;
  let loadingModels = false;
  let showModelSearch = false;
  let modelSearch = '';
  let settings = {
    enabled: false,
    apiKey: '',
    model: 'openai/gpt-3.5-turbo',
    temperature: 0.8,
    maxTokens: 150
  };

  interface OpenRouterModel {
    id: string;
    name: string;
    description?: string;
    context_length?: number;
    pricing?: {
      prompt: string;
      completion: string;
    };
  }

  let allModels: OpenRouterModel[] = [];
  let filteredModels: OpenRouterModel[] = [];

  const popularModels = [
    { value: 'openai/gpt-3.5-turbo', label: 'GPT-3.5 Turbo', desc: 'Fast and affordable' },
    { value: 'openai/gpt-4', label: 'GPT-4', desc: 'Most capable' },
    { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku', desc: 'Fast and intelligent' },
    { value: 'anthropic/claude-3-sonnet', label: 'Claude 3 Sonnet', desc: 'Balanced performance' },
    { value: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 8B', desc: 'Open source, fast' },
    { value: 'google/gemini-pro', label: 'Gemini Pro', desc: 'Google\'s latest' }
  ];

  onMount(async () => {
    await loadSettings();
    await loadModels();
  });

  async function loadSettings() {
    loading = true;
    try {
      const response = await fetch('/api/admin/openrouter');
      if (response.ok) {
        const data = await response.json();
        settings = data.settings;
      } else {
        const error = await response.json();
        console.error('Failed to load settings:', error);
        toastStore.error(error.details || error.error || 'Failed to load OpenRouter settings');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toastStore.error('Failed to load OpenRouter settings');
    } finally {
      loading = false;
    }
  }

  async function loadModels() {
    loadingModels = true;
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (response.ok) {
        const data = await response.json();
        allModels = data.data || [];
        filteredModels = allModels;
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      // Don't show error toast, just fail silently
    } finally {
      loadingModels = false;
    }
  }

  function filterModels() {
    const search = modelSearch.toLowerCase();
    if (!search) {
      filteredModels = allModels;
      return;
    }
    filteredModels = allModels.filter(model => 
      model.id.toLowerCase().includes(search) || 
      model.name.toLowerCase().includes(search) ||
      model.description?.toLowerCase().includes(search)
    );
  }

  function selectModel(modelId: string) {
    settings.model = modelId;
    showModelSearch = false;
    modelSearch = '';
  }

  function getModelDisplayName(modelId: string): string {
    const model = allModels.find(m => m.id === modelId);
    return model?.name || modelId;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.model-search-container')) {
      showModelSearch = false;
    }
  }

  $: if (modelSearch !== undefined) filterModels();

  async function saveSettings() {
    if (settings.enabled && !settings.apiKey) {
      toastStore.error('API key is required when OpenRouter is enabled');
      return;
    }

    if (settings.enabled && !settings.apiKey.startsWith('sk-or-')) {
      toastStore.error('Invalid API key format. OpenRouter keys start with sk-or-');
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
        console.error('Failed to save settings:', error);
        throw new Error(error.details || error.error || 'Failed to save settings');
      }
      
      toastStore.success('OpenRouter settings saved successfully');
    } catch (error) {
      console.error('Save settings error:', error);
      toastStore.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      saving = false;
    }
  }

  async function testConnection() {
    if (!settings.apiKey) {
      toastStore.error('Please enter an API key first');
      return;
    }

    // Save settings first before testing
    if (!settings.enabled) {
      toastStore.error('Please enable and save OpenRouter settings first');
      return;
    }

    testing = true;
    try {
      // Test by making a simple generation request
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'test',
          tone: 'casual',
          length: 'short'
        })
      });

      if (response.ok) {
        toastStore.success('Connection successful! OpenRouter is working.');
      } else {
        const error = await response.json();
        console.error('Connection test failed:', error);
        throw new Error(error.details || error.error || 'Connection test failed');
      }
    } catch (error) {
      console.error('Test connection error:', error);
      toastStore.error(error instanceof Error ? error.message : 'Connection test failed');
    } finally {
      testing = false;
    }
  }
</script>

<svelte:head>
  <title>OpenRouter AI Settings</title>
</svelte:head>

<svelte:window on:click={handleClickOutside} />

<div class="mx-auto max-w-4xl">
  <div class="mb-6">
    <a href="/admin/settings" class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
      ← Back to Settings
    </a>
  </div>

  <div class="mb-6">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">OpenRouter AI</h1>
    <p class="mt-2 text-gray-600 dark:text-gray-400">
      Configure OpenRouter API for AI-powered tweet generation
    </p>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-blue-600" />
    </div>
  {:else}
    <div class="space-y-6">
      <!-- Info Banner -->
      <div class="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <div class="flex items-start gap-3">
          <Sparkles class="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div class="text-sm text-blue-800 dark:text-blue-300">
            <p class="font-medium">What is OpenRouter?</p>
            <p class="mt-1">
              OpenRouter provides unified access to multiple AI models (GPT-4, Claude, Llama, etc.) through a single API.
              Get your API key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" class="underline">openrouter.ai/keys</a>
            </p>
          </div>
        </div>
      </div>

      <!-- Settings Form -->
      <div class="rounded-lg bg-white shadow dark:bg-gray-800">
        <div class="px-6 py-5">
          <form on:submit|preventDefault={saveSettings} class="space-y-6">
            <!-- Enable Toggle -->
            <div class="flex items-center justify-between">
              <div>
                <label for="enabled" class="text-base font-medium text-gray-900 dark:text-white">
                  Enable OpenRouter
                </label>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Use OpenRouter for AI tweet generation
                </p>
              </div>
              <label class="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  id="enabled"
                  bind:checked={settings.enabled}
                  class="peer sr-only"
                />
                <div
                  class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"
                ></div>
              </label>
            </div>

            {#if settings.enabled}
              <!-- API Key -->
              <div>
                <label for="apiKey" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <div class="flex items-center gap-2">
                    <Key class="h-4 w-4" />
                    API Key
                  </div>
                </label>
                <input
                  id="apiKey"
                  type="password"
                  bind:value={settings.apiKey}
                  placeholder="sk-or-v1-..."
                  required={settings.enabled}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Your OpenRouter API key (starts with sk-or-)
                </p>
              </div>

              <!-- Model Selection -->
              <div>
                <label for="model" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <div class="flex items-center gap-2">
                    <Settings class="h-4 w-4" />
                    AI Model
                  </div>
                </label>
                
                <!-- Current Model Display -->
                <div class="mt-1 relative model-search-container">
                  <button
                    type="button"
                    on:click={() => showModelSearch = !showModelSearch}
                    class="w-full flex items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                  >
                    <span class="block truncate">{getModelDisplayName(settings.model)}</span>
                    <Search class="h-4 w-4 text-gray-400" />
                  </button>

                  <!-- Model Search Dropdown -->
                  {#if showModelSearch}
                    <div class="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <!-- Search Input -->
                      <div class="p-2 border-b border-gray-200 dark:border-gray-700">
                        <div class="relative">
                          <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            bind:value={modelSearch}
                            placeholder="Search models..."
                            class="w-full rounded-md border-gray-300 pl-9 pr-9 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            on:click|stopPropagation
                          />
                          {#if modelSearch}
                            <button
                              type="button"
                              on:click={() => modelSearch = ''}
                              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              <X class="h-4 w-4" />
                            </button>
                          {/if}
                        </div>
                      </div>

                      <!-- Popular Models -->
                      {#if !modelSearch}
                        <div class="p-2 border-b border-gray-200 dark:border-gray-700">
                          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">
                            Popular Models
                          </div>
                          {#each popularModels as model}
                            <button
                              type="button"
                              on:click={() => selectModel(model.value)}
                              class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md {settings.model === model.value ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}"
                            >
                              <div class="font-medium">{model.label}</div>
                              <div class="text-xs text-gray-500 dark:text-gray-400">{model.desc}</div>
                            </button>
                          {/each}
                        </div>
                      {/if}

                      <!-- All Models List -->
                      <div class="max-h-64 overflow-y-auto p-2">
                        {#if loadingModels}
                          <div class="flex items-center justify-center py-4">
                            <Loader2 class="h-5 w-5 animate-spin text-gray-400" />
                          </div>
                        {:else if filteredModels.length === 0}
                          <div class="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            No models found
                          </div>
                        {:else}
                          {#if modelSearch}
                            <div class="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 mb-1">
                              {filteredModels.length} model{filteredModels.length !== 1 ? 's' : ''} found
                            </div>
                          {/if}
                          {#each filteredModels.slice(0, 50) as model}
                            <button
                              type="button"
                              on:click={() => selectModel(model.id)}
                              class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md {settings.model === model.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}"
                            >
                              <div class="font-medium">{model.name}</div>
                              <div class="text-xs text-gray-500 dark:text-gray-400 truncate">{model.id}</div>
                              {#if model.context_length}
                                <div class="text-xs text-gray-400 dark:text-gray-500">
                                  Context: {model.context_length.toLocaleString()} tokens
                                </div>
                              {/if}
                            </button>
                          {/each}
                          {#if filteredModels.length > 50}
                            <div class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                              Showing first 50 results. Refine your search to see more.
                            </div>
                          {/if}
                        {/if}
                      </div>
                    </div>
                  {/if}
                </div>
                
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Click to search and select from {allModels.length > 0 ? allModels.length : 'available'} models
                </p>
              </div>

              <!-- Temperature -->
              <div>
                <label for="temperature" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <Zap class="h-4 w-4" />
                      Creativity (Temperature)
                    </div>
                    <span class="text-sm text-gray-500">{settings.temperature}</span>
                  </div>
                </label>
                <input
                  id="temperature"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  bind:value={settings.temperature}
                  class="mt-2 w-full"
                />
                <div class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Focused (0)</span>
                  <span>Balanced (1)</span>
                  <span>Creative (2)</span>
                </div>
              </div>

              <!-- Max Tokens -->
              <div>
                <label for="maxTokens" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Max Tokens
                </label>
                <input
                  id="maxTokens"
                  type="number"
                  min="50"
                  max="500"
                  bind:value={settings.maxTokens}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Maximum length of generated tweets (50-500)
                </p>
              </div>
            {/if}

            <!-- Action Buttons -->
            <div class="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {#if saving}
                  <Loader2 class="h-4 w-4 animate-spin" />
                  Saving...
                {:else}
                  <CheckCircle class="h-4 w-4" />
                  Save Settings
                {/if}
              </button>

              {#if settings.enabled && settings.apiKey}
                <button
                  type="button"
                  on:click={testConnection}
                  disabled={testing}
                  class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  {#if testing}
                    <Loader2 class="h-4 w-4 animate-spin" />
                    Testing...
                  {:else}
                    <Sparkles class="h-4 w-4" />
                    Test Connection
                  {/if}
                </button>
              {/if}
            </div>
          </form>
        </div>
      </div>

      <!-- Pricing Info -->
      <div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
        <h3 class="text-sm font-medium text-gray-900 dark:text-white">Pricing Information</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          OpenRouter charges per token used. Prices vary by model. Check current pricing at 
          <a href="https://openrouter.ai/docs#models" target="_blank" rel="noopener" class="text-blue-600 underline dark:text-blue-400">
            openrouter.ai/docs#models
          </a>
        </p>
      </div>
    </div>
  {/if}
</div>
