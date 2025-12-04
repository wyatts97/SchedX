<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Database, Trash2, Save, RefreshCw, Info } from 'lucide-svelte';

	interface RetentionSettings {
		snapshotRetentionDays: number;
		snapshotActiveTweetDays: number;
		followerHistoryRetentionDays: number;
		dailyStatsRetentionDays: number;
		contentAnalyticsRetentionDays: number;
		autoCleanupEnabled: boolean;
		lastCleanupAt: number | null;
	}

	let settings: RetentionSettings = {
		snapshotRetentionDays: 90,
		snapshotActiveTweetDays: 30,
		followerHistoryRetentionDays: 365,
		dailyStatsRetentionDays: 180,
		contentAnalyticsRetentionDays: 180,
		autoCleanupEnabled: true,
		lastCleanupAt: null
	};

	let loading = true;
	let saving = false;
	let cleaning = false;

	onMount(async () => {
		await loadSettings();
	});

	async function loadSettings() {
		loading = true;
		try {
			const response = await fetch('/api/analytics/retention-settings');
			if (!response.ok) {
				throw new Error('Failed to load settings');
			}
			const data = await response.json();
			settings = data.settings;
		} catch (error) {
			console.error('Failed to load retention settings:', error);
			toast.error('Failed to load retention settings');
		} finally {
			loading = false;
		}
	}

	async function saveSettings() {
		saving = true;
		try {
			const response = await fetch('/api/analytics/retention-settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(settings)
			});

			if (!response.ok) {
				throw new Error('Failed to save settings');
			}

			toast.success('Retention settings saved successfully');
		} catch (error) {
			console.error('Failed to save retention settings:', error);
			toast.error('Failed to save retention settings');
		} finally {
			saving = false;
		}
	}

	async function runCleanup() {
		if (!confirm('This will permanently delete old data according to your retention policies. Continue?')) {
			return;
		}

		cleaning = true;
		toast.info('Starting data cleanup...');

		try {
			const response = await fetch('/api/analytics/cleanup', {
				method: 'POST'
			});

			if (!response.ok) {
				throw new Error('Failed to run cleanup');
			}

			const result = await response.json();
			toast.success(`Cleanup completed! Deleted ${result.stats.totalRecordsDeleted} records.`);
			await loadSettings(); // Refresh to get updated lastCleanupAt
		} catch (error) {
			console.error('Failed to run cleanup:', error);
			toast.error('Failed to run cleanup');
		} finally {
			cleaning = false;
		}
	}

	function formatDate(timestamp: number | null): string {
		if (!timestamp) return 'Never';
		return new Date(timestamp).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	function calculateStorageImpact(days: number): string {
		if (days >= 365) return 'Very High';
		if (days >= 180) return 'High';
		if (days >= 90) return 'Medium';
		if (days >= 30) return 'Low';
		return 'Very Low';
	}
</script>

<div class="min-h-screen bg-gray-50 dark:bg-[#15202B] theme-lightsout:bg-black p-6">
	<div class="mx-auto max-w-4xl">
		<!-- Header -->
		<div class="mb-6">
			<div class="flex items-center gap-3 mb-2">
				<Database class="h-8 w-8 text-blue-600 dark:text-blue-400" />
				<h1 class="text-3xl font-bold text-gray-900 dark:text-white theme-lightsout:text-gray-100">
					Data Retention Settings
				</h1>
			</div>
			<p class="text-gray-600 dark:text-gray-400 theme-lightsout:text-gray-500">
				Configure how long to keep analytics data. Automatic cleanup runs weekly on Sundays at 2 AM UTC.
			</p>
		</div>

		{#if loading}
			<div class="flex items-center justify-center py-12">
				<RefreshCw class="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
			</div>
		{:else}
			<!-- Settings Form -->
			<div class="space-y-6">
				<!-- Auto Cleanup Toggle -->
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-800 theme-lightsout:bg-gray-900">
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<h3 class="text-lg font-semibold text-gray-900 dark:text-white theme-lightsout:text-gray-100">
								Automatic Cleanup
							</h3>
							<p class="mt-1 text-sm text-gray-600 dark:text-gray-400 theme-lightsout:text-gray-500">
								Automatically delete old data based on retention policies every Sunday at 2 AM UTC
							</p>
							{#if settings.lastCleanupAt}
								<p class="mt-2 text-xs text-gray-500 dark:text-gray-500">
									Last cleanup: {formatDate(settings.lastCleanupAt)}
								</p>
							{/if}
						</div>
						<label class="relative inline-flex cursor-pointer items-center">
							<input
								type="checkbox"
								bind:checked={settings.autoCleanupEnabled}
								class="peer sr-only"
							/>
							<div class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"></div>
						</label>
					</div>
				</div>

				<!-- Engagement Snapshots -->
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-800 theme-lightsout:bg-gray-900">
					<div class="mb-4 flex items-start gap-3">
						<Info class="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
						<div class="flex-1">
							<h3 class="text-lg font-semibold text-gray-900 dark:text-white theme-lightsout:text-gray-100">
								Engagement Snapshots
							</h3>
							<p class="mt-1 text-sm text-gray-600 dark:text-gray-400 theme-lightsout:text-gray-500">
								Daily snapshots of tweet engagement metrics (likes, retweets, replies, views)
							</p>
						</div>
					</div>

					<div class="space-y-4">
						<div>
							<label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
								Retention Period (days)
							</label>
							<input
								type="number"
								bind:value={settings.snapshotRetentionDays}
								min="7"
								max="730"
								class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
							/>
							<p class="mt-1 text-xs text-gray-500">
								Storage impact: <span class="font-semibold">{calculateStorageImpact(settings.snapshotRetentionDays)}</span>
							</p>
						</div>

						<div>
							<label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
								Only Snapshot Tweets Younger Than (days)
							</label>
							<input
								type="number"
								bind:value={settings.snapshotActiveTweetDays}
								min="7"
								max="90"
								class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
							/>
							<p class="mt-1 text-xs text-gray-500">
								Recommended: 30 days (reduces snapshot creation by ~90%)
							</p>
						</div>
					</div>
				</div>

				<!-- Follower History -->
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-800 theme-lightsout:bg-gray-900">
					<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white theme-lightsout:text-gray-100">
						Follower History
					</h3>
					<p class="mb-4 text-sm text-gray-600 dark:text-gray-400 theme-lightsout:text-gray-500">
						Historical follower count data for growth tracking
					</p>

					<div>
						<label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							Retention Period (days)
						</label>
						<input
							type="number"
							bind:value={settings.followerHistoryRetentionDays}
							min="30"
							max="1825"
							class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						/>
						<p class="mt-1 text-xs text-gray-500">
							Storage impact: <span class="font-semibold">{calculateStorageImpact(settings.followerHistoryRetentionDays)}</span>
						</p>
					</div>
				</div>

				<!-- Daily Stats -->
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-800 theme-lightsout:bg-gray-900">
					<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white theme-lightsout:text-gray-100">
						Daily Statistics
					</h3>
					<p class="mb-4 text-sm text-gray-600 dark:text-gray-400 theme-lightsout:text-gray-500">
						Aggregated daily engagement metrics per account
					</p>

					<div>
						<label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							Retention Period (days)
						</label>
						<input
							type="number"
							bind:value={settings.dailyStatsRetentionDays}
							min="30"
							max="730"
							class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						/>
						<p class="mt-1 text-xs text-gray-500">
							Storage impact: <span class="font-semibold">{calculateStorageImpact(settings.dailyStatsRetentionDays)}</span>
						</p>
					</div>
				</div>

				<!-- Content Analytics -->
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 theme-lightsout:border-gray-800 theme-lightsout:bg-gray-900">
					<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white theme-lightsout:text-gray-100">
						Content Analytics
					</h3>
					<p class="mb-4 text-sm text-gray-600 dark:text-gray-400 theme-lightsout:text-gray-500">
						Tweet composition analysis (media, hashtags, mentions, etc.)
					</p>

					<div>
						<label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							Retention Period (days)
						</label>
						<input
							type="number"
							bind:value={settings.contentAnalyticsRetentionDays}
							min="30"
							max="730"
							class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						/>
						<p class="mt-1 text-xs text-gray-500">
							Storage impact: <span class="font-semibold">{calculateStorageImpact(settings.contentAnalyticsRetentionDays)}</span>
						</p>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-4">
					<button
						on:click={saveSettings}
						disabled={saving}
						class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
					>
						<Save class={saving ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
						{saving ? 'Saving...' : 'Save Settings'}
					</button>

					<button
						on:click={runCleanup}
						disabled={cleaning || !settings.autoCleanupEnabled}
						class="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-6 py-3 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
						title={!settings.autoCleanupEnabled ? 'Enable auto-cleanup first' : 'Run cleanup now'}
					>
						<Trash2 class={cleaning ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
						{cleaning ? 'Cleaning...' : 'Run Cleanup Now'}
					</button>
				</div>

				<!-- Info Box -->
				<div class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
					<div class="flex gap-3">
						<Info class="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
						<div class="text-sm text-blue-800 dark:text-blue-300">
							<p class="font-semibold mb-1">Recommended Settings</p>
							<ul class="list-disc list-inside space-y-1 text-xs">
								<li>Engagement snapshots: 90 days (3 months of trend data)</li>
								<li>Active tweet snapshots: 30 days (reduces storage by 90%)</li>
								<li>Follower history: 365 days (1 year of growth tracking)</li>
								<li>Daily stats: 180 days (6 months of performance data)</li>
								<li>Content analytics: 180 days (6 months of content insights)</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
