<script lang="ts">
	import '../app.css';
	import { Toaster, toast } from 'svelte-sonner';
	import { updated } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	let announced = false;
	$effect(() => {
		if (updated.current && !announced) {
			announced = true;
			toast('A new version of SchedX is available', {
				duration: Infinity,
				action: { label: 'Reload', onClick: () => location.reload() }
			});
		}
	});
</script>

<Toaster
	position="top-center"
	toastOptions={{
		class: '!bg-raised !text-ink !border-line !shadow-pop !rounded-ctl'
	}}
/>

{@render children()}
