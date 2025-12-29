// Direct REST API implementation - no SDK needed (saves ~30MB by avoiding react/react-dom)

export interface EmailNotificationConfig {
	enabled: boolean;
	provider: 'resend';
	apiKey: string;
	fromEmail: string;
	fromName: string;
}

export interface TweetNotificationData {
	tweetContent: string;
	tweetUrl?: string;
	accountUsername: string;
	accountDisplayName: string;
	scheduledDate: Date;
	postedDate: Date;
	hasMedia: boolean;
	mediaCount?: number;
}

interface ResendApiResponse {
	id?: string;
	error?: {
		message: string;
		name: string;
	};
}

export class EmailService {
	private config: EmailNotificationConfig;

	constructor(config: EmailNotificationConfig) {
		this.config = config;
	}

	/**
	 * Check if email service is enabled and configured
	 */
	isEnabled(): boolean {
		return this.config.enabled && !!this.config.apiKey;
	}

	/**
	 * Send email via Resend REST API
	 */
	private async sendEmail(params: {
		to: string;
		subject: string;
		html: string;
		text: string;
	}): Promise<{ success: boolean; messageId?: string; error?: string }> {
		try {
			const response = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.config.apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					from: `${this.config.fromName} <${this.config.fromEmail}>`,
					to: params.to,
					subject: params.subject,
					html: params.html,
					text: params.text
				})
			});

			const result = await response.json() as ResendApiResponse;

			if (!response.ok || result.error) {
				return { 
					success: false, 
					error: result.error?.message || `HTTP ${response.status}: ${response.statusText}` 
				};
			}

			return { success: true, messageId: result.id };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Send tweet success notification
	 */
	async sendTweetSuccessNotification(
		toEmail: string,
		data: TweetNotificationData
	): Promise<{ success: boolean; messageId?: string; error?: string }> {
		if (!this.isEnabled()) {
			return { success: false, error: 'Email service not enabled' };
		}

		const html = this.generateSuccessEmailHtml(data);
		const text = this.generateSuccessEmailText(data);

		return this.sendEmail({
			to: toEmail,
			subject: `✅ Tweet Posted Successfully - @${data.accountUsername}`,
			html,
			text
		});
	}

	/**
	 * Send tweet failure notification
	 */
	async sendTweetFailureNotification(
		toEmail: string,
		data: TweetNotificationData & { errorMessage: string }
	): Promise<{ success: boolean; messageId?: string; error?: string }> {
		if (!this.isEnabled()) {
			return { success: false, error: 'Email service not enabled' };
		}

		const html = this.generateFailureEmailHtml(data);
		const text = this.generateFailureEmailText(data);

		return this.sendEmail({
			to: toEmail,
			subject: `❌ Tweet Failed to Post - @${data.accountUsername}`,
			html,
			text
		});
	}

	/**
	 * Generate HTML email for success notification
	 */
	private generateSuccessEmailHtml(data: TweetNotificationData): string {
		const tweetPreview = data.tweetContent.length > 200 
			? data.tweetContent.substring(0, 200) + '...' 
			: data.tweetContent;

		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Tweet Posted Successfully</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
	<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
		<tr>
			<td align="center">
				<table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
					<!-- Header -->
					<tr>
						<td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px 8px 0 0;">
							<h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
								✅ Tweet Posted Successfully!
							</h1>
						</td>
					</tr>
					
					<!-- Content -->
					<tr>
						<td style="padding: 40px;">
							<p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.5;">
								Your scheduled tweet has been successfully posted to Twitter/X.
							</p>
							
							<!-- Account Info -->
							<div style="background-color: #f9fafb; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px;">
								<p style="margin: 0 0 8px; color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Account</p>
								<p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">
									${data.accountDisplayName} <span style="color: #6b7280;">@${data.accountUsername}</span>
								</p>
							</div>
							
							<!-- Tweet Content -->
							<div style="background-color: #f9fafb; padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px solid #e5e7eb;">
								<p style="margin: 0 0 8px; color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Tweet Content</p>
								<p style="margin: 0; color: #111827; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">
									${tweetPreview}
								</p>
								${data.hasMedia ? `<p style="margin: 12px 0 0; color: #6b7280; font-size: 14px;">📎 ${data.mediaCount} media file${data.mediaCount! > 1 ? 's' : ''} attached</p>` : ''}
							</div>
							
							<!-- Timing Info -->
							<table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
								<tr>
									<td style="padding: 12px; background-color: #f9fafb; border-radius: 4px;">
										<p style="margin: 0 0 4px; color: #6b7280; font-size: 13px;">Scheduled</p>
										<p style="margin: 0; color: #111827; font-size: 14px; font-weight: 500;">${new Date(data.scheduledDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
									</td>
									<td width="20"></td>
									<td style="padding: 12px; background-color: #f9fafb; border-radius: 4px;">
										<p style="margin: 0 0 4px; color: #6b7280; font-size: 13px;">Posted</p>
										<p style="margin: 0; color: #111827; font-size: 14px; font-weight: 500;">${new Date(data.postedDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
									</td>
								</tr>
							</table>
							
							${data.tweetUrl ? `
							<!-- View Tweet Button -->
							<div style="text-align: center; margin: 30px 0 20px;">
								<a href="${data.tweetUrl}" style="display: inline-block; background-color: #1d9bf0; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 24px; font-weight: 600; font-size: 15px;">
									View Tweet on X/Twitter
								</a>
							</div>
							` : ''}
						</td>
					</tr>
					
					<!-- Footer -->
					<tr>
						<td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center; border-top: 1px solid #e5e7eb;">
							<p style="margin: 0; color: #6b7280; font-size: 13px;">
								This is an automated notification from SchedX
							</p>
							<p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px;">
								You can manage your notification preferences in your account settings
							</p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
		`;
	}

	/**
	 * Generate plain text email for success notification
	 */
	private generateSuccessEmailText(data: TweetNotificationData): string {
		const tweetPreview = data.tweetContent.length > 200 
			? data.tweetContent.substring(0, 200) + '...' 
			: data.tweetContent;

		return `
✅ Tweet Posted Successfully!

Your scheduled tweet has been successfully posted to Twitter/X.

Account: ${data.accountDisplayName} (@${data.accountUsername})

Tweet Content:
${tweetPreview}
${data.hasMedia ? `\n📎 ${data.mediaCount} media file${data.mediaCount! > 1 ? 's' : ''} attached` : ''}

Scheduled: ${new Date(data.scheduledDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
Posted: ${new Date(data.postedDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}

${data.tweetUrl ? `View Tweet: ${data.tweetUrl}` : ''}

---
This is an automated notification from SchedX.
You can manage your notification preferences in your account settings.
		`;
	}

	/**
	 * Generate HTML email for failure notification
	 */
	private generateFailureEmailHtml(data: TweetNotificationData & { errorMessage: string }): string {
		const tweetPreview = data.tweetContent.length > 200 
			? data.tweetContent.substring(0, 200) + '...' 
			: data.tweetContent;

		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Tweet Failed to Post</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
	<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
		<tr>
			<td align="center">
				<table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
					<!-- Header -->
					<tr>
						<td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 8px 8px 0 0;">
							<h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
								❌ Tweet Failed to Post
							</h1>
						</td>
					</tr>
					
					<!-- Content -->
					<tr>
						<td style="padding: 40px;">
							<p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.5;">
								Your scheduled tweet could not be posted to Twitter/X.
							</p>
							
							<!-- Error Message -->
							<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
								<p style="margin: 0 0 8px; color: #991b1b; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Error</p>
								<p style="margin: 0; color: #7f1d1d; font-size: 15px; font-weight: 500;">
									${data.errorMessage}
								</p>
							</div>
							
							<!-- Account Info -->
							<div style="background-color: #f9fafb; border-left: 4px solid #6b7280; padding: 16px; margin: 20px 0; border-radius: 4px;">
								<p style="margin: 0 0 8px; color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Account</p>
								<p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">
									${data.accountDisplayName} <span style="color: #6b7280;">@${data.accountUsername}</span>
								</p>
							</div>
							
							<!-- Tweet Content -->
							<div style="background-color: #f9fafb; padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px solid #e5e7eb;">
								<p style="margin: 0 0 8px; color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Tweet Content</p>
								<p style="margin: 0; color: #111827; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">
									${tweetPreview}
								</p>
								${data.hasMedia ? `<p style="margin: 12px 0 0; color: #6b7280; font-size: 14px;">📎 ${data.mediaCount} media file${data.mediaCount! > 1 ? 's' : ''} attached</p>` : ''}
							</div>
							
							<!-- Timing Info -->
							<div style="padding: 12px; background-color: #f9fafb; border-radius: 4px; margin: 20px 0;">
								<p style="margin: 0 0 4px; color: #6b7280; font-size: 13px;">Scheduled For</p>
								<p style="margin: 0; color: #111827; font-size: 14px; font-weight: 500;">${new Date(data.scheduledDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
							</div>
							
							<p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
								Please check your account connection and try scheduling the tweet again.
							</p>
						</td>
					</tr>
					
					<!-- Footer -->
					<tr>
						<td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center; border-top: 1px solid #e5e7eb;">
							<p style="margin: 0; color: #6b7280; font-size: 13px;">
								This is an automated notification from SchedX
							</p>
							<p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px;">
								You can manage your notification preferences in your account settings
							</p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
		`;
	}

	/**
	 * Generate plain text email for failure notification
	 */
	private generateFailureEmailText(data: TweetNotificationData & { errorMessage: string }): string {
		const tweetPreview = data.tweetContent.length > 200 
			? data.tweetContent.substring(0, 200) + '...' 
			: data.tweetContent;

		return `
❌ Tweet Failed to Post

Your scheduled tweet could not be posted to Twitter/X.

Error: ${data.errorMessage}

Account: ${data.accountDisplayName} (@${data.accountUsername})

Tweet Content:
${tweetPreview}
${data.hasMedia ? `\n📎 ${data.mediaCount} media file${data.mediaCount! > 1 ? 's' : ''} attached` : ''}

Scheduled For: ${new Date(data.scheduledDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}

Please check your account connection and try scheduling the tweet again.

---
This is an automated notification from SchedX.
You can manage your notification preferences in your account settings.
		`;
	}
}
