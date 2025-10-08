import { writable } from 'svelte/store';

export type AdminProfile = {
	username: string;
	displayName: string;
	email: string;
	avatar: string;
};

export const adminProfile = writable<AdminProfile>({
	username: 'admin',
	displayName: 'Admin',
	email: '',
	avatar: '/avatar.png'
});

export async function fetchAdminProfile() {
	try {
		const response = await fetch('/api/admin/profile');
		const data = await response.json();
		if (data.profile) {
			adminProfile.set({
				username: data.profile.username ?? 'admin',
				displayName: data.profile.displayName ?? 'Admin',
				email: data.profile.email ?? '',
				avatar: data.profile.avatar ?? '/avatar.png'
			});
		} else {
			adminProfile.set({
				username: 'admin',
				displayName: 'Admin',
				email: '',
				avatar: '/avatar.png'
			});
		}
	} catch (error) {
		// fallback to default
		adminProfile.set({
			username: 'admin',
			displayName: 'Admin',
			email: '',
			avatar: '/avatar.png'
		});
	}
}
