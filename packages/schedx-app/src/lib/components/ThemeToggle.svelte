<script lang="ts">
	import { onMount } from 'svelte';
	import { Sun, Circle, Moon } from 'lucide-svelte';

	let currentTheme = 'light';
	let currentPosition = 0; // 0 = light, 1 = dark, 2 = lightsout

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
			html.classList.remove('theme-dark', 'theme-lightsout');
			if (newTheme === 'light') {
				html.setAttribute('data-theme', 'light');
			} else if (newTheme === 'dark') {
				html.classList.add('theme-dark');
				html.setAttribute('data-theme', 'dark');
			} else if (newTheme === 'lightsout') {
				html.classList.add('theme-lightsout');
				html.setAttribute('data-theme', 'lightsout');
			}
			window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: newTheme } }));
		}
	}

	function handleClick(position: number) {
		currentPosition = position;
		if (position === 0) {
			setTheme('light');
		} else if (position === 1) {
			setTheme('dark');
		} else {
			setTheme('lightsout');
		}
	}

	onMount(() => {
		// Get the saved theme from storage
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

<div class="flex items-center gap-1 rounded-full bg-gray-200 p-1 dark:bg-gray-700">
	<!-- Light Mode Button -->
	<button
		class="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 {currentPosition ===
		0
			? 'bg-yellow-500 text-black'
			: 'text-yellow-500 hover:bg-yellow-500/20'}"
		on:click={() => handleClick(0)}
		title="Light mode"
		aria-label="Switch to light mode"
		data-hs-theme-click-value="light"
	>
		<Sun class="h-4 w-4" />
	</button>

	<!-- Dark Mode Button (Twitter blue) -->
	<button
		class="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 {currentPosition ===
		1
			? 'bg-blue-500 text-white'
			: 'text-blue-500 hover:bg-blue-500/20'}"
		on:click={() => handleClick(1)}
		title="Dark mode (blue)"
		aria-label="Switch to dark mode"
		data-hs-theme-click-value="dark"
	>
		<Circle class="h-4 w-4" />
	</button>

	<!-- Lightsout Mode Button (true black) -->
	<button
		class="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 {currentPosition ===
		2
			? 'bg-gray-900 text-white'
			: 'text-gray-900 hover:bg-gray-900/20'}"
		on:click={() => handleClick(2)}
		title="Lightsout mode (black)"
		aria-label="Switch to lightsout mode"
		data-hs-theme-click-value="lightsout"
	>
		<Moon class="h-4 w-4" />
	</button>
</div>
