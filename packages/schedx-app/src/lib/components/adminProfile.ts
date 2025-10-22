import { writable } from 'svelte/store';

export type AdminProfile = {
	username: string;
	email: string;
	avatar: string;
};

export const adminProfile = writable<AdminProfile>({
	username: '',
	email: '',
	avatar: '/avatar.png'
});

export async function fetchAdminProfile() {
	try {
		const response = await fetch('/api/admin/profile');
		const data = await response.json();
		if (data.profile) {
			adminProfile.set({
				username: data.profile.username ?? '',
				email: data.profile.email ?? '',
				avatar: data.profile.avatar ?? '/avatar.png'
			});
		} else {
			adminProfile.set({
				username: '',
				email: '',
				avatar: '/avatar.png'
			});
		}
	} catch (error) {
		// fallback to default
		adminProfile.set({
			username: '',
			email: '',
			avatar: '/avatar.png'
		});
	}
}
