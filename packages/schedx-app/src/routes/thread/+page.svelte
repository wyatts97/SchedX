<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import ThreadComposer from '$lib/components/ThreadComposer.svelte';
	import { toastStore } from '$lib/stores/toastStore';
	import { Calendar, Save, Send, ListPlus } from 'lucide-svelte';
	import logger from '$lib/logger';
	import flatpickr from 'flatpickr';
	import 'flatpickr/dist/flatpickr.css';

	export let data: PageData;

	let selectedAccountId = data.accounts && data.accounts.length > 0 ? data.accounts[0]?.id : '';
	let threadComposer: any;
	let scheduledDate = '';
	let dateInputEl: HTMLInputElement;
	let submitting = false;
	let currentAction = '';

	onMount(() => {
		if (browser) {
			const initPreline = () => {
				if (typeof window !== 'undefined' && window.HSStaticMethods) {
					logger.debug('Initializing Thread page Preline components...');
					window.HSStaticMethods.autoInit();
				}
			};
			setTimeout(initPreline, 100);
			setTimeout(initPreline, 500);

			if (dateInputEl) {
				flatpickr(dateInputEl, {
					enableTime: true,
					dateFormat: 'Y-m-d H:i',
					onChange: (selectedDates) => {
						scheduledDate = selectedDates[0]?.toISOString() ?? '';
					}
				});
			}
		}
	});

	async function handleSubmit(action: string) {
		if (!selectedAccountId) {
			toastStore.error('Account Required', 'Please select an account');
			return;
		}

		if (action === 'schedule' && !scheduledDate) {
			toastStore.error('Date Required', 'Please select a scheduled date');
			return;
		}

		const threadData = threadComposer?.getThreadData();
		if (!threadData) {
			return; // Validation errors shown by ThreadComposer
		}

		submitting = true;
		currentAction = action;

		try {
			const payload = {
				tweets: threadData.tweets,
				accountId: selectedAccountId,
				action,
				scheduledDate: action === 'schedule' ? scheduledDate : undefined
			};

			const response = await fetch('/api/threads', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to save thread');
			}

			toastStore.success(
				'Success',
				result.message || 'Thread saved successfully'
			);

			// Optionally redirect or clear form
			// goto('/scheduled');
		} catch (error) {
			toastStore.error(
				'Error',
				error instanceof Error ? error.message : 'Failed to save thread'
			);
			logger.error('Thread submission error:', { error });
		} finally {
			submitting = false;
			currentAction = '';
		}
	}
</script>

<svelte:head>
	<title>Create Thread - SchedX</title>
	<meta name="description" content="Create and schedule a Twitter thread" />
</svelte:head>

<div class="mx-auto max-w-4xl">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Create Thread</h1>
		<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			Compose a multi-tweet thread with auto-numbering
		</p>
	</div>

	<!-- Account Selection -->
	<div class="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
		<label for="account" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
			Select Account
		</label>
		<select
			id="account"
			bind:value={selectedAccountId}
			class="block w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
			style="background-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3E%3Cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3E%3C/svg%3E'); background-position: right 0.5rem center; background-repeat: no-repeat; background-size: 1.5em 1.5em;"
		>
			{#each data.accounts as account}
				<option value={account.id}>
					@{account.username} {account.displayName ? `(${account.displayName})` : ''}
				</option>
			{/each}
		</select>
	</div>

	<!-- Thread Composer -->
	<div class="mb-6">
		<ThreadComposer bind:this={threadComposer} {selectedAccountId} />
	</div>

	<!-- Schedule Date -->
	<div class="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
		<label
			for="schedule-date"
			class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
		>
			Schedule Date (Optional)
		</label>
		<input
			id="schedule-date"
			type="text"
			bind:this={dateInputEl}
			placeholder="Select date and time"
			class="block w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
		/>
	</div>

	<!-- Action Buttons -->
	<div class="flex flex-wrap gap-3">
		<button
			on:click={() => handleSubmit('draft')}
			disabled={submitting}
			class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
		>
			<Save class="h-4 w-4" />
			{submitting && currentAction === 'draft' ? 'Saving...' : 'Save as Draft'}
		</button>

		<button
			on:click={() => handleSubmit('queue')}
			disabled={submitting}
			class="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<ListPlus class="h-4 w-4" />
			{submitting && currentAction === 'queue' ? 'Adding...' : 'Add to Queue'}
		</button>

		<button
			on:click={() => handleSubmit('schedule')}
			disabled={submitting || !scheduledDate}
			class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<Calendar class="h-4 w-4" />
			{submitting && currentAction === 'schedule' ? 'Scheduling...' : 'Schedule Thread'}
		</button>

		<button
			on:click={() => handleSubmit('publish')}
			disabled={submitting}
			class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<Send class="h-4 w-4" />
			{submitting && currentAction === 'publish' ? 'Publishing...' : 'Publish Now'}
		</button>
	</div>
</div>
