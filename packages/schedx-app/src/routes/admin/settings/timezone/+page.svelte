<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Globe, Check, RefreshCw, Info } from 'lucide-svelte';
	import { detectTimezone, getCommonTimezones, getTimezoneOffset } from '$lib/utils/timezone';

	let loading = true;
	let saving = false;
	let error = '';
	let success = '';

	let currentTimezone = 'UTC';
	let selectedTimezone = 'UTC';
	let detectedTimezone = 'UTC';
	let searchQuery = '';

	const timezones = getCommonTimezones();

	$: filteredTimezones = searchQuery
		? timezones.filter(tz => 
			tz.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
			tz.value.toLowerCase().includes(searchQuery.toLowerCase())
		)
		: timezones;

	onMount(async () => {
		if (browser) {
			// Initialize Preline
			const initPreline = () => {
				if (typeof window !== 'undefined' && window.HSStaticMethods) {
					window.HSStaticMethods.autoInit();
				}
			};
			setTimeout(initPreline, 100);

			// Detect browser timezone
			detectedTimezone = detectTimezone();

			// Load current timezone from server
			try {
				const res = await fetch('/api/admin/timezone');
				if (res.ok) {
					const data = await res.json();
					currentTimezone = data.timezone || 'UTC';
					selectedTimezone = currentTimezone;
				}
			} catch (e) {
				console.error('Failed to load timezone:', e);
				error = 'Failed to load timezone settings';
			} finally {
				loading = false;
			}
		}
	});

	async function saveTimezone() {
		saving = true;
		error = '';
		success = '';

		try {
			const res = await fetch('/api/admin/timezone', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ timezone: selectedTimezone })
			});

			const data = await res.json();

			if (res.ok) {
				currentTimezone = selectedTimezone;
				success = 'Timezone updated successfully!';
				// Store in localStorage for quick access
				localStorage.setItem('userTimezone', selectedTimezone);
			} else {
				error = data.error || 'Failed to save timezone';
			}
		} catch (e) {
			error = 'Failed to save timezone';
			console.error(e);
		} finally {
			saving = false;
			setTimeout(() => {
				success = '';
			}, 3000);
		}
	}

	function useDetectedTimezone() {
		selectedTimezone = detectedTimezone;
	}

	function getCurrentTime(timezone: string): string {
		try {
			return new Date().toLocaleTimeString('en-US', {
				timeZone: timezone,
				hour: '2-digit',
				minute: '2-digit',
				hour12: true
			});
		} catch {
			return '--:--';
		}
	}
</script>

<svelte:head>
	<title>Timezone Settings - SchedX</title>
	<meta name="description" content="Configure your timezone for accurate scheduling" />
</svelte:head>

<div class="mx-auto max-w-4xl">
	<div class="mb-6">
		<a
			href="/admin/settings"
			class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
		>
			← Back to Settings
		</a>
	</div>

	<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Timezone Settings</h1>
	<p class="mb-6 text-gray-600 dark:text-gray-400">
		Set your timezone for accurate tweet scheduling and calendar display.
	</p>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
		</div>
	{:else}
		<!-- Status Messages -->
		{#if error}
			<div class="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
				<p class="text-sm text-red-600 dark:text-red-400">{error}</p>
			</div>
		{/if}

		{#if success}
			<div class="mb-6 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
				<div class="flex items-center">
					<Check class="mr-2 h-5 w-5 text-green-600 dark:text-green-400" />
					<p class="text-sm text-green-600 dark:text-green-400">{success}</p>
				</div>
			</div>
		{/if}

		<!-- Current Timezone Display -->
		<div class="mb-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Current Timezone</h2>
					<p class="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
						{currentTimezone}
					</p>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Current time: {getCurrentTime(currentTimezone)} ({getTimezoneOffset(currentTimezone)})
					</p>
				</div>
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
					<Globe class="h-8 w-8 text-blue-600 dark:text-blue-400" />
				</div>
			</div>
		</div>

		<!-- Auto-detect Info -->
		<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
			<div class="flex items-start">
				<Info class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
				<div class="flex-1">
					<h3 class="font-medium text-blue-800 dark:text-blue-300">Detected Timezone</h3>
					<p class="mt-1 text-sm text-blue-700 dark:text-blue-400">
						Your browser detected: <strong>{detectedTimezone}</strong> ({getTimezoneOffset(detectedTimezone)})
					</p>
					{#if detectedTimezone !== currentTimezone}
						<button
							type="button"
							on:click={useDetectedTimezone}
							class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
						>
							<RefreshCw class="h-4 w-4" />
							Use detected timezone
						</button>
					{/if}
				</div>
			</div>
		</div>

		<!-- Timezone Selection -->
		<div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Select Timezone</h2>

			<!-- Search -->
			<div class="mb-4">
				<input
					type="text"
					placeholder="Search timezones..."
					bind:value={searchQuery}
					class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
				/>
			</div>

			<!-- Timezone List -->
			<div class="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
				{#each filteredTimezones as tz (tz.value)}
					<button
						type="button"
						on:click={() => selectedTimezone = tz.value}
						class="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 {selectedTimezone === tz.value ? 'bg-blue-50 dark:bg-blue-900/20' : ''}"
					>
						<div>
							<span class="font-medium text-gray-900 dark:text-white">{tz.label}</span>
							<span class="ml-2 text-sm text-gray-500 dark:text-gray-400">{tz.value}</span>
						</div>
						<div class="flex items-center gap-3">
							<span class="text-sm text-gray-500 dark:text-gray-400">{tz.offset}</span>
							{#if selectedTimezone === tz.value}
								<Check class="h-5 w-5 text-blue-600 dark:text-blue-400" />
							{/if}
						</div>
					</button>
				{/each}

				{#if filteredTimezones.length === 0}
					<div class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
						No timezones found matching "{searchQuery}"
					</div>
				{/if}
			</div>

			<!-- Save Button -->
			<div class="mt-6">
				<button
					type="button"
					on:click={saveTimezone}
					disabled={saving || selectedTimezone === currentTimezone}
					class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-800"
				>
					{#if saving}
						<div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
						Saving...
					{:else}
						<Check class="h-4 w-4" />
						Save Timezone
					{/if}
				</button>
				{#if selectedTimezone !== currentTimezone}
					<p class="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
						Preview: {getCurrentTime(selectedTimezone)} in {selectedTimezone}
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
