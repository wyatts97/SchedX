<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import 'air-datepicker/air-datepicker.css';

	export let value: string = '';
	export let label: string = 'Select Date & Time';
	export let disabled: boolean = false;
	export let placeholder: string = 'Choose date and time';

	const dispatch = createEventDispatcher();

	let inputEl: HTMLInputElement;
	let datepickerInstance: any = null;

	// Handle manual open for mobile touch events
	function handleInputClick() {
		if (datepickerInstance && !disabled) {
			datepickerInstance.show();
		}
	}

	onMount(async () => {
		if (browser && inputEl) {
			try {
				// Dynamically import Air Datepicker and English locale
				const [AirDatepicker, localeEn] = await Promise.all([
					import('air-datepicker'),
					import('air-datepicker/locale/en')
				]);

				// Detect if mobile device
				const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

				// Create datepicker instance
				datepickerInstance = new AirDatepicker.default(inputEl, {
					locale: localeEn.default,
					timepicker: true,
					dateFormat: 'MMM dd, yyyy',
					timeFormat: 'hh:mm AA',
					position: 'bottom left',
					isMobile: isMobile,
					autoClose: false, // Don't auto-close so users can set both date and time
					buttons: ['clear', 'today', {
						content: 'Done',
						onClick: (dp: any) => {
							dp.hide();
						}
					}],
					onSelect: ({ date }) => {
						if (date) {
							const selectedDate = Array.isArray(date) ? date[0] : date;
							// Store the date with timezone info so the server can interpret it correctly
							// Format: ISO string with the user's timezone offset preserved
							const tzOffset = -selectedDate.getTimezoneOffset();
							const tzHours = Math.floor(Math.abs(tzOffset) / 60).toString().padStart(2, '0');
							const tzMins = (Math.abs(tzOffset) % 60).toString().padStart(2, '0');
							const tzSign = tzOffset >= 0 ? '+' : '-';
							
							// Create ISO-like string with local time and timezone offset
							const year = selectedDate.getFullYear();
							const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
							const day = selectedDate.getDate().toString().padStart(2, '0');
							const hours = selectedDate.getHours().toString().padStart(2, '0');
							const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
							const seconds = selectedDate.getSeconds().toString().padStart(2, '0');
							
							// Format: 2024-12-11T19:10:00-06:00 (preserves local time with offset)
							value = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzSign}${tzHours}:${tzMins}`;
							dispatch('change', value);
						}
					}
				});

				// For mobile: add touch event listener to ensure picker opens
				if (isMobile) {
					inputEl.addEventListener('touchstart', handleInputClick, { passive: true });
				}
			} catch (error) {
				console.error('Error initializing datepicker:', error);
			}
		}
	});

	onDestroy(() => {
		if (datepickerInstance) {
			datepickerInstance.destroy();
		}
		if (inputEl) {
			inputEl.removeEventListener('touchstart', handleInputClick);
		}
	});
</script>

<div class="flex-1">
	<label for="datepicker-input" class="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
		{label}
	</label>
	
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<input
		id="datepicker-input"
		type="text"
		bind:this={inputEl}
		{disabled}
		{placeholder}
		class="block w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:focus:border-blue-500"
		readonly
		on:click={handleInputClick}
	/>
</div>
