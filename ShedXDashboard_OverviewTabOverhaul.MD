# 🧭 Overview Tab Upgrades — SchedX Dashboard

This document defines enhancements and supported features for the **Overview** tab of the Twitter scheduler app.  
All features listed below are **fully supported under the free Twitter API v2 tier** and designed for integration with a **SQLite** backend.

---

## 1. Activity Summary

**Purpose:** Give users a fast view of current system status and posting volume.

**Data Points:**
- Number of connected accounts  
- Total tweets published  
- Total tweets scheduled  
- Upcoming posts in next 24h / 7d  
- Average posting frequency (posts/day or week)  
- Last post time and next scheduled post  
- Queue health indicator (“All accounts scheduled through Friday”, etc.)

**Implementation Notes:**
- Use SQLite to store tweet metadata (created_at, scheduled_for, status).
- Query counts and timestamps for quick dashboard summaries.

---

## 2. Engagement Snapshot

**Purpose:** Surface high-level engagement data without deep analytics.

**Metrics (fully supported):**
- **Average engagement rate:**  
  Derived manually via  
  `(likes + replies + retweets) / followers * 100`
- **Change vs last 7 days:**  
  Compare current averages with stored daily snapshots in SQLite.
- **Most engaged post:**  
  Highest total (likes + replies + retweets) among recent tweets.
- **Top-performing account:**  
  Account with highest average engagement rate for the period.

**API References:**
- `GET /2/users/:id/tweets?tweet.fields=public_metrics,attachments`
- `GET /2/users/:id?user.fields=public_metrics`

**Storage Schema (SQLite Example):**
```sql
CREATE TABLE daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT,
  date TEXT,
  followers INTEGER,
  total_likes INTEGER,
  total_replies INTEGER,
  total_retweets INTEGER,
  engagement_rate REAL,
  top_tweet_id TEXT
);
Daily Process:

Fetch last ~20 tweets per account.

Sum likes, replies, retweets.

Store daily snapshot in SQLite.

Compare current snapshot vs 7 days prior for % change.

3. Content Mix Visualization
Purpose: Visual overview of posting habits.

Data Points:

Post type distribution (text, image, video, link)

Hashtag frequency summary

Posting time heatmap (hours × days)

Implementation Notes:

Store tweet metadata (type, hashtags, created_at).

Use simple queries to count and group.

Render in dashboard with small bar/pie/heatmap charts.

4. System & Automation Status
Purpose: Quickly show connection and queue state.

Metrics:

API connection status per account (active / expired)

Pending drafts or scheduled threads

Automation toggles (auto-reshare, auto-queue refill)

Active scheduled posts summary

Implementation Notes:

Maintain an accounts table tracking access token validity.

Auto-refresh token status daily or on failure.

5. Performance Trend Preview
Purpose: Visualize direction of growth at a glance.

Mini Charts:

Follower growth trend (last 30 days)

Engagement trend (last 30 days)

Tweets published per day

Implementation Notes:

Pull from stored daily snapshots in SQLite.

Use sparkline charts in UI.

6. Smart Insights
Purpose: Provide actionable highlights using existing data.

Examples:

“Your best posting day this week was Tuesday at 8 PM.”

“Posts with images got 2.3× more engagement.”

“Account @example hasn’t posted in 5 days.”

Implementation Notes:

Analyze existing SQLite metrics with lightweight logic (no ML required).

Generate once per day and cache results.

7. Quick Actions / Shortcuts
Purpose: Enable instant actions directly from the overview.

Actions:

➕ Schedule new tweet

📊 View analytics

🧵 Create thread

🔁 Reshare Top Performer

🔁 Reshare Top Performer
Functionality:

Identify top tweet (highest engagement score).

Allow the user to instantly:

Retweet it

Quote-tweet it with a custom message

Endpoints:

POST /2/users/:id/retweets — retweet as authenticated user

POST /2/tweets with quote_tweet_id — quote tweet with text

Implementation:

ts
Copy code
await client.v2.retweet(userId, topTweetId);

// OR for quote tweet
await client.v2.tweet({
  text: "Our most popular tweet this week 👇",
  quote_tweet_id: topTweetId,
});
Automation Option:

Optional “auto-reshare top tweet weekly” toggle

Store last_reshared_tweet_id to prevent duplicates

8. Overview Layout Example
Suggested UI Structure:

less
Copy code
[Header: Today’s Overview]

[Row 1: Cards]
Accounts | Published | Scheduled | Engagement Rate

[Row 2: Charts]
Activity Trend | Content Type Mix | Engagement Change

[Row 3: Highlights]
Top Tweet | Smart Insight | Queue Status

[Row 4: Quick Actions]
[ + Schedule Tweet ] [ 🔁 Reshare Top Performer ] [ 📊 View Analytics ]
✅ Summary
Everything in this document is achievable using:

Twitter API v2 Free tier

SQLite for local persistence

Daily cron-based data collection

Focus:
Simple, accurate, lightweight analytics and automation within API limits — no paid access required.