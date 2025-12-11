<script lang="ts">
	import { 
		Users, 
		UserPlus, 
		MessageCircle, 
		Heart, 
		Repeat2, 
		Calendar, 
		BadgeCheck,
		Edit3,
		FileText,
		ExternalLink,
		RefreshCw,
		TrendingUp,
		Percent,
		Send,
		Clock,
		FilePen
	} from 'lucide-svelte';
	import type { UserAccount, Tweet } from '$lib/types';
	import type { AccountStats } from '$lib/types/analytics';

	export let account: UserAccount;
	export let stats: AccountStats | null = null;
	export let tweets: Tweet[] = [];
	export let isLoading = false;

	// Calculate local stats from tweets (fallback when real-time stats not available)
	function getLocalStats(accountId: string) {
		const accountTweets = tweets.filter(t => t.twitterAccountId === accountId);
		return {
			published: accountTweets.filter(t => t.status === 'posted').length,
			scheduled: accountTweets.filter(t => t.status === 'scheduled').length,
			drafts: accountTweets.filter(t => t.status === 'draft').length
		};
	}

	$: localStats = getLocalStats(account.providerAccountId);

	// Format large numbers (e.g., 1234 -> 1.2K)
	function formatNumber(num: number | undefined): string {
		if (num === undefined || num === null) return '0';
		if (num >= 1000000) {
			return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
		}
		if (num >= 1000) {
			return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
		}
		return num.toString();
	}

	// Format date to readable string
	function formatDate(dateStr: string | undefined): string {
		if (!dateStr) return 'Unknown';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}

	// Format account age (e.g., "Joined March 2019")
	function formatAccountAge(dateStr: string | undefined): string {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return '';
		return `Joined ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
	}

	// Get high-resolution profile image URL
	function getHighResProfileImage(url: string | undefined): string {
		if (!url) return '/avatar.png';
		// Twitter profile images can be requested in different sizes
		// Replace _normal or other size suffixes with _400x400 for higher quality
		return url
			.replace(/_normal\./, '_400x400.')
			.replace(/_bigger\./, '_400x400.')
			.replace(/_200x200\./, '_400x400.');
	}

	// Get the best available profile image
	$: profileImageUrl = getHighResProfileImage(stats?.profileImage || account.profileImage);
</script>

<!-- Account Profile Card - Preline Style -->
<div class="group flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:shadow-lg dark:border-gray-700 dark:bg-slate-900 theme-lightsout:border-gray-800 theme-lightsout:bg-black">
	<!-- Card Header with Banner -->
	<div 
		class="relative h-24 rounded-t-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 bg-cover bg-center"
		style={stats?.profileBanner ? `background-image: url('${stats.profileBanner}');` : ''}
	>
		<!-- Profile Image -->
		<div class="absolute -bottom-10 left-4">
			<div class="relative">
				<img
					src={profileImageUrl}
					alt={stats?.displayName || account.displayName || account.username}
					class="h-20 w-20 rounded-full border-4 border-white object-cover shadow-lg dark:border-slate-900 theme-lightsout:border-black"
				/>
				{#if stats?.verified}
					<div class="absolute -right-1 -top-1 rounded-full bg-white p-0.5 dark:bg-slate-900 theme-lightsout:bg-black">
						<BadgeCheck class="h-5 w-5 text-blue-500" />
					</div>
				{/if}
			</div>
		</div>

		<!-- External Link Button -->
		<a
			href="https://x.com/{stats?.username || account.username}"
			target="_blank"
			rel="noopener noreferrer"
			class="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-sm transition-all hover:bg-black/60"
			title="View @{stats?.username || account.username} on X"
		>
			<ExternalLink class="h-3 w-3" />
			<span>View</span>
		</a>
	</div>

	<!-- Card Body -->
	<div class="flex flex-1 flex-col p-4 pt-12">
		<!-- Name & Username -->
		<div class="mb-3">
			<h3 class="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white theme-lightsout:text-gray-100">
				{stats?.displayName || account.displayName || account.username}
				{#if isLoading}
					<RefreshCw class="h-4 w-4 animate-spin text-gray-400" />
				{/if}
			</h3>
			<p class="text-sm text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">
				@{account.username}
			</p>
		</div>

		<!-- Bio (if available) -->
		{#if stats?.bio}
			<p class="mb-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300 theme-lightsout:text-gray-400">
				{stats.bio}
			</p>
		{/if}

		<!-- Account Age -->
		{#if stats?.createdAt}
			<p class="mb-4 flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">
				<Calendar class="h-3 w-3" />
				{formatAccountAge(stats.createdAt)}
			</p>
		{/if}

		<!-- Real-time Stats Grid -->
		{#if stats}
			<div class="mb-4 grid grid-cols-3 gap-3">
				<!-- Followers -->
				<div class="rounded-lg bg-gray-50 p-3 text-center dark:bg-slate-800 theme-lightsout:bg-gray-900">
					<div class="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">
						<Users class="h-3.5 w-3.5" />
					</div>
					<p class="mt-1 text-lg font-bold text-gray-800 dark:text-white theme-lightsout:text-gray-100">
						{formatNumber(stats.followers)}
					</p>
					<p class="text-xs text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">Followers</p>
				</div>

				<!-- Following -->
				<div class="rounded-lg bg-gray-50 p-3 text-center dark:bg-slate-800 theme-lightsout:bg-gray-900">
					<div class="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">
						<UserPlus class="h-3.5 w-3.5" />
					</div>
					<p class="mt-1 text-lg font-bold text-gray-800 dark:text-white theme-lightsout:text-gray-100">
						{formatNumber(stats.following)}
					</p>
					<p class="text-xs text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">Following</p>
				</div>

				<!-- Tweets -->
				<div class="rounded-lg bg-gray-50 p-3 text-center dark:bg-slate-800 theme-lightsout:bg-gray-900">
					<div class="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">
						<MessageCircle class="h-3.5 w-3.5" />
					</div>
					<p class="mt-1 text-lg font-bold text-gray-800 dark:text-white theme-lightsout:text-gray-100">
						{formatNumber(stats.tweetsCount)}
					</p>
					<p class="text-xs text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">Tweets</p>
				</div>
			</div>

			<!-- Engagement Stats (Recent Activity) -->
			<div class="mb-4 rounded-lg border border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100/50 p-3 dark:border-gray-700 dark:from-slate-800 dark:to-slate-800/50 theme-lightsout:border-gray-800 theme-lightsout:from-gray-900 theme-lightsout:to-gray-900/50">
				<div class="mb-2 flex items-center gap-2">
					<TrendingUp class="h-4 w-4 text-green-500" />
					<span class="text-xs font-medium text-gray-600 dark:text-gray-300 theme-lightsout:text-gray-400">
						Recent Engagement ({stats.recentTweets} tweets)
					</span>
				</div>
				<div class="grid grid-cols-4 gap-2 text-center">
					<div>
						<div class="flex items-center justify-center gap-1">
							<Heart class="h-3 w-3 text-red-500" />
							<span class="text-sm font-semibold text-gray-800 dark:text-white theme-lightsout:text-gray-100">
								{formatNumber(stats.totalLikes)}
							</span>
						</div>
						<p class="text-[10px] text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">Likes</p>
					</div>
					<div>
						<div class="flex items-center justify-center gap-1">
							<Repeat2 class="h-3 w-3 text-green-500" />
							<span class="text-sm font-semibold text-gray-800 dark:text-white theme-lightsout:text-gray-100">
								{formatNumber(stats.totalRetweets)}
							</span>
						</div>
						<p class="text-[10px] text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">Retweets</p>
					</div>
					<div>
						<div class="flex items-center justify-center gap-1">
							<MessageCircle class="h-3 w-3 text-blue-500" />
							<span class="text-sm font-semibold text-gray-800 dark:text-white theme-lightsout:text-gray-100">
								{formatNumber(stats.totalReplies)}
							</span>
						</div>
						<p class="text-[10px] text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">Replies</p>
					</div>
					<div>
						<div class="flex items-center justify-center gap-1">
							<Percent class="h-3 w-3 text-purple-500" />
							<span class="text-sm font-semibold text-gray-800 dark:text-white theme-lightsout:text-gray-100">
								{stats.engagementRate?.toFixed(1) || '0'}%
							</span>
						</div>
						<p class="text-[10px] text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">Eng. Rate</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- SchedX Stats -->
		<div class="schedx-activity-card mb-4 rounded-lg border border-blue-100 bg-gradient-to-r from-blue-50 to-blue-100/50 p-3 dark:border-blue-900/50 dark:from-blue-950/30 dark:to-blue-900/20">
			<div class="mb-2 flex items-center gap-2">
				<svg class="schedx-icon h-4 w-4 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
				</svg>
				<span class="schedx-label text-xs font-medium text-blue-700 dark:text-blue-300">
					SchedX Activity
				</span>
			</div>
			<div class="grid grid-cols-3 gap-2 text-center">
				<div>
					<div class="flex items-center justify-center gap-1">
						<Send class="h-3 w-3 text-green-600 dark:text-green-400" />
						<span class="text-sm font-semibold text-gray-800 dark:text-white theme-lightsout:text-gray-100">
							{localStats.published}
						</span>
					</div>
					<p class="text-[10px] text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">Published</p>
				</div>
				<div>
					<div class="flex items-center justify-center gap-1">
						<Clock class="h-3 w-3 text-orange-500" />
						<span class="text-sm font-semibold text-gray-800 dark:text-white theme-lightsout:text-gray-100">
							{localStats.scheduled}
						</span>
					</div>
					<p class="text-[10px] text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">Scheduled</p>
				</div>
				<div>
					<div class="flex items-center justify-center gap-1">
						<FilePen class="h-3 w-3 text-purple-500" />
						<span class="text-sm font-semibold text-gray-800 dark:text-white theme-lightsout:text-gray-100">
							{localStats.drafts}
						</span>
					</div>
					<p class="text-[10px] text-gray-500 dark:text-gray-400 theme-lightsout:text-gray-500">Drafts</p>
				</div>
			</div>
		</div>

		<!-- Spacer to push buttons to bottom -->
		<div class="flex-1"></div>

		<!-- Action Buttons -->
		<div class="mt-auto grid grid-cols-3 gap-2">
			<a
				href="/post?account={account.id}"
				class="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 theme-lightsout:focus:ring-offset-black"
			>
				<Edit3 class="h-4 w-4" />
				<span class="hidden sm:inline">Post</span>
			</a>
			<a
				href="/post?account={account.id}&action=schedule"
				class="flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-600 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 theme-lightsout:focus:ring-offset-black"
			>
				<Calendar class="h-4 w-4" />
				<span class="hidden sm:inline">Schedule</span>
			</a>
			<a
				href="/post?account={account.id}&action=draft"
				class="flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-purple-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 theme-lightsout:focus:ring-offset-black"
			>
				<FileText class="h-4 w-4" />
				<span class="hidden sm:inline">Draft</span>
			</a>
		</div>
	</div>
</div>
