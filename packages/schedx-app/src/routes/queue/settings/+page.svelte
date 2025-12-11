<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Save, ArrowLeft, Plus, X } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toastStore';
	import AccountDropdown from '$lib/components/AccountDropdown.svelte';
	import StyledSelect from '$lib/components/StyledSelect.svelte';
	import logger from '$lib/logger';

	let settings = {
		enabled: true,
		postingTimes: ['09:00', '13:00', '17:00'],
		timezone: 'America/New_York',
		minInterval: 60,
		maxPostsPerDay: 10,
		skipWeekends: false,
		twitterAccountId: undefined as string | undefined
	};

	let loading = true;
	let saving = false;
	let newTime = '';
	let accounts: any[] = [];
	let selectedAccountId: string = 'all';
	let allSettings: any[] = [];

	onMount(async () => {
		await fetchAccounts();
		await fetchSettings();
	});

	async function fetchAccounts() {
		try {
			const res = await fetch('/api/accounts', {
				credentials: 'same-origin'
			});
			if (res.ok) {
				const data = await res.json();
				accounts = data.accounts || [];
			}
		} catch (e) {
			logger.error('Failed to load accounts:', { error: e });
		}
	}

	async function fetchSettings() {
		loading = true;
		try {
			const url = selectedAccountId && selectedAccountId !== 'all'
				? `/api/queue/settings?accountId=${selectedAccountId}`
				: '/api/queue/settings';
			const res = await fetch(url, {
				credentials: 'same-origin'
			});
			if (res.ok) {
				const data = await res.json();
				if (data.settings) {
					settings = { ...data.settings, twitterAccountId: selectedAccountId };
				} else {
					// No settings found, use defaults
					settings = {
						enabled: true,
						postingTimes: ['09:00', '13:00', '17:00'],
						timezone: 'America/New_York',
						minInterval: 60,
						maxPostsPerDay: 10,
						skipWeekends: false,
						twitterAccountId: selectedAccountId
					};
				}
			} else if (res.status === 401) {
				toastStore.error('Authentication Required', 'Please log in to access queue settings');
				goto('/login');
			}
		} catch (e) {
			logger.error('Failed to load queue settings:', { error: e });
		} finally {
			loading = false;
		}
	}

	function onAccountChange(accountId: string) {
		selectedAccountId = accountId;
		fetchSettings();
	}

	async function saveSettings() {
		saving = true;
		try {
			const settingsToSave = {
				...settings,
				twitterAccountId: selectedAccountId || undefined
			};

			const res = await fetch('/api/queue/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(settingsToSave),
				credentials: 'same-origin'
			});

			if (!res.ok) {
				const error = await res.json().catch(() => ({ error: 'Failed to save settings' }));
				if (res.status === 401) {
					toastStore.error('Authentication Required', 'Please log in to save settings');
					goto('/login');
					return;
				}
				throw new Error(error.error || 'Failed to save settings');
			}

			const accountName = selectedAccountId
				? accounts.find((a) => a.providerAccountId === selectedAccountId)?.username || 'account'
				: 'default';
			toastStore.success(
				'Settings Saved',
				`Queue settings for ${accountName} updated successfully`
			);
			goto('/queue');
		} catch (e) {
			toastStore.error('Save Failed', 'Failed to save queue settings');
			logger.error('Failed to save queue settings:', { error: e });
		} finally {
			saving = false;
		}
	}

	function addPostingTime() {
		if (newTime && !settings.postingTimes.includes(newTime)) {
			settings.postingTimes = [...settings.postingTimes, newTime].sort();
			newTime = '';
		}
	}

	function removePostingTime(time: string) {
		settings.postingTimes = settings.postingTimes.filter((t) => t !== time);
	}
</script>

<svelte:head>
	<title>Queue Settings - SchedX</title>
	<meta name="description" content="Configure tweet queue settings" />
</svelte:head>

<div class="mx-auto max-w-4xl">
	<!-- Header -->
	<div class="mb-6 flex items-center gap-4">
		<a
			href="/queue"
			class="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Queue Settings</h1>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
				Configure how tweets are automatically scheduled from the queue
			</p>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
			></div>
		</div>
	{:else}
		<form on:submit|preventDefault={saveSettings} class="space-y-6">
			<!-- Account Selector -->
			{#if accounts.length > 1}
				<div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
					<h3 class="mb-4 text-lg font-medium text-gray-900 dark:text-white">
						Twitter Account
					</h3>
					<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
						Configure queue settings for a specific account or use default settings for all accounts
					</p>
					<AccountDropdown
						accounts={accounts.map(acc => ({
							id: acc.providerAccountId,
							username: acc.username,
							displayName: acc.displayName || acc.username,
							avatarUrl: acc.profileImage
						}))}
						selectedAccount={selectedAccountId}
						onSelect={onAccountChange}
						placeholder="Default (All Accounts)"
					/>
				</div>
			{/if}

			<!-- Enable Queue -->
			<div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
				<div class="flex items-center justify-between">
					<div>
						<h3 class="text-lg font-medium text-gray-900 dark:text-white">Enable Queue</h3>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
							Automatically schedule queued tweets
						</p>
					</div>
					<label class="relative inline-flex cursor-pointer items-center">
						<input type="checkbox" bind:checked={settings.enabled} class="peer sr-only" />
						<div
							class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"
						></div>
					</label>
				</div>
			</div>

			<!-- Posting Times -->
			<div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
				<h3 class="mb-4 text-lg font-medium text-gray-900 dark:text-white">Posting Times</h3>
				<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
					Set the times when queued tweets should be posted
				</p>

				<div class="mb-4 flex gap-2">
					<input
						type="time"
						bind:value={newTime}
						class="block flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
					/>
					<button
						type="button"
						on:click={addPostingTime}
						class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-700"
					>
						<Plus class="h-4 w-4" />
						Add
					</button>
				</div>

				<div class="flex flex-wrap gap-2">
					{#each settings.postingTimes as time}
						<div
							class="inline-flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
						>
							{time}
							<button
								type="button"
								on:click={() => removePostingTime(time)}
								class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
							>
								<X class="h-3 w-3" />
							</button>
						</div>
					{/each}
				</div>
			</div>

			<!-- Advanced Settings -->
			<div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
				<h3 class="mb-4 text-lg font-medium text-gray-900 dark:text-white">Advanced Settings</h3>

				<div class="space-y-4">
					<!-- Min Interval -->
					<div>
						<label
							for="minInterval"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Minimum Interval Between Posts (minutes)
						</label>
						<input
							id="minInterval"
							type="number"
							min="1"
							bind:value={settings.minInterval}
							class="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
						/>
					</div>

					<!-- Max Posts Per Day -->
					<div>
						<label
							for="maxPostsPerDay"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Maximum Posts Per Day
						</label>
						<input
							id="maxPostsPerDay"
							type="number"
							min="1"
							max="50"
							bind:value={settings.maxPostsPerDay}
							class="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
						/>
					</div>

					<!-- Skip Weekends -->
					<div class="flex items-center">
						<input
							id="skipWeekends"
							type="checkbox"
							bind:checked={settings.skipWeekends}
							class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
						/>
						<label for="skipWeekends" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
							Skip weekends (Saturday & Sunday)
						</label>
					</div>

					<!-- Timezone -->
					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Timezone
						</span>
						<StyledSelect
							id="timezone"
							bind:value={settings.timezone}
							options={[
								{ value: 'America/New_York', label: 'Eastern Time (ET)' },
								{ value: 'America/Chicago', label: 'Central Time (CT)' },
								{ value: 'America/Denver', label: 'Mountain Time (MT)' },
								{ value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
								{ value: 'UTC', label: 'UTC' }
							]}
							placeholder="Select timezone"
						/>
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-3">
				<a
					href="/queue"
					class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				>
					Cancel
				</a>
				<button
					type="submit"
					disabled={saving}
					class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Save class="h-4 w-4" />
					{saving ? 'Saving...' : 'Save Settings'}
				</button>
			</div>
		</form>
	{/if}
</div>
