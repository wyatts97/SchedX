<script lang="ts">
	import type { TableColumn, TableAction } from '$lib/types';
	import Button from './Button.svelte';
	import logger from '$lib/logger';

	type T = $$Generic;

	export let data: T[] = [];
	export let columns: TableColumn<T>[] = [];
	export let actions: TableAction<T>[] = [];
	export let loading: boolean = false;
	export let emptyMessage: string = 'No data available';
	export let emptyIcon: any = undefined;

	// Component props
	let className: string = '';
	export { className as class };

	const handleAction = async (action: TableAction<T>, row: T) => {
		if (action.disabled?.(row)) return;

		try {
			await action.onClick(row);
		} catch (error) {
			logger.error('Table action error:', error);
		}
	};

	const renderCell = (column: TableColumn<T>, row: T) => {
		const value = row[column.key];
		return column.render ? column.render(value, row) : String(value ?? '');
	};

	const getAlignmentClass = (align?: 'left' | 'center' | 'right') => {
		switch (align) {
			case 'center':
				return 'text-center';
			case 'right':
				return 'text-right';
			default:
				return 'text-left';
		}
	};
</script>

<div class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800 {className}">
	{#if loading}
		<div class="flex items-center justify-center p-8">
			<div class="flex items-center space-x-3">
				<div
					class="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
				></div>
				<span class="text-sm text-gray-600 dark:text-gray-400">Loading...</span>
			</div>
		</div>
	{:else if data.length === 0}
		<div class="py-12 text-center">
			{#if emptyIcon}
				<svelte:component this={emptyIcon} class="mx-auto h-12 w-12 text-gray-400" />
			{/if}
			<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
				{emptyMessage}
			</h3>
			<slot name="empty-state" />
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-700">
					<tr>
						{#each columns as column}
							<th
								class="px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300 {getAlignmentClass(
									column.align
								)}"
								style={column.width ? `width: ${column.width}` : ''}
							>
								{column.label}
							</th>
						{/each}
						{#if actions.length > 0}
							<th
								class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
							>
								Actions
							</th>
						{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
					{#each data as row, index}
						<tr class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
							{#each columns as column}
								<td
									class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100 {getAlignmentClass(
										column.align
									)}"
									style={column.width ? `width: ${column.width}` : ''}
								>
									{@html renderCell(column, row)}
								</td>
							{/each}
							{#if actions.length > 0}
								<td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
									<div class="flex justify-end space-x-2">
										{#each actions as action}
											<Button
												variant={action.variant || 'ghost'}
												size="sm"
												disabled={action.disabled?.(row)}
												onClick={() => handleAction(action, row)}
												class="text-xs"
											>
												{#if action.icon}
													<svelte:component this={action.icon} class="mr-1 h-3 w-3" />
												{/if}
												{action.label}
											</Button>
										{/each}
									</div>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>
