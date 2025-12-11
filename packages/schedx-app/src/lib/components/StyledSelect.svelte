<script lang="ts">
	import { Check, ChevronDown } from 'lucide-svelte';
	
	export let options: Array<{ value: string; label: string }> = [];
	export let value: string = '';
	export let placeholder: string = 'Select...';
	export let id: string = '';
	
	let isOpen = false;
	
	$: selectedOption = options.find(opt => opt.value === value);
	
	function toggleDropdown() {
		isOpen = !isOpen;
	}
	
	function selectOption(optionValue: string) {
		value = optionValue;
		isOpen = false;
	}
	
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.styled-select')) {
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

<div class="styled-select relative" {id}>
	<button
		type="button"
		on:click={toggleDropdown}
		class="relative w-full cursor-pointer rounded-lg border bg-white py-2 pl-3 pr-10 text-left shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-[#192734] theme-lightsout:border-gray-600 theme-lightsout:bg-[#1a1a1a] sm:text-sm"
		aria-haspopup="listbox"
		aria-expanded={isOpen}
	>
		<span class="block truncate {selectedOption ? 'text-gray-900 dark:text-white theme-lightsout:text-gray-100' : 'text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500'}">
			{selectedOption ? selectedOption.label : placeholder}
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
			{#each options as option (option.value)}
				<li
					class="relative cursor-pointer select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700 theme-lightsout:text-gray-100 theme-lightsout:hover:bg-gray-900"
					role="option"
					aria-selected={value === option.value}
					on:click={() => selectOption(option.value)}
				>
					<span class="block truncate {value === option.value ? 'font-medium' : 'font-normal'}">
						{option.label}
					</span>
					{#if value === option.value}
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
	.styled-select {
		z-index: 10;
	}
</style>
