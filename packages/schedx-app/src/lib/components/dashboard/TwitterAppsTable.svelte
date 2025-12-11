<script lang="ts">
	import { Settings, TestTube, Edit, Trash2, Users } from 'lucide-svelte';
	import { dashboardStore, type TwitterApp } from '$lib/stores/dashboardStore';
	import { toastStore } from '$lib/stores/toastStore';
	import { API } from '$lib/api';
	import Table from '$lib/components/ui/Table.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { TableColumn, TableAction } from '$lib/types';

	export let apps: TwitterApp[] | undefined = undefined;

	const columns: TableColumn<TwitterApp>[] = [
		{
			key: 'name',
			label: 'Name',
			width: '200px'
		},
		{
			key: 'clientId',
			label: 'OAuth 2.0',
			render: (_, app) => {
				const hasOAuth2 = app.clientId && app.clientSecret;
				return hasOAuth2
					? '<span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/20 dark:text-green-200">✓ Configured</span>'
					: '<span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/20 dark:text-red-200">✗ Missing</span>';
			}
		},
		{
			key: 'consumerKey',
			label: 'OAuth 1.0a',
			render: (_, app) => {
				const hasOAuth1 =
					app.consumerKey && app.consumerSecret && app.accessToken && app.accessTokenSecret;
				return hasOAuth1
					? '<span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/20 dark:text-green-200">✓ Media Ready</span>'
					: '<span class="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">⚠ Text Only</span>';
			}
		},
		{
			key: 'callbackUrl',
			label: 'Callback URL',
			render: (value) => `<span class="font-mono text-sm">${value}</span>`
		},
		{
			key: 'createdAt',
			label: 'Created',
			render: (value) => new Date(value).toLocaleDateString()
		}
	];

	const actions: TableAction<TwitterApp>[] = [
		{
			label: 'Test',
			icon: TestTube,
			variant: 'secondary',
			onClick: testAppConnection
		},
		{
			label: 'Edit',
			icon: Edit,
			variant: 'secondary',
			onClick: (app) => dashboardStore.openAppForm(app)
		},
		{
			label: 'Delete',
			icon: Trash2,
			variant: 'danger',
			onClick: deleteApp
		}
	];

	async function deleteApp(app: TwitterApp) {
		if (
			!confirm(
				'Are you sure you want to delete this Twitter app? This will also disconnect any accounts using this app.'
			)
		) {
			return;
		}

		try {
			const response = await fetch(API.TWITTER_APP_BY_ID(app.id!), {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to delete Twitter app');
			}

			dashboardStore.removeApp(app.id!);
			toastStore.success('Twitter app deleted successfully');
		} catch (error) {
			toastStore.error(
				'Delete Failed',
				error instanceof Error ? error.message : 'Failed to delete Twitter app'
			);
		}
	}

	async function testAppConnection(app: TwitterApp) {
		try {
			const response = await fetch(API.TEST_TWITTER_APP_CONNECTION, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ appId: app.id })
			});

			const data = await response.json();

			if (response.ok) {
				toastStore.success('Connection Test', data.message || 'Connection test successful!');
			} else {
				// Handle OAuth 1.0a credential errors specifically
				if (data.error === 'OAuth 1.0a credentials not configured') {
					const missingCreds = data.details || {};
					const missingList = Object.entries(missingCreds)
						.filter(([_, hasCred]) => !hasCred)
						.map(([cred, _]) => cred)
						.join(', ');

					toastStore.warning(
						'OAuth 1.0a Missing',
						`Missing credentials: ${missingList}. Media uploads require all OAuth 1.0a credentials.`
					);
				} else {
					toastStore.error('Connection Test Failed', data.error || 'Connection test failed');
				}
			}
		} catch (error) {
			toastStore.error(
				'Connection Test Error',
				error instanceof Error ? error.message : 'Failed to test connection'
			);
		}
	}
</script>

<div class="rounded-lg bg-white shadow dark:bg-gray-800">
	<div class="px-4 py-5 sm:p-6">
		<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">
				Twitter Applications
			</h3>
			<div class="flex flex-col gap-2 sm:flex-row sm:gap-3">
				<a
					href="/accounts"
					class="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 sm:px-4"
				>
					<Users class="mr-2 h-4 w-4" />
					Manage Accounts
				</a>
				<button
					class="inline-flex items-center justify-center rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:px-4"
					on:click={() => dashboardStore.openAppForm()}
				>
					<Settings class="mr-2 h-4 w-4" />
					Add App
				</button>
			</div>
		</div>

		{#if apps}
			{#if apps.length === 0}
				<div class="py-8 text-center">
					<Settings class="mx-auto h-12 w-12 text-gray-400" />
					<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No Twitter Apps</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Add your first Twitter application to get started.
					</p>
					<div class="mt-6">
						<button
							class="inline-flex items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
							on:click={() => dashboardStore.openAppForm()}
						>
							Add Your First App
						</button>
					</div>
				</div>
			{:else}
				<!-- Mobile Card View -->
				<div class="space-y-4 md:hidden">
					{#each apps as app}
						<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
							<div class="mb-3 flex items-start justify-between">
								<h4 class="font-medium text-gray-900 dark:text-white">{app.name}</h4>
								<span class="text-xs text-gray-500 dark:text-gray-400">
									{new Date(app.createdAt).toLocaleDateString()}
								</span>
							</div>
							<div class="mb-3 flex flex-wrap gap-2">
								{#if app.clientId && app.clientSecret}
									<span class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/20 dark:text-green-200">
										✓ OAuth 2.0
									</span>
								{:else}
									<span class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/20 dark:text-red-200">
										✗ OAuth 2.0
									</span>
								{/if}
								{#if app.consumerKey && app.consumerSecret && app.accessToken && app.accessTokenSecret}
									<span class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/20 dark:text-green-200">
										✓ Media Ready
									</span>
								{:else}
									<span class="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
										⚠ Text Only
									</span>
								{/if}
							</div>
							<p class="mb-3 truncate font-mono text-xs text-gray-500 dark:text-gray-400">
								{app.callbackUrl}
							</p>
							<div class="flex gap-2">
								<button
									class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
									on:click={() => testAppConnection(app)}
								>
									Test
								</button>
								<button
									class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
									on:click={() => dashboardStore.openAppForm(app)}
								>
									Edit
								</button>
								<button
									class="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
									on:click={() => deleteApp(app)}
								>
									Delete
								</button>
							</div>
						</div>
					{/each}
				</div>

				<!-- Desktop Table View -->
				<div class="hidden overflow-x-auto md:block">
					<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
						<thead class="bg-gray-50 dark:bg-gray-700">
							<tr>
								<th
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
									>Name</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
									>OAuth 2.0</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
									>OAuth 1.0a</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
									>Callback URL</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
									>Created</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
									>Actions</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
							{#each apps as app}
								<tr>
									<td
										class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white"
										>{app.name}</td
									>
									<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
										<div class="flex items-center space-x-2">
											{#if app.clientId && app.clientSecret}
												<span
													class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/20 dark:text-green-200"
												>
													✓ Configured
												</span>
											{:else}
												<span
													class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/20 dark:text-red-200"
												>
													✗ Missing
												</span>
											{/if}
										</div>
									</td>
									<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
										<div class="flex items-center space-x-2">
											{#if app.consumerKey && app.consumerSecret && app.accessToken && app.accessTokenSecret}
												<span
													class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/20 dark:text-green-200"
												>
													✓ Media Ready
												</span>
											{:else}
												<span
													class="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
												>
													⚠ Text Only
												</span>
											{/if}
										</div>
									</td>
									<td
										class="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-500 dark:text-gray-400"
										>{app.callbackUrl}</td
									>
									<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400"
										>{new Date(app.createdAt).toLocaleDateString()}</td
									>
									<td class="whitespace-nowrap px-6 py-4 text-sm font-medium">
										<div class="flex space-x-2">
											<button
												class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
												on:click={() => testAppConnection(app)}
											>
												Test
											</button>
											<button
												class="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
												on:click={() => dashboardStore.openAppForm(app)}
											>
												Edit
											</button>
											<button
												class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
												on:click={() => deleteApp(app)}
											>
												Delete
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</div>
</div>
