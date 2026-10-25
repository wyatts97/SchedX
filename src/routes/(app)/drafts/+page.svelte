<script lang="ts">
	import PageHeader from '#lib/components/page-header.svelte';
	import PostCard from '#lib/components/post-card.svelte';
	import EmptyState from '#lib/components/empty-state.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import { usePendingDeletes } from '#lib/components/shell/pending-deletes.svelte.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const pending = usePendingDeletes();
	const drafts = $derived(pending.visible(data.drafts));
</script>

<svelte:head><title>Drafts · SchedX</title></svelte:head>

<PageHeader
	title="Drafts"
	description="Posts you've started but haven't scheduled. Open one to finish and schedule it."
/>

{#if drafts.length}
	<div class="grid grid-cols-1 gap-3">
		{#each drafts as post (post.id)}
			<PostCard {post} tz={data.tz} />
		{/each}
	</div>
{:else}
	<EmptyState
		title="No drafts"
		body="Choose Draft in the composer to keep a post here without a time."
	>
		<Button href="/compose" variant="primary">Write a post</Button>
	</EmptyState>
{/if}
