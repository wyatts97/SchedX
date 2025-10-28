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
					position: isMobile ? undefined : 'bottom left',
					isMobile: isMobile,
					autoClose: true,
					onSelect: ({ date }) => {
						if (date) {
							const selectedDate = Array.isArray(date) ? date[0] : date;
							value = selectedDate.toISOString();
							dispatch('change', value);
						}
					}
				});
			} catch (error) {
				console.error('Error initializing datepicker:', error);
			}
		}
	});

	onDestroy(() => {
		if (datepickerInstance) {
			datepickerInstance.destroy();
		}
	});
</script>

<div class="flex-1">
	<label for="datepicker-input" class="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
		{label}
	</label>
	
	<input
		id="datepicker-input"
		type="text"
		bind:this={inputEl}
		{disabled}
		{placeholder}
		class="block w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:focus:border-blue-500"
		readonly
	/>
</div>
