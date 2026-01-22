<script lang="ts">
	import { onMount } from 'svelte';
	import { Sun, Circle, Moon } from 'lucide-svelte';

	let currentTheme = 'light';
	let currentPosition = 0; // 0 = light, 1 = dark, 2 = lightsout
	let isAnimating = false;
	let slideDirection: 'up' | 'down' = 'up';

	const themes = ['light', 'dark', 'lightsout'] as const;
	const themeLabels = {
		light: 'Light mode',
		dark: 'Dark mode',
		lightsout: 'Lights out mode'
	};

	function getCookie(name: string) {
		const value = `; ${document.cookie}`;
		const parts = value.split(`; ${name}=`);
		if (parts.length === 2) return parts.pop()?.split(';').shift();
		return null;
	}
	
	function setCookie(name: string, value: string, days = 365) {
		const expires = new Date(Date.now() + days * 864e5).toUTCString();
		document.cookie = `${name}=${value}; expires=${expires}; path=/`;
	}

	function setTheme(newTheme: string) {
		currentTheme = newTheme;
		if (typeof window !== 'undefined') {
			localStorage.setItem('theme', newTheme);
			setCookie('theme', newTheme);
			const html = document.documentElement;
			// Remove all theme classes
			html.classList.remove('dark', 'theme-dark', 'theme-lightsout');
			if (newTheme === 'light') {
				html.setAttribute('data-theme', 'light');
			} else if (newTheme === 'dark') {
				// Add 'dark' for Tailwind and 'theme-dark' for custom styles
				html.classList.add('dark', 'theme-dark');
				html.setAttribute('data-theme', 'dark');
			} else if (newTheme === 'lightsout') {
				// Add 'dark' for Tailwind and 'theme-lightsout' for custom styles
				html.classList.add('dark', 'theme-lightsout');
				html.setAttribute('data-theme', 'lightsout');
			}
			window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: newTheme } }));
		}
	}

	function cycleTheme() {
		if (isAnimating) return;
		
		isAnimating = true;
		slideDirection = 'up';
		
		// Move to next theme
		const nextPosition = (currentPosition + 1) % 3;
		
		setTimeout(() => {
			currentPosition = nextPosition;
			setTheme(themes[nextPosition]);
			
			setTimeout(() => {
				isAnimating = false;
			}, 200);
		}, 150);
	}

	onMount(() => {
		const savedTheme = getCookie('theme') || localStorage.getItem('theme') || 'light';
		currentTheme = savedTheme;
		
		if (currentTheme === 'light') {
			currentPosition = 0;
		} else if (currentTheme === 'dark') {
			currentPosition = 1;
		} else if (currentTheme === 'lightsout') {
			currentPosition = 2;
		}
		setTheme(currentTheme);
	});
</script>

<button
	class="theme-toggle-single relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg transition-all hover:bg-gray-100 focus:outline-none dark:hover:bg-gray-700 theme-lightsout:hover:bg-gray-800"
	on:click={cycleTheme}
	title={themeLabels[themes[currentPosition]]}
	aria-label="Toggle theme"
>
	<div class="icon-container" class:slide-out={isAnimating}>
		{#if currentPosition === 0}
			<Sun class="h-4 w-4 text-yellow-500" strokeWidth={2} />
		{:else if currentPosition === 1}
			<Circle class="h-4 w-4 text-blue-500" strokeWidth={2} />
		{:else}
			<Moon class="h-4 w-4 text-gray-400 theme-lightsout:text-white" strokeWidth={2} />
		{/if}
	</div>
</button>

<style>
	.theme-toggle-single {
		flex-shrink: 0;
	}

	.icon-container {
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.15s ease-out, opacity 0.15s ease-out;
	}

	.icon-container.slide-out {
		transform: translateY(-100%);
		opacity: 0;
	}

	.icon-container:not(.slide-out) {
		animation: slide-in 0.2s ease-out;
	}

	@keyframes slide-in {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
</style>
