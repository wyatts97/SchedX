<script lang="ts">
	import { Check, ChevronDown } from 'lucide-svelte';
	
	export let accounts: Array<{ id: string; username: string; displayName: string; avatarUrl?: string }> = [];
	export let selectedAccount: string = 'all';
	export let onSelect: (accountId: string) => void = () => {};
	export let placeholder: string = 'Filter by account';
	
	let isOpen = false;
	
	$: selectedAccountData = accounts.find(acc => acc.id === selectedAccount);
	
	function toggleDropdown() {
		isOpen = !isOpen;
	}
	
	function selectAccount(accountId: string) {
		selectedAccount = accountId;
		onSelect(accountId);
		isOpen = false;
	}
	
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.account-dropdown')) {
			isOpen = false;
		}
	}
	
	$: if (typeof window !== 'undefined') {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
		} else {
			document.removeEventListener('click', handleClickOutside);
		}
	}
</script>

<div class="account-dropdown relative">
	<button
		type="button"
		on:click={toggleDropdown}
		class="relative w-full cursor-pointer rounded-lg border bg-white py-2 pl-3 pr-10 text-left shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-[#192734] theme-lightsout:border-gray-600 theme-lightsout:bg-[#1a1a1a] sm:text-sm"
		aria-haspopup="listbox"
		aria-expanded={isOpen}
	>
		<span class="flex items-center">
			{#if selectedAccount === 'all'}
				<span class="ml-3 block truncate text-gray-700 dark:text-gray-300 theme-lightsout:text-gray-200">
					{placeholder}
				</span>
			{:else if selectedAccountData}
				{#if selectedAccountData.avatarUrl}
					<img
						src={selectedAccountData.avatarUrl}
						alt={selectedAccountData.displayName}
						class="h-5 w-5 flex-shrink-0 rounded-full"
					/>
				{/if}
				<span class="ml-3 block truncate text-gray-900 dark:text-white theme-lightsout:text-gray-100">
					{selectedAccountData.displayName}
				</span>
				<span class="ml-2 block truncate text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">
					@{selectedAccountData.username}
				</span>
			{/if}
		</span>
		<span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
			<ChevronDown class="h-4 w-4 text-gray-400 dark:text-gray-500 theme-lightsout:text-gray-600" />
		</span>
	</button>

	{#if isOpen}
		<ul
			class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-base shadow-lg focus:outline-none dark:border-gray-700 dark:bg-[#192734] theme-lightsout:border-gray-800 theme-lightsout:bg-[#111111] sm:text-sm"
			role="listbox"
		>
			<!-- All Accounts Option -->
			<li
				class="relative cursor-pointer select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700 theme-lightsout:text-gray-100 theme-lightsout:hover:bg-gray-900"
				role="option"
				aria-selected={selectedAccount === 'all'}
				on:click={() => selectAccount('all')}
			>
				<div class="flex items-center">
					<span class="ml-3 block truncate font-normal">All Accounts</span>
				</div>
				{#if selectedAccount === 'all'}
					<span class="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600 dark:text-blue-400 theme-lightsout:text-blue-300">
						<Check class="h-4 w-4" />
					</span>
				{/if}
			</li>

			<!-- Individual Accounts -->
			{#each accounts as account (account.id)}
				<li
					class="relative cursor-pointer select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700 theme-lightsout:text-gray-100 theme-lightsout:hover:bg-gray-900"
					role="option"
					aria-selected={selectedAccount === account.id}
					on:click={() => selectAccount(account.id)}
				>
					<div class="flex items-center">
						{#if account.avatarUrl}
							<img
								src={account.avatarUrl}
								alt={account.displayName}
								class="h-5 w-5 flex-shrink-0 rounded-full"
							/>
						{/if}
						<span class="ml-3 block truncate font-normal">
							{account.displayName}
						</span>
						<span class="ml-2 block truncate text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">
							@{account.username}
						</span>
					</div>
					{#if selectedAccount === account.id}
						<span class="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600 dark:text-blue-400 theme-lightsout:text-blue-300">
							<Check class="h-4 w-4" />
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	/* Ensure dropdown appears above other elements */
	.account-dropdown {
		z-index: 10;
	}
</style>
