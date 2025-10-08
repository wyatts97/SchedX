const API_BASE_PATH = '/api';

export const API = {
	// Twitter Apps
	TWITTER_APPS: `${API_BASE_PATH}/twitter_apps`,
	TWITTER_APP_BY_ID: (id: string) => `${API_BASE_PATH}/twitter_apps/${id}`,
	TEST_TWITTER_APP_CONNECTION: `${API_BASE_PATH}/twitter_apps/test-connection`,

	// Admin
	ADMIN_ANALYTICS: `${API_BASE_PATH}/admin/analytics`,
	ADMIN_TWEETS: `${API_BASE_PATH}/admin/tweets`,
	ADMIN_PROFILE: `${API_BASE_PATH}/admin/profile`,
	ADMIN_CHANGE_PASSWORD: `${API_BASE_PATH}/admin/change-password`,

	// Auth
	AUTH_SIGNIN_TWITTER: `${API_BASE_PATH}/auth/signin/twitter`
};
