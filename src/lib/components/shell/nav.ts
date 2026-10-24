import type { Component } from 'svelte';
import House from '@lucide/svelte/icons/house';
import PenSquare from '@lucide/svelte/icons/square-pen';
import CalendarDays from '@lucide/svelte/icons/calendar-days';
import ListOrdered from '@lucide/svelte/icons/list-ordered';
import FileText from '@lucide/svelte/icons/file-text';
import History from '@lucide/svelte/icons/history';
import Images from '@lucide/svelte/icons/images';
import AtSign from '@lucide/svelte/icons/at-sign';

export interface NavItem {
	href: string;
	label: string;
	description: string;
	icon: Component<{ class?: string; strokeWidth?: number }>;
}

const item = (
	href: string,
	label: string,
	description: string,
	icon: NavItem['icon']
): NavItem => ({
	href,
	label,
	description,
	icon
});

export const HOME = item('/', 'Home', 'What is coming up', House);
export const COMPOSE = item('/compose', 'Post', 'Write a post or thread', PenSquare);
export const CALENDAR = item('/calendar', 'Calendar', 'Scheduled posts by date', CalendarDays);
export const QUEUE = item('/queue', 'Queue', 'Posts waiting for a time slot', ListOrdered);
export const DRAFTS = item('/drafts', 'Drafts', 'Posts you have not scheduled', FileText);
export const HISTORY = item('/history', 'History', 'Published and failed posts', History);
export const MEDIA = item('/library', 'Media', 'Uploaded images and video', Images);
export const ACCOUNTS = item('/accounts', 'Accounts', 'Connected X accounts', AtSign);

/** Desktop sidebar, in legacy order. Settings lives in the sidebar footer. */
export const SIDEBAR_NAV = [HOME, COMPOSE, CALENDAR, QUEUE, DRAFTS, HISTORY, MEDIA, ACCOUNTS];

/** Mobile bar: three tabs either side of the raised + button. */
export const MOBILE_LEFT = [HOME, CALENDAR, QUEUE];
export const MOBILE_RIGHT = [DRAFTS, HISTORY, MEDIA];

export function isActive(pathname: string, href: string): boolean {
	return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
