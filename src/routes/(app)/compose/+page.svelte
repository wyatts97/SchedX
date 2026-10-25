<script lang="ts">
	import Composer from '#lib/components/composer/composer.svelte';
	import PageHeader from '#lib/components/page-header.svelte';
	import EmptyState from '#lib/components/empty-state.svelte';
	import Button from '#lib/components/ui/button.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const editing = $derived(!!data.post);
	const readOnly = $derived(
		data.post && !['draft', 'scheduled', 'failed', 'paused', 'missed'].includes(data.post.status)
	);
</script>

<svelte:head><title>{editing ? 'Edit post' : 'New post'} · SchedX</title></svelte:head>

<PageHeader title={editing ? 'Edit post' : 'New post'} />

{#if data.accounts.length === 0}
	<EmptyState
		title="Connect an X account first"
		body="You need at least one connected account to write a post."
	>
		<Button href="/accounts" variant="primary">Connect account</Button>
	</EmptyState>
{:else if readOnly}
	<EmptyState
		title="This post can't be edited"
		body="It's already published or being published. Duplicate it to post a new copy."
	/>
{:else}
	{#key data.post?.id ?? 'new'}
		<Composer
			accounts={data.accounts}
			tz={data.tz}
			rates={data.rates}
			initial={data.post}
			prefill={data.prefill}
		/>
	{/key}
{/if}
