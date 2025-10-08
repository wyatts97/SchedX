<script lang="ts">
	import { onMount } from 'svelte';
	import { toastStore } from '$lib/stores/toastStore';
	import { Mail, Bell, BellOff, CheckCircle, XCircle, Loader2 } from 'lucide-svelte';

	let loading = true;
	let saving = false;
	let preferences = {
		enabled: false,
		email: '',
		onSuccess: true,
		onFailure: true
	};

	onMount(async () => {
		await loadPreferences();
	});

	async function loadPreferences() {
		loading = true;
		try {
			const response = await fetch('/api/admin/email-notifications');
			if (!response.ok) {
				throw new Error('Failed to load preferences');
			}
			const data = await response.json();
			preferences = data.preferences;
		} catch (error) {
			toastStore.error('Load Failed', 'Failed to load email notification preferences');
		} finally {
			loading = false;
		}
	}

	async function savePreferences() {
		// Validate email if enabled
		if (preferences.enabled && !preferences.email) {
			toastStore.error('Validation Error', 'Email address is required when notifications are enabled');
			return;
		}

		if (preferences.enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(preferences.email)) {
			toastStore.error('Validation Error', 'Please enter a valid email address');
			return;
		}

		saving = true;
		try {
			const response = await fetch('/api/admin/email-notifications', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(preferences)
			});

			if (!response.ok) {
				throw new Error('Failed to save preferences');
			}

			toastStore.success('Settings Saved', 'Email notification preferences updated successfully');
		} catch (error) {
			toastStore.error('Save Failed', 'Failed to save email notification preferences');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Email Notifications - SchedX Admin</title>
</svelte:head>

<div class="mx-auto max-w-4xl p-6">
	<div class="mb-8">
		<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Email Notifications</h1>
		<p class="text-gray-600 dark:text-gray-400">
			Configure email notifications for scheduled tweet events
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
							class="flex h-12 w-12 items-center justify-center rounded-lg {preferences.enabled
								? 'bg-green-100 dark:bg-green-900/20'
								: 'bg-gray-100 dark:bg-gray-700'}"
						>
							{#if preferences.enabled}
								<Bell class="h-6 w-6 text-green-600 dark:text-green-400" />
							{:else}
								<BellOff class="h-6 w-6 text-gray-400" />
							{/if}
						</div>
						<div>
							<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
								Email Notifications
							</h3>
							<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
								Receive email alerts when scheduled tweets are posted or fail
							</p>
						</div>
					</div>
					<label class="relative inline-flex cursor-pointer items-center">
						<input
							type="checkbox"
							bind:checked={preferences.enabled}
							class="peer sr-only"
						/>
						<div
							class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"
						></div>
					</label>
				</div>
			</div>

			{#if preferences.enabled}
				<!-- Email Address -->
				<div
					class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
				>
					<div class="mb-4 flex items-center space-x-3">
						<Mail class="h-5 w-5 text-gray-400" />
						<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Email Address</h3>
					</div>
					<input
						type="email"
						bind:value={preferences.email}
						placeholder="your@email.com"
						class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
						required
					/>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
						Notifications will be sent to this email address
					</p>
				</div>

				<!-- Notification Types -->
				<div
					class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
				>
					<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
						Notification Types
					</h3>
					<div class="space-y-4">
						<!-- Success Notifications -->
						<label class="flex cursor-pointer items-start space-x-3">
							<input
								type="checkbox"
								bind:checked={preferences.onSuccess}
								class="mt-1 h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
							/>
							<div class="flex-1">
								<div class="flex items-center space-x-2">
									<CheckCircle class="h-5 w-5 text-green-500" />
									<span class="font-medium text-gray-900 dark:text-white"
										>Successful Posts</span
									>
								</div>
								<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
									Get notified when scheduled tweets are successfully posted to Twitter/X
								</p>
							</div>
						</label>

						<!-- Failure Notifications -->
						<label class="flex cursor-pointer items-start space-x-3">
							<input
								type="checkbox"
								bind:checked={preferences.onFailure}
								class="mt-1 h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
							/>
							<div class="flex-1">
								<div class="flex items-center space-x-2">
									<XCircle class="h-5 w-5 text-red-500" />
									<span class="font-medium text-gray-900 dark:text-white">Failed Posts</span>
								</div>
								<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
									Get notified when scheduled tweets fail to post (recommended)
								</p>
							</div>
						</label>
					</div>
				</div>

				<!-- Info Box -->
				<div class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
					<div class="flex items-start space-x-3">
						<Mail class="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
						<div class="flex-1">
							<h4 class="font-medium text-blue-900 dark:text-blue-300">
								Email Service Configuration
							</h4>
							<p class="mt-1 text-sm text-blue-800 dark:text-blue-400">
								Make sure to configure your email service provider (Resend) in the environment
								variables. Set <code class="rounded bg-blue-100 px-1 py-0.5 dark:bg-blue-800">EMAIL_NOTIFICATIONS_ENABLED=true</code>
								and add your <code class="rounded bg-blue-100 px-1 py-0.5 dark:bg-blue-800">RESEND_API_KEY</code>
								to enable email notifications.
							</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Save Button -->
			<div class="flex justify-end space-x-3">
				<button
					type="button"
					on:click={loadPreferences}
					disabled={saving}
					class="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
				>
					Reset
				</button>
				<button
					type="button"
					on:click={savePreferences}
					disabled={saving}
					class="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
				>
					{#if saving}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Save Settings
				</button>
			</div>
		</div>
	{/if}
</div>
