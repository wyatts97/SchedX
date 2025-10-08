import { writable } from 'svelte/store';
import type {
	DashboardState,
	TwitterApp,
	Tweet,
	UserAccount,
	DashboardAnalytics
} from '$lib/types';

function createDashboardStore() {
	const initialState: DashboardState = {
		isLoading: false,
		error: null,
		lastUpdated: undefined,
		data: {
			apps: [],
			analytics: {
				totalTweets: 0,
				scheduledTweets: 0,
				postedTweets: 0,
				failedTweets: 0,
				draftTweets: 0,
				totalAccounts: 0,
				activeApps: 0,
				recentActivity: []
			},
			tweets: [],
			accounts: []
		},
		ui: {
			showAppForm: false,
			editingApp: null,
			selectedTab: 'overview',
			filters: {}
		}
	};

	const { subscribe, set, update } = writable<DashboardState>(initialState);

	const setLoading = (loading: boolean) => {
		update((state) => ({ ...state, isLoading: loading }));
	};

	const setError = (error: string | null) => {
		update((state) => ({ ...state, error, isLoading: false }));
	};

	const setData = (data: Partial<DashboardState['data']>) => {
		update((state) => ({
			...state,
			data: { ...state.data, ...data },
			isLoading: false,
			error: null,
			lastUpdated: new Date()
		}));
	};

	const openAppForm = (app: TwitterApp | null = null) => {
		update((state) => ({
			...state,
			ui: {
				...state.ui,
				showAppForm: true,
				editingApp: app
			}
		}));
	};

	const closeAppForm = () => {
		update((state) => ({
			...state,
			ui: {
				...state.ui,
				showAppForm: false,
				editingApp: null
			}
		}));
	};

	const setSelectedTab = (tab: string) => {
		update((state) => ({
			...state,
			ui: {
				...state.ui,
				selectedTab: tab
			}
		}));
	};

	const updateApp = (updatedApp: TwitterApp) => {
		update((state) => ({
			...state,
			data: {
				...state.data,
				apps: state.data.apps.map((app) => (app.id === updatedApp.id ? updatedApp : app))
			}
		}));
	};

	const removeApp = (appId: string) => {
		update((state) => ({
			...state,
			data: {
				...state.data,
				apps: state.data.apps.filter((app) => app.id !== appId)
			}
		}));
	};

	const addApp = (newApp: TwitterApp) => {
		update((state) => ({
			...state,
			data: {
				...state.data,
				apps: [...state.data.apps, newApp]
			}
		}));
	};

	const reset = () => {
		set(initialState);
	};

	return {
		subscribe,
		set,
		update,
		setLoading,
		setError,
		setData,
		openAppForm,
		closeAppForm,
		setSelectedTab,
		updateApp,
		removeApp,
		addApp,
		reset
	};
}

export const dashboardStore = createDashboardStore();

// Legacy exports for backward compatibility
export type { TwitterApp, Tweet, UserAccount } from '$lib/types';
export type Analytics = DashboardAnalytics;
