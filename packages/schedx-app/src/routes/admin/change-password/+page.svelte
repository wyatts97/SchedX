<script lang="ts">
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Lock, Eye, EyeOff } from 'lucide-svelte';

	let currentPassword = '';
	let newPassword = '';
	let confirmPassword = '';
	let showCurrentPassword = false;
	let showNewPassword = false;
	let showConfirmPassword = false;
	let loading = false;
	let isForced = false;

	// Check if this is a forced password change
	async function checkForcedChange() {
		try {
			const response = await fetch('/api/admin/password-status');
			if (response.ok) {
				const data = await response.json();
				isForced = data.requiresChange || false;
			}
		} catch (error) {
			console.error('Failed to check password status:', error);
		}
	}

	checkForcedChange();

	async function handleSubmit() {
		if (newPassword !== confirmPassword) {
			toast.error('New passwords do not match');
			return;
		}

		if (newPassword.length < 8) {
			toast.error('Password must be at least 8 characters long');
			return;
		}

		if (newPassword === 'changeme') {
			toast.error('Please choose a more secure password');
			return;
		}

		loading = true;

		try {
			const response = await fetch('/api/admin/change-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					currentPassword,
					newPassword
				})
			});

			const data = await response.json();

			if (response.ok) {
				toast.success('Password changed successfully');
				setTimeout(() => {
					goto('/');
				}, 1000);
			} else {
				toast.error(data.error || 'Failed to change password');
			}
		} catch (error) {
			toast.error('An error occurred. Please try again.');
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen bg-gray-50 dark:bg-[#15202B] theme-lightsout:bg-black flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<div class="bg-white dark:bg-[#192734] theme-lightsout:bg-gray-900 rounded-lg shadow-lg p-8">
			<div class="flex items-center justify-center mb-6">
				<div class="bg-red-100 dark:bg-red-900/30 theme-lightsout:bg-red-900/20 p-3 rounded-full">
					<Lock class="h-8 w-8 text-red-600 dark:text-red-400 theme-lightsout:text-red-300" />
				</div>
			</div>

			<h1 class="text-2xl font-bold text-center text-gray-900 dark:text-white theme-lightsout:text-gray-100 mb-2">
				{isForced ? 'Password Change Required' : 'Change Password'}
			</h1>
			
			{#if isForced}
				<p class="text-center text-sm text-red-600 dark:text-red-400 theme-lightsout:text-red-300 mb-6">
					You are using the default password. Please change it immediately for security.
				</p>
			{:else}
				<p class="text-center text-sm text-gray-600 dark:text-gray-400 theme-lightsout:text-gray-500 mb-6">
					Update your password to keep your account secure
				</p>
			{/if}

			<form on:submit|preventDefault={handleSubmit} class="space-y-4">
				<!-- Current Password -->
				<div>
					<label for="currentPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 theme-lightsout:text-gray-400 mb-1">
						Current Password
					</label>
					<div class="relative">
						<input
							id="currentPassword"
							type={showCurrentPassword ? 'text' : 'password'}
							bind:value={currentPassword}
							required
							class="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 theme-lightsout:border-gray-700 rounded-lg bg-white dark:bg-gray-800 theme-lightsout:bg-gray-900 text-gray-900 dark:text-white theme-lightsout:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Enter current password"
						/>
						<button
							type="button"
							on:click={() => showCurrentPassword = !showCurrentPassword}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
						>
							{#if showCurrentPassword}
								<EyeOff class="h-5 w-5" />
							{:else}
								<Eye class="h-5 w-5" />
							{/if}
						</button>
					</div>
				</div>

				<!-- New Password -->
				<div>
					<label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 theme-lightsout:text-gray-400 mb-1">
						New Password
					</label>
					<div class="relative">
						<input
							id="newPassword"
							type={showNewPassword ? 'text' : 'password'}
							bind:value={newPassword}
							required
							minlength="8"
							class="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 theme-lightsout:border-gray-700 rounded-lg bg-white dark:bg-gray-800 theme-lightsout:bg-gray-900 text-gray-900 dark:text-white theme-lightsout:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Enter new password (min 8 characters)"
						/>
						<button
							type="button"
							on:click={() => showNewPassword = !showNewPassword}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
						>
							{#if showNewPassword}
								<EyeOff class="h-5 w-5" />
							{:else}
								<Eye class="h-5 w-5" />
							{/if}
						</button>
					</div>
				</div>

				<!-- Confirm Password -->
				<div>
					<label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 theme-lightsout:text-gray-400 mb-1">
						Confirm New Password
					</label>
					<div class="relative">
						<input
							id="confirmPassword"
							type={showConfirmPassword ? 'text' : 'password'}
							bind:value={confirmPassword}
							required
							minlength="8"
							class="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 theme-lightsout:border-gray-700 rounded-lg bg-white dark:bg-gray-800 theme-lightsout:bg-gray-900 text-gray-900 dark:text-white theme-lightsout:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Confirm new password"
						/>
						<button
							type="button"
							on:click={() => showConfirmPassword = !showConfirmPassword}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
						>
							{#if showConfirmPassword}
								<EyeOff class="h-5 w-5" />
							{:else}
								<Eye class="h-5 w-5" />
							{/if}
						</button>
					</div>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
				>
					{loading ? 'Changing Password...' : 'Change Password'}
				</button>

				{#if !isForced}
					<button
						type="button"
						on:click={() => goto('/')}
						class="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 theme-lightsout:bg-gray-800 theme-lightsout:hover:bg-gray-700 text-gray-700 dark:text-gray-300 theme-lightsout:text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
					>
						Cancel
					</button>
				{/if}
			</form>
		</div>
	</div>
</div>
