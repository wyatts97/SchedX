<script lang="ts">
	import { Switch } from 'bits-ui';

	let {
		checked = $bindable(),
		name,
		id,
		disabled,
		onchange,
		'aria-label': ariaLabel
	}: {
		checked?: boolean;
		name?: string;
		id?: string;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
		'aria-label'?: string;
	} = $props();
</script>

<!-- Controlled so an unset (undefined) option can still be bound. -->
<Switch.Root
	checked={checked ?? false}
	{name}
	{id}
	{disabled}
	aria-label={ariaLabel}
	value="on"
	onCheckedChange={(v) => {
		checked = v;
		onchange?.(v);
	}}
	class="relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-line-strong bg-surface-2 transition-colors disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-accent"
>
	<Switch.Thumb
		class="pointer-events-none block size-4.5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.05rem]"
	/>
</Switch.Root>
