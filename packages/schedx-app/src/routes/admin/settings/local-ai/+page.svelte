<script lang="ts">
  import { onMount } from 'svelte';
  import { toastStore } from '$lib/stores/toastStore';
  import { Sparkles, CheckCircle, Loader2, Cpu } from 'lucide-svelte';

  let loading = true;
  let saving = false;
  let settings = {
    enabled: false,
    temperature: 0.8,
    maxTokens: 120
  };

  onMount(async () => {
    await loadSettings();
  });

  async function loadSettings() {
    loading = true;
    try {
      const response = await fetch('/api/admin/local-ai');
      if (response.ok) {
        settings = await response.json();
      }
    } catch (error) {
      toastStore.error('Failed to load local AI settings');
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    saving = true;
    try {
      const response = await fetch('/api/admin/local-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!response.ok) throw new Error('Failed to save settings');
      toastStore.success('Local AI settings saved');
    } catch (error) {
      toastStore.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Local AI - SchedX Admin</title>
</svelte:head>

<div class="mx-auto max-w-4xl p-6">
  <div class="mb-8">
    <h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Local AI Settings</h1>
    <p class="text-gray-600 dark:text-gray-400">
      Configure TinyLlama model for offline tweet generation
    </p>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-gray-400" />
    </div>
  {:else}
    <div class="space-y-6">
      <!-- Enable/Disable Toggle -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-lg {settings.enabled
              ? 'bg-green-100 dark:bg-green-900/20'
              : 'bg-gray-100 dark:bg-gray-700'}">
              {#if settings.enabled}
                <Cpu class="h-6 w-6 text-green-600 dark:text-green-400" />
              {:else}
                <Cpu class="h-6 w-6 text-gray-400" />
              {/if}
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Local AI Generation
              </h3>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Enable offline AI model for tweet generation
              </p>
            </div>
          </div>
          <label class="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              bind:checked={settings.enabled}
              class="peer sr-only"
            />
            <div class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-green-800"></div>
          </label>
        </div>
      </div>

      <!-- Model Configuration -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="space-y-4">
          <div>
            <label for="temperature" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Creativity (Temperature)
            </label>
            <input
              id="temperature"
              type="range"
              bind:value={settings.temperature}
              min="0"
              max="1"
              step="0.1"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              disabled={!settings.enabled}
            />
            <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Precise</span>
              <span>{settings.temperature}</span>
              <span>Creative</span>
            </div>
          </div>

          <div>
            <label for="maxTokens" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Max Response Length
            </label>
            <input
              id="maxTokens"
              type="range"
              bind:value={settings.maxTokens}
              min="60"
              max="280"
              step="10"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              disabled={!settings.enabled}
            />
            <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Short</span>
              <span>{settings.maxTokens} tokens</span>
              <span>Long</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex justify-end gap-3">
        <button
          type="button"
          on:click={saveSettings}
          disabled={saving}
          class="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
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
