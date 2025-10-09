# SQLite Migration Testing Checklist

## Pre-Testing Setup

### 1. Build Shared Library
```bash
cd packages/schedx-shared-lib
npm run build
```

**Expected Output:**
- ✅ No TypeScript errors
- ✅ `dist/` folder created with compiled files
- ✅ `dist/backend/db-sqlite.js` exists
- ✅ `dist/backend/sqlite-wrapper.js` exists
- ✅ `dist/backend/migrations/` folder exists

### 2. Install Dependencies
```bash
cd ../..
npm install
```

**Expected Output:**
- ✅ `@journeyapps/sqlcipher` installed in shared-lib
- ✅ `@types/better-sqlite3` installed in shared-lib
- ✅ No dependency conflicts

---

## Testing Phases

### Phase 1: Database Initialization ⚠️ CRITICAL

#### Test 1.1: Create Database File
**Location:** Local development (dev.ps1)

**Steps:**
1. Ensure `data/` directory exists: `mkdir data` (if not exists)
2. Run app initialization
3. Check if `data/schedx.db` is created

**Expected Results:**
- ✅ `data/schedx.db` file created
- ✅ File size > 0 bytes
- ✅ No errors in console

**How to Verify:**
```bash
ls -lh data/schedx.db
```

#### Test 1.2: Schema Migration
**Steps:**
1. Open SQLite database
2. Check if tables exist

**Expected Results:**
- ✅ `users` table exists
- ✅ `accounts` table exists
- ✅ `tweets` table exists
- ✅ `twitter_apps` table exists
- ✅ `notifications` table exists
- ✅ All indexes created

**How to Verify:**
```bash
# Install sqlite3 CLI if needed
npm install -g sqlite3

# Check tables
sqlite3 data/schedx.db ".tables"

# Check schema
sqlite3 data/schedx.db ".schema users"
```

#### Test 1.3: Default Admin User
**Steps:**
1. Check if admin user was created
2. Try logging in with default credentials

**Expected Results:**
- ✅ Admin user exists in database
- ✅ Can login with `admin@schedx.local` / `admin123`
- ✅ Password is hashed (bcrypt)

**How to Verify:**
```bash
sqlite3 data/schedx.db "SELECT email, role FROM users WHERE role='admin';"
```

---

### Phase 2: Authentication & Users

#### Test 2.1: User Login
**Steps:**
1. Navigate to login page
2. Enter admin credentials
3. Click login

**Expected Results:**
- ✅ Login successful
- ✅ Redirected to dashboard
- ✅ Session created
- ✅ No console errors

#### Test 2.2: User Profile
**Steps:**
1. View user profile
2. Update display name
3. Save changes

**Expected Results:**
- ✅ Profile loads correctly
- ✅ Changes saved to database
- ✅ `updatedAt` timestamp updated

**SQL Verification:**
```sql
SELECT displayName, updatedAt FROM users WHERE email='admin@schedx.local';
```

---

### Phase 3: Twitter Account Connection

#### Test 3.1: Connect Twitter Account
**Steps:**
1. Go to Accounts page
2. Click "Connect Twitter Account"
3. Complete OAuth flow
4. Return to app

**Expected Results:**
- ✅ Account saved to database
- ✅ Tokens encrypted
- ✅ Profile image loaded
- ✅ Username displayed

**SQL Verification:**
```sql
SELECT id, username, provider, providerAccountId FROM accounts;
```

#### Test 3.2: Multiple Accounts
**Steps:**
1. Connect second Twitter account
2. View accounts list

**Expected Results:**
- ✅ Both accounts visible
- ✅ Can switch between accounts
- ✅ Each has unique `providerAccountId`

---

### Phase 4: Tweet Operations

#### Test 4.1: Create Tweet
**Steps:**
1. Go to Post page
2. Write tweet content
3. Select account
4. Click "Post Now"

**Expected Results:**
- ✅ Tweet saved to database
- ✅ Status = 'POSTED' or 'SCHEDULED'
- ✅ `twitterAccountId` set correctly
- ✅ `createdAt` timestamp set

**SQL Verification:**
```sql
SELECT id, content, status, twitterAccountId, createdAt FROM tweets ORDER BY createdAt DESC LIMIT 5;
```

#### Test 4.2: Schedule Tweet
**Steps:**
1. Create tweet
2. Set future date/time
3. Click "Schedule"

**Expected Results:**
- ✅ Tweet saved with status='SCHEDULED'
- ✅ `scheduledDate` set correctly
- ✅ Appears in scheduled tweets list

**SQL Verification:**
```sql
SELECT content, scheduledDate, status FROM tweets WHERE status='SCHEDULED';
```

#### Test 4.3: Tweet with Media
**Steps:**
1. Create tweet
2. Upload image
3. Post/Schedule

**Expected Results:**
- ✅ Media uploaded to `uploads/` folder
- ✅ `media` field contains JSON array
- ✅ Media displays in preview

**SQL Verification:**
```sql
SELECT id, media FROM tweets WHERE media IS NOT NULL;
```

#### Test 4.4: Edit Draft
**Steps:**
1. Create draft tweet
2. Edit content
3. Save changes

**Expected Results:**
- ✅ Draft updated in database
- ✅ `updatedAt` timestamp changed
- ✅ Content matches edit

#### Test 4.5: Delete Tweet
**Steps:**
1. Select tweet
2. Click delete
3. Confirm

**Expected Results:**
- ✅ Tweet removed from database
- ✅ No longer in UI
- ✅ Foreign key constraints work (if user deleted, tweets deleted)

---

### Phase 5: Scheduler Operations

#### Test 5.1: Scheduler Startup
**Steps:**
1. Start scheduler service
2. Check logs

**Expected Results:**
- ✅ Connects to SQLite database
- ✅ No connection errors
- ✅ Cron job starts
- ✅ Logs "Checking for due tweets..."

#### Test 5.2: Post Scheduled Tweet
**Steps:**
1. Create tweet scheduled for 1 minute from now
2. Wait for scheduler to run
3. Check tweet status

**Expected Results:**
- ✅ Scheduler finds due tweet
- ✅ Posts to Twitter
- ✅ Status updated to 'POSTED'
- ✅ `twitterTweetId` set
- ✅ `updatedAt` timestamp updated

**SQL Verification:**
```sql
SELECT id, status, twitterTweetId, updatedAt FROM tweets WHERE status='POSTED' ORDER BY updatedAt DESC LIMIT 1;
```

#### Test 5.3: Failed Tweet Handling
**Steps:**
1. Schedule tweet with invalid content (too long)
2. Wait for scheduler

**Expected Results:**
- ✅ Status updated to 'FAILED'
- ✅ `error` field contains error message
- ✅ Notification created (if enabled)

---

### Phase 6: Admin Panel

#### Test 6.1: View All Tweets
**Steps:**
1. Navigate to Admin > Tweets
2. View tweet list

**Expected Results:**
- ✅ All tweets displayed
- ✅ Pagination works
- ✅ Filters work (status, user)
- ✅ Can bulk delete

#### Test 6.2: View All Accounts
**Steps:**
1. Navigate to Admin > Accounts
2. View accounts list

**Expected Results:**
- ✅ All connected accounts shown
- ✅ User info displayed
- ✅ Can view account details

#### Test 6.3: Twitter Apps Management
**Steps:**
1. Navigate to Admin > Twitter Apps
2. Create new app
3. Edit app
4. Delete app

**Expected Results:**
- ✅ CRUD operations work
- ✅ Data persisted correctly
- ✅ No errors

---

### Phase 7: Notifications

#### Test 7.1: Create Notification
**Steps:**
1. Trigger notification (e.g., tweet posted)
2. Check notifications panel

**Expected Results:**
- ✅ Notification appears
- ✅ Correct type and message
- ✅ Unread count updates

#### Test 7.2: Mark as Read
**Steps:**
1. Click notification
2. Check database

**Expected Results:**
- ✅ `read` field = 1
- ✅ UI updates
- ✅ Unread count decreases

---

### Phase 8: Data Integrity

#### Test 8.1: Foreign Key Constraints
**Steps:**
1. Try to delete user with tweets
2. Check cascade behavior

**Expected Results:**
- ✅ User deletion cascades to tweets
- ✅ User deletion cascades to accounts
- ✅ User deletion cascades to notifications

**SQL Verification:**
```sql
-- Check foreign keys are enabled
PRAGMA foreign_keys;

-- Should return 1
```

#### Test 8.2: Encryption
**Steps:**
1. View raw database file
2. Check if tokens are encrypted

**Expected Results:**
- ✅ `accessToken` field is encrypted (not readable)
- ✅ `refreshToken` field is encrypted
- ✅ Can decrypt when retrieved via API

**SQL Verification:**
```sql
SELECT accessToken, refreshToken FROM accounts LIMIT 1;
-- Should see encrypted strings, not plain text
```

#### Test 8.3: Timestamps
**Steps:**
1. Create record
2. Update record
3. Check timestamps

**Expected Results:**
- ✅ `createdAt` set on insert
- ✅ `updatedAt` set on update
- ✅ Timestamps are Unix milliseconds

---

### Phase 9: Performance

#### Test 9.1: Query Speed
**Steps:**
1. Create 100+ tweets
2. Load dashboard
3. Measure load time

**Expected Results:**
- ✅ Dashboard loads < 1 second
- ✅ Pagination works smoothly
- ✅ No lag in UI

#### Test 9.2: Concurrent Access
**Steps:**
1. Run app and scheduler simultaneously
2. Create/update tweets from both

**Expected Results:**
- ✅ No database locks
- ✅ WAL mode prevents conflicts
- ✅ Both services work correctly

---

### Phase 10: Docker Deployment

#### Test 10.1: Docker Build
**Steps:**
```bash
docker-compose build
```

**Expected Results:**
- ✅ Build completes successfully
- ✅ All dependencies installed
- ✅ Shared library built
- ✅ No errors

#### Test 10.2: Docker Run
**Steps:**
```bash
docker-compose up -d
```

**Expected Results:**
- ✅ All services start
- ✅ Database created at `/data/schedx.db`
- ✅ Health checks pass
- ✅ Can access app at http://localhost:5173

#### Test 10.3: Docker Persistence
**Steps:**
1. Create data in app
2. Stop containers: `docker-compose down`
3. Restart: `docker-compose up -d`
4. Check if data persists

**Expected Results:**
- ✅ Database file persists in volume
- ✅ All data intact after restart
- ✅ No data loss

---

## Known Issues & Workarounds

### Issue 1: Missing `community` Field
**Symptom:** TypeScript errors about missing `community` property
**Fix:** Already handled - set to empty string `''`

### Issue 2: Stub Methods
**Symptom:** Some methods return empty/null
**Affected Methods:**
- `getTemplates()` - Returns `[]`
- `updateTweetAnalytics()` - No-op
- `getQueueSettings()` - Returns `null`
- `saveThread()` - Returns `''`
- Session methods - Not implemented

**Workaround:** These features need additional schema tables. Not critical for core functionality.

### Issue 3: Database Path in Docker
**Symptom:** Database not found
**Fix:** Ensure `DATABASE_PATH=/data/schedx.db` in `.env.docker`
**Fix:** Ensure volume mounted: `db-data:/data`

---

## Rollback Plan

If migration fails:

### 1. Restore MongoDB
```bash
# Uncomment in docker-compose.yml
# Restore mongo service
# Change DATABASE_PATH back to MONGODB_URI
```

### 2. Rebuild Shared Library
```bash
cd packages/schedx-shared-lib
# Edit src/backend/index.ts
# Change: export { DatabaseClient } from './db.js';
npm run build
```

### 3. Restart Services
```bash
docker-compose down
docker-compose up -d
```

---

## Success Criteria

✅ All Phase 1-5 tests pass
✅ No data loss
✅ Performance acceptable (< 1s page loads)
✅ Docker deployment works
✅ Can create, read, update, delete all entities
✅ Scheduler posts tweets successfully
✅ Encryption working
✅ Foreign keys enforced

---

## Post-Migration Cleanup

Once migration is confirmed successful:

1. ✅ Remove MongoDB dependencies from package.json
2. ✅ Delete `mongo-init.js`
3. ✅ Remove MongoDB client export from shared-lib
4. ✅ Update documentation
5. ✅ Create database backup script

---

## Support & Debugging

### View Database Contents
```bash
sqlite3 data/schedx.db
.tables
.schema tablename
SELECT * FROM tablename LIMIT 10;
```

### Check Encryption
```bash
# Database should be encrypted with SQLCipher
# Opening without key should fail
sqlite3 data/schedx.db "SELECT * FROM users;"
# Error: file is not a database
```

### Enable Debug Logging
```env
LOG_LEVEL=debug
```

### Common SQL Queries
```sql
-- Count records
SELECT COUNT(*) FROM tweets;
SELECT COUNT(*) FROM accounts;
SELECT COUNT(*) FROM users;

-- Recent activity
SELECT * FROM tweets ORDER BY createdAt DESC LIMIT 10;

-- Failed tweets
SELECT id, content, error FROM tweets WHERE status='FAILED';

-- Scheduled tweets
SELECT id, content, scheduledDate FROM tweets WHERE status='SCHEDULED' ORDER BY scheduledDate ASC;
```

---

**Ready to test!** Start with Phase 1 and work through sequentially. 🚀
