<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { adminProfile, fetchAdminProfile } from '$lib/components/adminProfile';
	import { get } from 'svelte/store';
	import { Mail, ChevronRight } from 'lucide-svelte';

	let loading = true;
	let error = '';

	let profileForm = { username: 'admin', displayName: '', email: '', avatar: '' };
	let profileError = '';
	let profileSuccess = '';

	let passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
	let passwordError = '';
	let passwordSuccess = '';

	let profile = get(adminProfile);
	adminProfile.subscribe((value) => {
		profile = value;
		if (!profileForm.displayName && value.displayName) profileForm.displayName = value.displayName;
		if (!profileForm.email && value.email) profileForm.email = value.email;
		if (!profileForm.avatar && value.avatar) profileForm.avatar = value.avatar;
	});

	onMount(async () => {
		if (browser) {
			const initPreline = () => {
				if (typeof window !== 'undefined' && window.HSStaticMethods) {
					window.HSStaticMethods.autoInit();
				}
			};
			setTimeout(initPreline, 100);
			setTimeout(initPreline, 500);
		}

		loading = true;
		try {
			await fetchAdminProfile();
			const res = await fetch('/api/admin/profile');
			const data = await res.json();
			if (data.profile) {
				profileForm = {
					username: 'admin', // Always set to 'admin' since it can't be changed
					displayName: data.profile.displayName || '',
					email: data.profile.email || '',
					avatar: data.profile.avatar || ''
				};
			}
		} catch (e) {
			error = 'Failed to load profile';
		} finally {
			loading = false;
		}
	});

	async function updateProfile() {
		profileError = '';
		profileSuccess = '';
		try {
			const formData = new FormData();
			formData.append('username', profileForm.username);
			formData.append('displayName', profileForm.displayName);
			formData.append('email', profileForm.email);

			const res = await fetch('/api/admin/profile', { method: 'POST', body: formData });
			const result = await res.json();
			if (result.error) {
				profileError = result.error;
			} else {
				profileSuccess = 'Profile updated successfully';
				await fetchAdminProfile();
			}
		} catch (e) {
			profileError = 'Failed to update profile';
		}
	}

	async function changePassword() {
		passwordError = '';
		passwordSuccess = '';
		if (passwordForm.newPassword !== passwordForm.confirmPassword) {
			passwordError = 'New passwords do not match';
			return;
		}
		try {
			const res = await fetch('/api/admin/change-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(passwordForm)
			});
			const result = await res.json();
			if (result.error) {
				passwordError = result.error;
			} else {
				passwordSuccess = 'Password changed successfully';
				passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
			}
		} catch (e) {
			passwordError = 'Failed to change password';
		}
	}
</script>

<svelte:head>
	<title>Admin Settings</title>
	<meta name="description" content="Manage admin profile and password" />
</svelte:head>

<div class="mx-auto max-w-4xl">
	<h1 class="mb-6 text-3xl font-bold text-gray-900 dark:text-white">Admin Settings</h1>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
			></div>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
			<!-- Profile Settings -->
			<div class="rounded-lg bg-white shadow dark:bg-gray-800">
				<div class="px-4 py-5 sm:p-6">
					<h3 class="mb-6 text-lg font-medium leading-6 text-gray-900 dark:text-white">
						Profile Settings
					</h3>

					{#if profileError}
						<div class="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
							<p class="text-sm text-red-800">{profileError}</p>
						</div>
					{/if}
					{#if profileSuccess}
						<div class="mb-4 rounded-md border border-green-200 bg-green-50 p-4">
							<p class="text-sm text-green-800">{profileSuccess}</p>
						</div>
					{/if}

					<form on:submit|preventDefault={updateProfile} class="space-y-6">
						<div>
							<label
								for="username"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label
							>
							<input
								id="username"
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
								bind:value={profileForm.username}
								disabled
							/>
							<p class="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
								Username cannot be changed
							</p>
						</div>
						<div>
							<label
								for="displayName"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>Display Name</label
							>
							<input
								id="displayName"
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
								bind:value={profileForm.displayName}
								placeholder="Enter display name"
							/>
						</div>
						<div>
							<label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>Email</label
							>
							<input
								id="email"
								type="email"
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
								bind:value={profileForm.email}
								placeholder="Enter email address"
							/>
						</div>
						<div class="pt-4">
							<button
								type="submit"
								class="inline-flex w-full items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
							>
								Update Profile
							</button>
						</div>
					</form>
				</div>
			</div>

			<!-- Change Password -->
			<div class="rounded-lg bg-white shadow dark:bg-gray-800">
				<div class="px-4 py-5 sm:p-6">
					<h3 class="mb-6 text-lg font-medium leading-6 text-gray-900 dark:text-white">
						Change Password
					</h3>

					{#if passwordError}
						<div class="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
							<p class="text-sm text-red-800">{passwordError}</p>
						</div>
					{/if}
					{#if passwordSuccess}
						<div class="mb-4 rounded-md border border-green-200 bg-green-50 p-4">
							<p class="text-sm text-green-800">{passwordSuccess}</p>
						</div>
					{/if}

					<form on:submit|preventDefault={changePassword} class="space-y-6">
						<div>
							<label
								for="currentPassword"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>Current Password</label
							>
							<input
								id="currentPassword"
								type="password"
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
								bind:value={passwordForm.currentPassword}
								required
								placeholder="Enter current password"
							/>
							<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
								Default password is "changeme" if you haven't changed it yet
							</p>
						</div>
						<div>
							<label
								for="newPassword"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>New Password</label
							>
							<input
								id="newPassword"
								type="password"
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
								bind:value={passwordForm.newPassword}
								required
								placeholder="Enter new password"
							/>
						</div>
						<div>
							<label
								for="confirmPassword"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>Confirm New Password</label
							>
							<input
								id="confirmPassword"
								type="password"
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
								bind:value={passwordForm.confirmPassword}
								required
								placeholder="Confirm new password"
							/>
						</div>
						<div class="pt-4">
							<button
								type="submit"
								class="inline-flex w-full items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
							>
								Change Password
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>

		<!-- Email Notifications Card -->
		<div class="mt-8">
			<a
				href="/admin/settings/email"
				class="block rounded-lg bg-white shadow transition-all duration-200 hover:shadow-md dark:bg-gray-800"
			>
				<div class="px-4 py-5 sm:p-6">
					<div class="flex items-center justify-between">
						<div class="flex items-center space-x-4">
							<div
								class="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20"
							>
								<Mail class="h-6 w-6 text-blue-600 dark:text-blue-400" />
							</div>
							<div>
								<h3 class="text-lg font-medium text-gray-900 dark:text-white">
									Email Notifications
								</h3>
								<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Configure email alerts for scheduled tweet events
								</p>
							</div>
						</div>
						<ChevronRight class="h-5 w-5 text-gray-400" />
					</div>
				</div>
			</a>
		</div>
	{/if}
</div>
