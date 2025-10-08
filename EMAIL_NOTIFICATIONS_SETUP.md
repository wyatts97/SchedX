# Email Notifications Setup Guide

## Overview

SchedX now supports email notifications for scheduled tweet events using Resend as the email service provider.

## Features

✅ **Success Notifications** - Get notified when tweets are successfully posted  
✅ **Failure Notifications** - Get alerted when tweets fail to post  
✅ **Beautiful HTML Emails** - Professional, responsive email templates  
✅ **Per-User Preferences** - Each admin can configure their own notification settings  
✅ **Secure & Reliable** - Uses Resend's modern email API

## Setup Instructions

### 1. Get a Resend API Key

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account (3,000 emails/month free)
3. Create an API key from the dashboard
4. Copy your API key

**Domain Options:**
- **Testing:** Use `onboarding@resend.dev` (only sends to your Resend account email)
- **Production:** Verify your domain in Resend dashboard (free, takes ~5 minutes)
- **No Domain?** Keep `EMAIL_NOTIFICATIONS_ENABLED=false` - the app works fine without emails!

### 2. Configure Environment Variables

Add these variables to your `.env` file:

```env
# Email Notifications
EMAIL_NOTIFICATIONS_ENABLED=true
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key_here

# For testing (sends only to your Resend account email):
EMAIL_FROM=onboarding@resend.dev

# For production (after verifying your domain in Resend):
# EMAIL_FROM=noreply@yourdomain.com

EMAIL_FROM_NAME=SchedX
```

**Important Notes:**
- **Test Domain:** `onboarding@resend.dev` works immediately but only sends to your Resend account email
- **Production:** Verify your domain in Resend (free, ~5 minutes) to send to any email
- **Optional Feature:** Set `EMAIL_NOTIFICATIONS_ENABLED=false` if you don't need emails - the app works perfectly without them

### 3. Install Dependencies

```bash
# Install Resend package
cd packages/schedx-shared-lib
npm install resend@^4.0.1

# Rebuild shared library
npm run build

# Install dependencies for all packages
cd ../..
npm install
```

### 4. Build and Restart

```bash
# Build all packages
npm run build

# Restart services
docker-compose down
docker-compose up -d --build

# Or for development
npm run dev
```

### 5. Configure User Preferences

1. Go to **Admin Panel** → **Settings** → **Email Notifications**
2. Toggle "Email Notifications" to **ON**
3. Enter your email address
4. Select which notifications you want:
   - ✅ Successful Posts
   - ✅ Failed Posts (recommended)
5. Click **Save Settings**

## Email Templates

### Success Email
- ✅ Green-themed professional design
- Shows tweet content, account info, and timing
- Includes direct link to view tweet on Twitter/X
- Displays media attachment count if applicable

### Failure Email
- ❌ Red-themed alert design
- Shows error message and tweet details
- Helps quickly identify and resolve issues
- No action required if issue is temporary

## Database Schema

Email preferences are stored in the `users` collection:

```javascript
{
  emailNotifications: {
    enabled: boolean,
    email: string,
    onSuccess: boolean,
    onFailure: boolean
  }
}
```

## API Endpoints

### GET `/api/admin/email-notifications`
Get current email notification preferences

**Response:**
```json
{
  "preferences": {
    "enabled": true,
    "email": "admin@example.com",
    "onSuccess": true,
    "onFailure": true
  }
}
```

### POST `/api/admin/email-notifications`
Update email notification preferences

**Request Body:**
```json
{
  "enabled": true,
  "email": "admin@example.com",
  "onSuccess": true,
  "onFailure": false
}
```

## Architecture

```
Scheduler Service
    ↓
Tweet Posted/Failed
    ↓
Check Email Preferences (Database)
    ↓
Email Service (Resend)
    ↓
Send Email
    ↓
Log Result
```

## Files Created/Modified

### New Files
- `packages/schedx-shared-lib/src/backend/emailService.ts` - Email service with Resend integration
- `packages/schedx-app/src/routes/api/admin/email-notifications/+server.ts` - API endpoint
- `packages/schedx-app/src/routes/admin/settings/email/+page.svelte` - Settings UI

### Modified Files
- `packages/schedx-shared-lib/src/backend/db.ts` - Added email preference methods
- `packages/schedx-shared-lib/src/backend/index.ts` - Exported email service
- `packages/schedx-shared-lib/package.json` - Added Resend dependency
- `packages/schedx-scheduler/src/config.ts` - Added email config
- `packages/schedx-scheduler/src/tweetProcessor.ts` - Integrated email notifications
- `.env.example` - Added email configuration section

## Testing

### Test Success Notification
1. Schedule a tweet for immediate posting
2. Wait for scheduler to process it
3. Check your email for success notification

### Test Failure Notification
1. Disconnect your Twitter account
2. Schedule a tweet
3. Wait for scheduler to process it
4. Check your email for failure notification

## Troubleshooting

### Emails Not Sending

**Check these:**
1. `EMAIL_NOTIFICATIONS_ENABLED=true` in `.env`
2. Valid `RESEND_API_KEY` configured
3. `EMAIL_FROM` is from a verified domain
4. User preferences are enabled in admin panel
5. Check scheduler logs for email service initialization
6. Verify Resend API key has send permissions

**View Logs:**
```bash
# Check scheduler logs
docker-compose logs -f scheduler

# Look for these messages:
# "Email notification service initialized"
# "Success email notification sent"
# "Failed to send email notification"
```

### Email Goes to Spam

1. Verify your domain in Resend
2. Set up SPF, DKIM, and DMARC records
3. Use a professional sender name
4. Avoid spam trigger words in content

### Wrong Email Address

1. Go to Admin Panel → Settings → Email Notifications
2. Update your email address
3. Click Save Settings
4. Test with a new scheduled tweet

## Resend Pricing

- **Free Tier**: 3,000 emails/month, 100 emails/day
- **Pro Tier**: $20/month for 50,000 emails
- **Enterprise**: Custom pricing

For most users, the free tier is sufficient.

## Future Enhancements

Potential improvements:
- [ ] Batch daily/weekly summary emails
- [ ] Email templates customization
- [ ] Multiple email recipients
- [ ] SMS notifications via Twilio
- [ ] Webhook notifications
- [ ] Slack/Discord integrations

## Support

For issues or questions:
- Check logs: `docker-compose logs -f scheduler`
- Review Resend dashboard for delivery status
- Verify environment variables are set correctly
- Ensure shared-lib is built: `npm run build --workspace=@schedx/shared-lib`

---

**Note:** The lint errors you see during development are expected until you run `npm run build --workspace=@schedx/shared-lib` to compile the TypeScript code.
