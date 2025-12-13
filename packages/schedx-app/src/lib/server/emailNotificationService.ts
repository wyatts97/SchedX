/**
 * Email Notification Service
 * Sends email notifications for tweet events using Resend API
 */

import { getDbInstance, getRawDbInstance } from './db';
import logger from './logger';

export type NotificationType = 
	| 'tweet_posted'
	| 'tweet_failed'
	| 'tweet_retry'
	| 'token_expired'
	| 'rate_limit_warning'
	| 'max_retries_exceeded';

export interface EmailNotification {
	type: NotificationType;
	userId: string;
	subject: string;
	body: string;
	metadata?: Record<string, any>;
}

interface ResendSettings {
	apiKey: string;
	fromEmail: string;
	fromName: string;
	enabled: boolean;
}

interface EmailPreferences {
	enabled: boolean;
	email: string | null;
	onSuccess: boolean;
	onFailure: boolean;
}

export class EmailNotificationService {
	private static instance: EmailNotificationService;

	private constructor() {}

	public static getInstance(): EmailNotificationService {
		if (!EmailNotificationService.instance) {
			EmailNotificationService.instance = new EmailNotificationService();
		}
		return EmailNotificationService.instance;
	}

	/**
	 * Send an email notification if enabled
	 */
	public async sendNotification(notification: EmailNotification): Promise<boolean> {
		try {
			const db = getDbInstance();
			const rawDb = getRawDbInstance();

			// Get user's email preferences
			const preferences = await db.getEmailNotificationPreferences(notification.userId) as EmailPreferences | null;
			
			if (!preferences?.enabled || !preferences.email) {
				logger.debug({ userId: notification.userId }, 'Email notifications disabled or no email set');
				return false;
			}

			// Check notification type preferences
			const isSuccessType = ['tweet_posted'].includes(notification.type);
			const isFailureType = ['tweet_failed', 'tweet_retry', 'token_expired', 'rate_limit_warning', 'max_retries_exceeded'].includes(notification.type);

			if (isSuccessType && !preferences.onSuccess) {
				logger.debug({ type: notification.type }, 'Success notifications disabled');
				return false;
			}

			if (isFailureType && !preferences.onFailure) {
				logger.debug({ type: notification.type }, 'Failure notifications disabled');
				return false;
			}

			// Get Resend settings
			const resendSettings = rawDb.queryOne(
				'SELECT * FROM resend_settings WHERE userId = ? AND enabled = 1',
				[notification.userId]
			) as ResendSettings | null;

			if (!resendSettings?.apiKey) {
				logger.debug({ userId: notification.userId }, 'Resend API key not configured');
				return false;
			}

			// Send email via Resend API
			const response = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${resendSettings.apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					from: `${resendSettings.fromName} <${resendSettings.fromEmail}>`,
					to: preferences.email,
					subject: notification.subject,
					html: this.generateEmailHtml(notification)
				})
			});

			if (!response.ok) {
				const error = await response.text();
				logger.error({ error, status: response.status }, 'Failed to send email via Resend');
				return false;
			}

			logger.info({ 
				type: notification.type, 
				to: preferences.email 
			}, 'Email notification sent successfully');

			return true;
		} catch (error) {
			logger.error({ error }, 'Error sending email notification');
			return false;
		}
	}

	/**
	 * Generate HTML email content
	 */
	private generateEmailHtml(notification: EmailNotification): string {
		const iconMap: Record<NotificationType, string> = {
			tweet_posted: '✅',
			tweet_failed: '❌',
			tweet_retry: '🔄',
			token_expired: '🔑',
			rate_limit_warning: '⚠️',
			max_retries_exceeded: '🚫'
		};

		const colorMap: Record<NotificationType, string> = {
			tweet_posted: '#10B981',
			tweet_failed: '#EF4444',
			tweet_retry: '#F59E0B',
			token_expired: '#F59E0B',
			rate_limit_warning: '#F59E0B',
			max_retries_exceeded: '#EF4444'
		};

		const icon = iconMap[notification.type] || '📧';
		const color = colorMap[notification.type] || '#6B7280';

		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${notification.subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
	<div style="background: linear-gradient(135deg, #1DA1F2 0%, #0D8BD9 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
		<h1 style="color: white; margin: 0; font-size: 24px;">SchedX</h1>
		<p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Tweet Scheduler</p>
	</div>
	
	<div style="background: #ffffff; padding: 30px; border: 1px solid #E5E7EB; border-top: none;">
		<div style="text-align: center; margin-bottom: 20px;">
			<span style="font-size: 48px;">${icon}</span>
		</div>
		
		<h2 style="color: ${color}; text-align: center; margin: 0 0 20px 0;">${notification.subject}</h2>
		
		<div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
			${notification.body}
		</div>
		
		${notification.metadata ? this.renderMetadata(notification.metadata) : ''}
		
		<hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
		
		<p style="color: #9CA3AF; font-size: 12px; text-align: center; margin: 0;">
			This is an automated notification from SchedX.<br>
			You can manage your notification preferences in Settings.
		</p>
	</div>
	
	<div style="background: #F3F4F6; padding: 15px; border-radius: 0 0 12px 12px; text-align: center;">
		<p style="color: #6B7280; font-size: 12px; margin: 0;">
			© ${new Date().getFullYear()} SchedX. All rights reserved.
		</p>
	</div>
</body>
</html>`;
	}

	/**
	 * Render metadata as HTML table
	 */
	private renderMetadata(metadata: Record<string, any>): string {
		const rows = Object.entries(metadata)
			.filter(([_, value]) => value !== undefined && value !== null)
			.map(([key, value]) => `
				<tr>
					<td style="padding: 8px; border-bottom: 1px solid #E5E7EB; color: #6B7280; font-size: 14px;">${this.formatKey(key)}</td>
					<td style="padding: 8px; border-bottom: 1px solid #E5E7EB; font-size: 14px;">${this.formatValue(value)}</td>
				</tr>
			`).join('');

		if (!rows) return '';

		return `
			<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
				<tbody>${rows}</tbody>
			</table>
		`;
	}

	/**
	 * Format metadata key for display
	 */
	private formatKey(key: string): string {
		return key
			.replace(/([A-Z])/g, ' $1')
			.replace(/^./, str => str.toUpperCase())
			.trim();
	}

	/**
	 * Format metadata value for display
	 */
	private formatValue(value: any): string {
		if (value instanceof Date) {
			return value.toLocaleString();
		}
		if (typeof value === 'boolean') {
			return value ? 'Yes' : 'No';
		}
		if (typeof value === 'object') {
			return JSON.stringify(value);
		}
		return String(value);
	}

	// Convenience methods for specific notification types

	/**
	 * Notify that a tweet was posted successfully
	 */
	public async notifyTweetPosted(userId: string, tweetId: string, content: string, tweetUrl?: string): Promise<void> {
		await this.sendNotification({
			type: 'tweet_posted',
			userId,
			subject: 'Tweet Posted Successfully',
			body: `<p>Your scheduled tweet has been posted successfully!</p>
				   <blockquote style="border-left: 4px solid #1DA1F2; padding-left: 15px; margin: 15px 0; color: #4B5563;">
					   ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}
				   </blockquote>
				   ${tweetUrl ? `<p><a href="${tweetUrl}" style="color: #1DA1F2;">View on Twitter →</a></p>` : ''}`,
			metadata: {
				tweetId,
				postedAt: new Date().toISOString()
			}
		});
	}

	/**
	 * Notify that a tweet failed to post
	 */
	public async notifyTweetFailed(userId: string, tweetId: string, content: string, error: string, retryCount?: number, maxRetries?: number): Promise<void> {
		const willRetry = retryCount !== undefined && maxRetries !== undefined && retryCount < maxRetries;
		
		await this.sendNotification({
			type: willRetry ? 'tweet_retry' : 'tweet_failed',
			userId,
			subject: willRetry ? 'Tweet Posting Failed - Retry Scheduled' : 'Tweet Posting Failed',
			body: `<p>${willRetry ? 'Your tweet failed to post but will be retried automatically.' : 'Your tweet failed to post.'}</p>
				   <blockquote style="border-left: 4px solid #EF4444; padding-left: 15px; margin: 15px 0; color: #4B5563;">
					   ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}
				   </blockquote>
				   <p style="color: #EF4444;"><strong>Error:</strong> ${error}</p>`,
			metadata: {
				tweetId,
				error,
				retryCount: retryCount ?? 0,
				maxRetries: maxRetries ?? 3,
				willRetry
			}
		});
	}

	/**
	 * Notify that max retries have been exceeded
	 */
	public async notifyMaxRetriesExceeded(userId: string, tweetId: string, content: string, lastError: string): Promise<void> {
		await this.sendNotification({
			type: 'max_retries_exceeded',
			userId,
			subject: 'Tweet Failed - Max Retries Exceeded',
			body: `<p>Your tweet has failed after multiple retry attempts and will not be retried again.</p>
				   <blockquote style="border-left: 4px solid #EF4444; padding-left: 15px; margin: 15px 0; color: #4B5563;">
					   ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}
				   </blockquote>
				   <p style="color: #EF4444;"><strong>Last Error:</strong> ${lastError}</p>
				   <p>Please check your Twitter account connection and try scheduling the tweet again.</p>`,
			metadata: {
				tweetId,
				lastError,
				failedAt: new Date().toISOString()
			}
		});
	}

	/**
	 * Notify that an account token has expired
	 */
	public async notifyTokenExpired(userId: string, accountUsername: string): Promise<void> {
		await this.sendNotification({
			type: 'token_expired',
			userId,
			subject: 'Twitter Account Token Expired',
			body: `<p>The access token for your Twitter account <strong>@${accountUsername}</strong> has expired.</p>
				   <p>Please reconnect your account in SchedX settings to continue scheduling tweets.</p>`,
			metadata: {
				account: `@${accountUsername}`,
				expiredAt: new Date().toISOString()
			}
		});
	}

	/**
	 * Notify about rate limit warning
	 */
	public async notifyRateLimitWarning(userId: string, accountUsername: string, resetAt: Date): Promise<void> {
		await this.sendNotification({
			type: 'rate_limit_warning',
			userId,
			subject: 'Twitter Rate Limit Warning',
			body: `<p>Your Twitter account <strong>@${accountUsername}</strong> is approaching the rate limit.</p>
				   <p>Tweet posting may be delayed until the limit resets.</p>`,
			metadata: {
				account: `@${accountUsername}`,
				resetAt: resetAt.toISOString()
			}
		});
	}
}

export const emailNotificationService = EmailNotificationService.getInstance();
