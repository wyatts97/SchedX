<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { adminProfile, fetchAdminProfile } from '$lib/components/adminProfile';
	import { get } from 'svelte/store';
	import { Mail, ChevronRight, Sparkles, Upload, User } from 'lucide-svelte';

	let loading = true;
	let error = '';

	let profileForm = { username: '', email: '', avatar: '' };
	let profileError = '';
	let profileSuccess = '';
	let avatarFile: File | null = null;
	let avatarPreview = '';
	let uploadingAvatar = false;

	let passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
	let passwordError = '';
	let passwordSuccess = '';

	let profile = get(adminProfile);
	adminProfile.subscribe((value) => {
		profile = value;
		if (!profileForm.username && value.username) profileForm.username = value.username;
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
					username: data.profile.username || '',
					email: data.profile.email || '',
					avatar: data.profile.avatar || ''
				};
				avatarPreview = data.profile.avatar || '';
			}
		} catch (e) {
			error = 'Failed to load profile';
		} finally {
			loading = false;
		}
	});

	function handleAvatarChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		
		if (file) {
			// Validate file type
			const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
			if (!allowedTypes.includes(file.type)) {
				profileError = 'Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.';
				return;
			}
			
			// Validate file size (2MB)
			if (file.size > 2 * 1024 * 1024) {
				profileError = 'File too large. Maximum size is 2MB.';
				return;
			}
			
			avatarFile = file;
			
			// Create preview
			const reader = new FileReader();
			reader.onload = (e) => {
				avatarPreview = e.target?.result as string;
			};
			reader.readAsDataURL(file);
		}
	}

	async function uploadAvatar() {
		if (!avatarFile) return;
		
		uploadingAvatar = true;
		profileError = '';
		
		try {
			const formData = new FormData();
			formData.append('avatar', avatarFile);
			
			const res = await fetch('/api/admin/avatar/upload', {
				method: 'POST',
				body: formData
			});
			
			const result = await res.json();
			
			if (result.error) {
				profileError = result.error;
			} else {
				profileForm.avatar = result.avatarUrl;
				avatarPreview = result.avatarUrl;
				avatarFile = null;
				profileSuccess = 'Avatar uploaded successfully';
				await fetchAdminProfile();
			}
		} catch (e) {
			profileError = 'Failed to upload avatar';
		} finally {
			uploadingAvatar = false;
		}
	}

	async function updateProfile() {
		profileError = '';
		profileSuccess = '';
		try {
			const formData = new FormData();
			formData.append('username', profileForm.username);
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

					<!-- Avatar Upload -->
					<div class="mb-6">
<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3" for="avatar-upload">
							Profile Avatar
						</label>
						<div class="flex items-center gap-4">
							<!-- Avatar Preview -->
							<div class="flex-shrink-0">
								{#if avatarPreview}
									<img
										src={avatarPreview}
										alt="Avatar"
										class="h-20 w-20 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-700"
									/>
								{:else}
									<div class="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
										<User class="h-10 w-10 text-gray-400" />
									</div>
								{/if}
							</div>
							
							<!-- Upload Button -->
							<div class="flex-1">
								<input
									type="file"
									id="avatar-upload"
									accept="image/jpeg,image/png,image/gif,image/webp"
									on:change={handleAvatarChange}
									class="hidden"
								/>
								<label
									for="avatar-upload"
									class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
								>
									<Upload class="h-4 w-4" />
									Choose Image
								</label>
								{#if avatarFile}
									<button
										type="button"
										on:click={uploadAvatar}
										disabled={uploadingAvatar}
										class="ml-2 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
									>
										{uploadingAvatar ? 'Uploading...' : 'Upload'}
									</button>
								{/if}
								<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
									JPG, PNG, GIF or WebP. Max 2MB.
								</p>
							</div>
						</div>
					</div>

					<form on:submit|preventDefault={updateProfile} class="space-y-6">
						<div>
							<label
								for="username"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label
							>
							<input
								id="username"
								type="text"
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
								bind:value={profileForm.username}
								minlength="3"
								maxlength="20"
								required
								placeholder="Enter username"
							/>
							<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
								3-20 characters (letters, numbers, underscores only)
							</p>
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

		<!-- Settings Cards -->
		<div class="mt-8 space-y-4">
			<!-- Email Notifications Card -->
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

			<!-- Local AI Card -->
			<a
				href="/admin/settings/local-ai"
				class="block rounded-lg bg-white shadow transition-all duration-200 hover:shadow-md dark:bg-gray-800"
			>
				<div class="px-4 py-5 sm:p-6">
					<div class="flex items-center justify-between">
						<div class="flex items-center space-x-4">
							<div
								class="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/20"
							>
								<Sparkles class="h-6 w-6 text-green-600 dark:text-green-400" />
							</div>
							<div>
								<h3 class="text-lg font-medium text-gray-900 dark:text-white">
									Local AI
								</h3>
								<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Configure offline AI model for tweet generation
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
