<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Bell, BellOff, Check, X, Smartphone, Monitor, Info, AlertTriangle, Download } from 'lucide-svelte';
	import { 
		isPushSupported, 
		getPermissionStatus, 
		subscribeToPush, 
		unsubscribeFromPush, 
		isSubscribed,
		initializePushNotifications
	} from '$lib/utils/pushNotifications';

	let loading = true;
	let saving = false;
	let error = '';
	let success = '';

	// Push notification state
	let pushSupported = false;
	let permissionStatus: NotificationPermission = 'default';
	let subscribed = false;
	let serverEnabled = false;
	let totalDevices = 0; // Total devices subscribed across all browsers/devices

	// Notification preferences (stored in localStorage for now)
	let preferences = {
		tweetPosted: true,
		tweetFailed: true,
		threadPosted: true,
		upcomingTweets: false
	};

	// PWA install state
	let installPrompt: any = null;
	let isInstalled = false;
	let isStandalone = false;

	onMount(async () => {
		if (browser) {
			// Initialize Preline
			const initPreline = () => {
				if (typeof window !== 'undefined' && window.HSStaticMethods) {
					window.HSStaticMethods.autoInit();
				}
			};
			setTimeout(initPreline, 100);

			// Check push support
			pushSupported = isPushSupported();
			permissionStatus = getPermissionStatus();

			// Check if running as installed PWA
			isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
				(window.navigator as any).standalone === true;
			isInstalled = isStandalone;

			// Listen for install prompt
			window.addEventListener('beforeinstallprompt', (e) => {
				e.preventDefault();
				installPrompt = e;
			});

			// Check server configuration and subscription count
			try {
				const res = await fetch('/api/push?status=true');
				if (res.ok) {
					const data = await res.json();
					serverEnabled = data.enabled;
					totalDevices = data.subscriptionCount || 0;
				}
			} catch (e) {
				console.error('Failed to check push config:', e);
			}

			// Check subscription status with timeout to prevent hanging
			if (pushSupported) {
				try {
					// Set a maximum wait time for subscription check
					const subscriptionCheck = isSubscribed();
					const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000));
					subscribed = await Promise.race([subscriptionCheck, timeout]);
				} catch (e) {
					console.error('Failed to check subscription status:', e);
					subscribed = false;
				}
			}

			// Load preferences from localStorage
			const savedPrefs = localStorage.getItem('pushNotificationPrefs');
			if (savedPrefs) {
				try {
					preferences = { ...preferences, ...JSON.parse(savedPrefs) };
				} catch (e) {
					console.error('Failed to parse preferences:', e);
				}
			}

			loading = false;
		}
	});

	async function handleSubscribe() {
		saving = true;
		error = '';
		success = '';

		try {
			// Initialize service worker first
			await initializePushNotifications();

			const result = await subscribeToPush();
			if (result.success) {
				subscribed = true;
				permissionStatus = getPermissionStatus();
				success = 'Push notifications enabled! You will now receive alerts on this device.';
				
				// Refresh device count
				try {
					const res = await fetch('/api/push?status=true');
					if (res.ok) {
						const data = await res.json();
						totalDevices = data.subscriptionCount || 0;
					}
				} catch (e) {
					console.error('Failed to refresh device count:', e);
				}
			} else {
				error = result.error || 'Failed to enable push notifications';
			}
		} catch (e) {
			error = 'An error occurred while enabling notifications';
			console.error(e);
		} finally {
			saving = false;
		}
	}

	async function handleUnsubscribe() {
		saving = true;
		error = '';
		success = '';

		try {
			const result = await unsubscribeFromPush();
			if (result.success) {
				subscribed = false;
				success = 'Push notifications disabled for this device.';
			} else {
				error = result.error || 'Failed to disable push notifications';
			}
		} catch (e) {
			error = 'An error occurred while disabling notifications';
			console.error(e);
		} finally {
			saving = false;
		}
	}

	function savePreferences() {
		localStorage.setItem('pushNotificationPrefs', JSON.stringify(preferences));
		success = 'Notification preferences saved!';
		setTimeout(() => success = '', 3000);
	}

	async function installApp() {
		if (installPrompt) {
			installPrompt.prompt();
			const { outcome } = await installPrompt.userChoice;
			if (outcome === 'accepted') {
				isInstalled = true;
				installPrompt = null;
				success = 'App installed! You can now receive push notifications.';
			}
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'granted': return 'text-green-600 dark:text-green-400';
			case 'denied': return 'text-red-600 dark:text-red-400';
			default: return 'text-yellow-600 dark:text-yellow-400';
		}
	}

	function getStatusText(status: string): string {
		switch (status) {
			case 'granted': return 'Allowed';
			case 'denied': return 'Blocked';
			default: return 'Not Set';
		}
	}
</script>

<svelte:head>
	<title>Push Notifications - Settings</title>
	<meta name="description" content="Configure push notification settings" />
</svelte:head>

<div class="mx-auto max-w-4xl">
	<div class="mb-6">
		<a
			href="/admin/settings"
			class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
		>
			← Back to Settings
		</a>
	</div>

	<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Push Notifications</h1>
	<p class="mb-6 text-gray-600 dark:text-gray-400">
		Get instant alerts on your device when tweets are posted, fail, or are about to be scheduled.
	</p>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
		</div>
	{:else}
		<!-- Status Messages -->
		{#if error}
			<div class="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
				<div class="flex items-center">
					<X class="mr-2 h-5 w-5 text-red-600 dark:text-red-400" />
					<p class="text-sm text-red-600 dark:text-red-400">{error}</p>
				</div>
			</div>
		{/if}

		{#if success}
			<div class="mb-6 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
				<div class="flex items-center">
					<Check class="mr-2 h-5 w-5 text-green-600 dark:text-green-400" />
					<p class="text-sm text-green-600 dark:text-green-400">{success}</p>
				</div>
			</div>
		{/if}

		<!-- How Push Notifications Work -->
		<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
			<div class="flex items-start">
				<Info class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
				<div>
					<h3 class="font-medium text-blue-800 dark:text-blue-300">How Push Notifications Work</h3>
					<ul class="mt-2 space-y-1 text-sm text-blue-700 dark:text-blue-400">
						<li>• <strong>Desktop browsers</strong>: Works in Chrome, Edge, Firefox, and Safari 16+</li>
						<li>• <strong>Mobile (Android)</strong>: Works in Chrome and other browsers</li>
						<li>• <strong>Mobile (iOS)</strong>: Requires installing SchedX as a PWA (Add to Home Screen) and iOS 16.4+</li>
						<li>• Notifications are sent from the server even when the app is closed</li>
						<li>• Each device needs to be subscribed separately</li>
					</ul>
				</div>
			</div>
		</div>

		<!-- System Status -->
		<div class="mb-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">System Status</h2>
			
			<div class="space-y-4">
				<!-- Browser Support -->
				<div class="flex items-center justify-between">
					<div class="flex items-center">
						<Monitor class="mr-3 h-5 w-5 text-gray-500" />
						<span class="text-gray-700 dark:text-gray-300">Browser Support</span>
					</div>
					<span class={pushSupported ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
						{pushSupported ? '✓ Supported' : '✗ Not Supported'}
					</span>
				</div>

				<!-- Server Configuration -->
				<div class="flex items-center justify-between">
					<div class="flex items-center">
						<Bell class="mr-3 h-5 w-5 text-gray-500" />
						<span class="text-gray-700 dark:text-gray-300">Server Configuration</span>
					</div>
					<span class={serverEnabled ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
						{serverEnabled ? '✓ Configured' : '⚠ VAPID Keys Not Set'}
					</span>
				</div>

				<!-- Permission Status -->
				<div class="flex items-center justify-between">
					<div class="flex items-center">
						<Smartphone class="mr-3 h-5 w-5 text-gray-500" />
						<span class="text-gray-700 dark:text-gray-300">Permission Status</span>
					</div>
					<span class={getStatusColor(permissionStatus)}>
						{getStatusText(permissionStatus)}
					</span>
				</div>

				<!-- Subscription Status -->
				<div class="flex items-center justify-between">
					<div class="flex items-center">
						{#if subscribed}
							<Bell class="mr-3 h-5 w-5 text-green-500" />
						{:else}
							<BellOff class="mr-3 h-5 w-5 text-gray-500" />
						{/if}
						<span class="text-gray-700 dark:text-gray-300">This Device</span>
					</div>
					<span class={subscribed ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
						{subscribed ? '✓ Subscribed' : 'Not Subscribed'}
					</span>
				</div>

				<!-- Total Devices -->
				<div class="flex items-center justify-between">
					<div class="flex items-center">
						<Smartphone class="mr-3 h-5 w-5 text-gray-500" />
						<span class="text-gray-700 dark:text-gray-300">Total Devices Subscribed</span>
					</div>
					<span class={totalDevices > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
						{totalDevices} {totalDevices === 1 ? 'device' : 'devices'}
					</span>
				</div>

				<!-- PWA Status -->
				<div class="flex items-center justify-between">
					<div class="flex items-center">
						<Download class="mr-3 h-5 w-5 text-gray-500" />
						<span class="text-gray-700 dark:text-gray-300">App Installed</span>
					</div>
					<span class={isInstalled ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
						{isInstalled ? '✓ Installed as PWA' : 'Running in Browser'}
					</span>
				</div>
			</div>
		</div>

		<!-- Install PWA Prompt (if not installed and installable) -->
		{#if !isInstalled && installPrompt}
			<div class="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
				<div class="flex items-start justify-between">
					<div class="flex items-start">
						<Download class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400" />
						<div>
							<h3 class="font-medium text-orange-800 dark:text-orange-300">Install SchedX App</h3>
							<p class="mt-1 text-sm text-orange-700 dark:text-orange-400">
								Install SchedX on your device for the best notification experience and offline access.
							</p>
						</div>
					</div>
					<button
						on:click={installApp}
						class="ml-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
					>
						Install
					</button>
				</div>
			</div>
		{/if}

		<!-- iOS Instructions -->
		{#if !isInstalled && browser && /iPhone|iPad|iPod/.test(navigator.userAgent)}
			<div class="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
				<div class="flex items-start">
					<AlertTriangle class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
					<div>
						<h3 class="font-medium text-yellow-800 dark:text-yellow-300">iOS Users: Install Required</h3>
						<p class="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
							To receive push notifications on iOS, you must install SchedX as an app:
						</p>
						<ol class="mt-2 list-inside list-decimal space-y-1 text-sm text-yellow-700 dark:text-yellow-400">
							<li>Tap the <strong>Share</strong> button in Safari</li>
							<li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
							<li>Tap <strong>"Add"</strong> to install</li>
							<li>Open SchedX from your home screen and enable notifications here</li>
						</ol>
					</div>
				</div>
			</div>
		{/if}

		<!-- Server Not Configured Warning -->
		{#if !serverEnabled}
			<div class="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
				<div class="flex items-start">
					<AlertTriangle class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
					<div>
						<h3 class="font-medium text-yellow-800 dark:text-yellow-300">Server Configuration Required</h3>
						<p class="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
							Push notifications require VAPID keys to be configured on the server. Add the following to your <code class="rounded bg-yellow-100 px-1 dark:bg-yellow-900">.env</code> file:
						</p>
						<pre class="mt-2 overflow-x-auto rounded bg-yellow-100 p-2 text-xs dark:bg-yellow-900">
# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:your@email.com</pre>
					</div>
				</div>
			</div>
		{/if}

		<!-- Permission Denied Warning -->
		{#if permissionStatus === 'denied'}
			<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
				<div class="flex items-start">
					<X class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
					<div>
						<h3 class="font-medium text-red-800 dark:text-red-300">Notifications Blocked</h3>
						<p class="mt-1 text-sm text-red-700 dark:text-red-400">
							You have blocked notifications for this site. To enable them:
						</p>
						{#if browser && /Android/i.test(navigator.userAgent)}
							<p class="mt-2 text-sm font-medium text-red-700 dark:text-red-400">On Android:</p>
							<ol class="mt-1 list-inside list-decimal space-y-1 text-sm text-red-700 dark:text-red-400">
								<li>Tap the <strong>three dots menu</strong> (⋮) in Chrome</li>
								<li>Go to <strong>Settings → Site settings → Notifications</strong></li>
								<li>Find this site and change to <strong>Allow</strong></li>
								<li>Alternatively, tap the lock icon in the address bar</li>
								<li>Refresh this page</li>
							</ol>
						{:else}
							<ol class="mt-2 list-inside list-decimal space-y-1 text-sm text-red-700 dark:text-red-400">
								<li>Click the lock/info icon in your browser's address bar</li>
								<li>Find "Notifications" in the permissions</li>
								<li>Change it from "Block" to "Allow"</li>
								<li>Refresh this page</li>
							</ol>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Android PWA Recommendation -->
		{#if !isInstalled && browser && /Android/i.test(navigator.userAgent) && !installPrompt}
			<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
				<div class="flex items-start">
					<Smartphone class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
					<div>
						<h3 class="font-medium text-blue-800 dark:text-blue-300">Tip: Install as App for Best Experience</h3>
						<p class="mt-1 text-sm text-blue-700 dark:text-blue-400">
							For the most reliable push notifications on Android, install SchedX as an app:
						</p>
						<ol class="mt-2 list-inside list-decimal space-y-1 text-sm text-blue-700 dark:text-blue-400">
							<li>Tap the <strong>three dots menu</strong> (⋮) in Chrome</li>
							<li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></li>
							<li>Open SchedX from your home screen</li>
						</ol>
					</div>
				</div>
			</div>
		{/if}

		<!-- Enable/Disable Button -->
		{#if pushSupported && serverEnabled && permissionStatus !== 'denied'}
			<div class="mb-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
				<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
					{subscribed ? 'Manage Subscription' : 'Enable Notifications'}
				</h2>
				
				{#if subscribed}
					<p class="mb-4 text-gray-600 dark:text-gray-400">
						Push notifications are enabled for this device. You will receive alerts when tweets are posted or fail.
					</p>
					<button
						on:click={handleUnsubscribe}
						disabled={saving}
						class="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
					>
						{#if saving}
							<div class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
						{:else}
							<BellOff class="mr-2 h-4 w-4" />
						{/if}
						Disable Notifications
					</button>
				{:else}
					<p class="mb-4 text-gray-600 dark:text-gray-400">
						Enable push notifications to get instant alerts on this device when your scheduled tweets are posted or encounter errors.
					</p>
					<button
						on:click={handleSubscribe}
						disabled={saving}
						class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
					>
						{#if saving}
							<div class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
						{:else}
							<Bell class="mr-2 h-4 w-4" />
						{/if}
						Enable Push Notifications
					</button>
				{/if}
			</div>
		{/if}

		<!-- Notification Preferences -->
		{#if subscribed}
			<div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
				<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Notification Types</h2>
				<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
					Choose which notifications you want to receive:
				</p>

				<div class="space-y-4">
					<label class="flex items-center justify-between">
						<div>
							<span class="font-medium text-gray-700 dark:text-gray-300">Tweet Posted</span>
							<p class="text-sm text-gray-500 dark:text-gray-400">When a scheduled tweet is successfully posted</p>
						</div>
						<input
							type="checkbox"
							bind:checked={preferences.tweetPosted}
							on:change={savePreferences}
							class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
					</label>

					<label class="flex items-center justify-between">
						<div>
							<span class="font-medium text-gray-700 dark:text-gray-300">Tweet Failed</span>
							<p class="text-sm text-gray-500 dark:text-gray-400">When a scheduled tweet fails to post</p>
						</div>
						<input
							type="checkbox"
							bind:checked={preferences.tweetFailed}
							on:change={savePreferences}
							class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
					</label>

					<label class="flex items-center justify-between">
						<div>
							<span class="font-medium text-gray-700 dark:text-gray-300">Thread Posted</span>
							<p class="text-sm text-gray-500 dark:text-gray-400">When a scheduled thread is successfully posted</p>
						</div>
						<input
							type="checkbox"
							bind:checked={preferences.threadPosted}
							on:change={savePreferences}
							class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
					</label>

					<label class="flex items-center justify-between">
						<div>
							<span class="font-medium text-gray-700 dark:text-gray-300">Upcoming Tweets</span>
							<p class="text-sm text-gray-500 dark:text-gray-400">Reminder before a tweet is about to be posted</p>
						</div>
						<input
							type="checkbox"
							bind:checked={preferences.upcomingTweets}
							on:change={savePreferences}
							class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
					</label>
				</div>
			</div>
		{/if}
	{/if}
</div>
