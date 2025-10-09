export interface NavigationItem {
	href: string;
	label: string;
	icon: string;
	description?: string;
}

export interface NavigationConfig {
	main: NavigationItem[];
	mobile: NavigationItem[];
}

export const navigationConfig: NavigationConfig = {
	main: [
		{
			href: '/',
			label: 'Dashboard',
			icon: `<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />`,
			description: 'Overview and analytics'
		},
		{
			href: '/post',
			label: 'Post',
			icon: `<path d="M12 5v14" /><path d="M5 12h14" />`,
			description: 'Create and schedule tweets'
		},
		{
			href: '/thread',
			label: 'Thread',
			icon: `<line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /><line x1="4" y1="7" x2="4" y2="11" /><line x1="4" y1="13" x2="4" y2="17" />`,
			description: 'Create tweet threads'
		},
		{
			href: '/scheduled',
			label: 'Scheduled',
			icon: `<circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />`,
			description: 'View scheduled tweets'
		},
		{
			href: '/drafts',
			label: 'Drafts',
			icon: `<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14,2 14,8 20,8" />`,
			description: 'Manage draft tweets'
		},
		{
			href: '/queue',
			label: 'Queue',
			icon: `<path d="M3 12h18" /><path d="M3 6h18" /><path d="M3 18h18" />`,
			description: 'Auto-schedule queued tweets'
		},
		{
			href: '/templates',
			label: 'Templates',
			icon: `<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14,2 14,8 20,8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10,9 9,9 8,9" />`,
			description: 'Tweet templates'
		},
		{
			href: '/gallery',
			label: 'Gallery',
			icon: `<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />`,
			description: 'View uploaded media'
		},
		{
			href: '/history',
			label: 'History',
			icon: `<path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />`,
			description: 'View tweet history'
		}
	],
	mobile: [
		{
			href: '/',
			label: 'Dashboard',
			icon: `<rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" /><path d="M3 9h18" /><path d="M9 21V9" />`
		},
		{
			href: '/queue',
			label: 'Queue',
			icon: `<path d="M3 12h18" /><path d="M3 6h18" /><path d="M3 18h18" />`
		},
		{
			href: '/drafts',
			label: 'Drafts',
			icon: `<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14,2 14,8 20,8" />`
		},
		{
			href: '/thread',
			label: 'Thread',
			icon: `<line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /><line x1="4" y1="7" x2="4" y2="11" /><line x1="4" y1="13" x2="4" y2="17" />`
		},
		{
			href: '/scheduled',
			label: 'Scheduled',
			icon: `<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" /><polyline points="12,6 12,12 16,14" />`
		},
		{
			href: '/history',
			label: 'History',
			icon: `<path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />`
		}
	]
};
