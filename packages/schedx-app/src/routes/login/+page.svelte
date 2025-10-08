<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AppIcon from '$lib/components/AppIcon.svelte';
	import { LogIn, Eye, EyeOff } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import logger from '$lib/logger';

	let username = '';
	let password = '';
	let showPassword = false;
	let loading = false;
	let error = '';

	onMount(() => {
		// Initialize Preline components
		if (browser) {
			const initPreline = () => {
				if (typeof window !== 'undefined' && window.HSStaticMethods) {
					logger.debug('Initializing Login page Preline components...');
					window.HSStaticMethods.autoInit();
				}
			};

			// Try multiple times to ensure Preline is loaded
			setTimeout(initPreline, 100);
			setTimeout(initPreline, 500);
			setTimeout(initPreline, 1000);
		}

		// Redirect if already authenticated
		if ($page.data.isAuthenticated) {
			goto('/');
		}
	});

	async function handleLogin() {
		if (!username || !password) {
			error = 'Please enter both username and password';
			return;
		}

		loading = true;
		error = '';

		try {
			const formData = new FormData();
			formData.append('username', username);
			formData.append('password', password);

			const response = await fetch('/api/login', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (response.ok) {
				// Redirect to dashboard on success
				window.location.href = '/';
			} else {
				error = result.error || 'Login failed';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	function togglePassword() {
		showPassword = !showPassword;
	}
</script>

<svelte:head>
	<title>SchedX - Login</title>
	<meta name="description" content="Sign in to SchedX to manage your scheduled tweets" />
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
	<div class="w-full max-w-md">
		<!-- Login Card -->
		<div
			class="rounded-lg border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-gray-800"
		>
			<!-- Header -->
			<div class="mb-8 text-center">
				<div class="mb-4 flex justify-center">
					<AppIcon className="w-16 h-16" />
				</div>
				<h1 class="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Welcome to SchedX</h1>
				<p class="theme-lightsout:text-white text-gray-600 dark:text-gray-400">
					Sign in to manage your scheduled tweets
				</p>
			</div>

			<!-- Login Form -->
			<form on:submit|preventDefault={handleLogin} class="space-y-6">
				<!-- Username Field -->
				<div>
					<label
						for="username"
						class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
					>
						Username
					</label>
					<input
						id="username"
						type="text"
						bind:value={username}
						class="block w-full rounded-lg border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
						placeholder="Enter your username"
						required
						disabled={loading}
					/>
				</div>

				<!-- Password Field -->
				<div>
					<label
						for="password"
						class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
					>
						Password
					</label>
					<div class="relative">
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							class="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
							placeholder="Enter your password"
							required
							disabled={loading}
						/>
						<button
							type="button"
							on:click={togglePassword}
							class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
							disabled={loading}
						>
							{#if showPassword}
								<EyeOff class="h-5 w-5" />
							{:else}
								<Eye class="h-5 w-5" />
							{/if}
						</button>
					</div>
				</div>

				<!-- Error Message -->
				{#if error}
					<div
						class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
					>
						<span>{error}</span>
					</div>
				{/if}

				<!-- Submit Button -->
				<button
					type="submit"
					class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={loading}
				>
					{#if loading}
						<span
							class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
						></span>
					{:else}
						<LogIn class="h-5 w-5" />
					{/if}
					{loading ? 'Signing in...' : 'Sign In'}
				</button>
			</form>

			<!-- Demo Credentials -->
			<div class="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
				<h3
					class="theme-lightsout:text-white mb-2 text-sm font-medium text-gray-700 dark:text-gray-300"
				>
					Demo Credentials
				</h3>
				<div class="theme-lightsout:text-white space-y-1 text-xs text-gray-600 dark:text-gray-400">
					<p><strong>Username:</strong> admin</p>
					<p><strong>Password:</strong> changeme</p>
				</div>
			</div>
		</div>
	</div>
</div>
