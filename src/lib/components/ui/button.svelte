<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';

	export const buttonVariants = tv({
		base: 'inline-flex shrink-0 items-center justify-center gap-2 rounded-ctl font-medium whitespace-nowrap transition-colors select-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
		variants: {
			variant: {
				primary: 'bg-accent text-accent-ink hover:bg-accent/90',
				secondary:
					'border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2',
				ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
				danger: 'bg-bad text-white hover:bg-bad/90',
				'danger-ghost': 'text-bad hover:bg-bad-soft',
				link: 'text-accent underline-offset-4 hover:underline'
			},
			size: {
				sm: 'h-8 px-3 text-sm',
				md: 'h-10 px-4 text-sm',
				lg: 'h-11 px-5 text-[0.95rem]',
				icon: 'size-9',
				'icon-sm': 'size-8'
			}
		},
		defaultVariants: { variant: 'secondary', size: 'md' }
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];
</script>

<script lang="ts">
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils.js';

	type Props = (HTMLButtonAttributes & HTMLAnchorAttributes) & {
		variant?: ButtonVariant;
		size?: ButtonSize;
		href?: string;
		ref?: HTMLElement | null;
	};

	let {
		variant,
		size,
		href,
		class: className,
		type = 'button',
		ref = $bindable(null),
		children,
		...rest
	}: Props = $props();
</script>

{#if href}
	<a bind:this={ref} {href} class={cn(buttonVariants({ variant, size }), className)} {...rest}>
		{@render children?.()}
	</a>
{:else}
	<button bind:this={ref} {type} class={cn(buttonVariants({ variant, size }), className)} {...rest}>
		{@render children?.()}
	</button>
{/if}
