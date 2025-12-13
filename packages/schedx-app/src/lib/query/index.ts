/**
 * TanStack Query - Exports
 * 
 * Usage in components:
 * ```svelte
 * <script>
 *   import { useAccountsQuery, useDeleteTweetMutation } from '$lib/query';
 *   
 *   const accounts = useAccountsQuery();
 *   const deleteTweet = useDeleteTweetMutation();
 * </script>
 * 
 * {#if accounts.isLoading}
 *   <p>Loading...</p>
 * {:else if accounts.data}
 *   {#each accounts.data.accounts as account}
 *     <p>{account.username}</p>
 *   {/each}
 * {/if}
 * ```
 */

export { queryClient, queryKeys, invalidateQueries } from './queryClient';
export {
	// Queries
	useDashboardQuery,
	useAccountsQuery,
	useAccountStatsQuery,
	useQueuedTweetsQuery,
	useScheduledTweetsQuery,
	useMediaQuery,
	useQueueSettingsQuery,
	// Mutations
	useDeleteTweetMutation,
	useShuffleQueueMutation,
	useReorderQueueMutation,
	useProcessQueueMutation,
	useUploadMediaMutation,
	useDeleteMediaMutation,
	useSyncEngagementMutation,
} from './hooks';
