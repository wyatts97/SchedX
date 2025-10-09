# SQLite Migration Plan

## Overview
Migrate from MongoDB 4.4 to SQLite for better performance, smaller footprint, and no AVX requirements.

---

## Benefits
- ✅ **No AVX requirement** - Works on all CPUs
- ✅ **Zero configuration** - File-based, no separate container
- ✅ **Smaller footprint** - ~5MB vs 400MB MongoDB image
- ✅ **Better performance** - Faster for read-heavy workloads
- ✅ **Simpler deployment** - No Docker service needed
- ✅ **Active maintenance** - Always up-to-date
- ✅ **Built-in encryption** - SQLCipher support available

---

## Architecture Changes

### Current Architecture
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   App       │────▶│   MongoDB   │◀────│  Scheduler  │
│  (SvelteKit)│     │  Container  │     │   (Node)    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### New Architecture
```
┌─────────────┐     ┌─────────────┐
│   App       │────▶│   SQLite    │◀────┐
│  (SvelteKit)│     │   File      │     │
└─────────────┘     │  (Volume)   │     │
                    └─────────────┘     │
┌─────────────┐                         │
│  Scheduler  │─────────────────────────┘
│   (Node)    │
└─────────────┘
```

---

## Database Schema

### Tables to Create

#### 1. **users**
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    displayName TEXT,
    role TEXT DEFAULT 'user',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    lastLogin INTEGER
);
CREATE INDEX idx_users_email ON users(email);
```

#### 2. **accounts**
```sql
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    provider TEXT NOT NULL,
    providerAccountId TEXT NOT NULL,
    username TEXT,
    displayName TEXT,
    profileImage TEXT,
    accessToken TEXT,
    refreshToken TEXT,
    expiresAt INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, providerAccountId)
);
CREATE INDEX idx_accounts_userId ON accounts(userId);
CREATE INDEX idx_accounts_provider ON accounts(provider, providerAccountId);
```

#### 3. **tweets**
```sql
CREATE TABLE tweets (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    twitterAccountId TEXT NOT NULL,
    content TEXT NOT NULL,
    scheduledDate INTEGER,
    status TEXT NOT NULL DEFAULT 'draft',
    twitterTweetId TEXT,
    error TEXT,
    media TEXT, -- JSON array stored as TEXT
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (twitterAccountId) REFERENCES accounts(providerAccountId) ON DELETE CASCADE
);
CREATE INDEX idx_tweets_userId ON tweets(userId);
CREATE INDEX idx_tweets_status ON tweets(status);
CREATE INDEX idx_tweets_scheduledDate ON tweets(scheduledDate);
CREATE INDEX idx_tweets_twitterAccountId ON tweets(twitterAccountId);
```

#### 4. **twitter_apps**
```sql
CREATE TABLE twitter_apps (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    apiKey TEXT NOT NULL,
    apiSecret TEXT NOT NULL,
    bearerToken TEXT,
    clientId TEXT,
    clientSecret TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_twitter_apps_userId ON twitter_apps(userId);
CREATE INDEX idx_twitter_apps_isActive ON twitter_apps(isActive);
```

#### 5. **notifications**
```sql
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    metadata TEXT, -- JSON stored as TEXT
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_notifications_userId ON notifications(userId);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_createdAt ON notifications(createdAt);
```

---

## Migration Checklist

### Phase 1: Setup & Dependencies
- [ ] Install SQLite dependencies
  - [ ] Add `better-sqlite3` to shared-lib
  - [ ] Add type definitions
- [ ] Create SQLite database wrapper class
- [ ] Create migration script for schema
- [ ] Add encryption support (optional)

### Phase 2: Database Layer Refactor
- [ ] Update `packages/schedx-shared-lib/src/backend/db.ts`
  - [ ] Replace MongoDB client with SQLite
  - [ ] Convert all queries from MongoDB to SQL
  - [ ] Update connection logic
  - [ ] Add transaction support
  - [ ] Handle JSON fields (media, metadata)

### Phase 3: Query Conversions

#### User Operations
- [ ] `createUser()` - INSERT
- [ ] `getUserByEmail()` - SELECT with WHERE
- [ ] `getUserById()` - SELECT with WHERE
- [ ] `updateUser()` - UPDATE
- [ ] `deleteUser()` - DELETE
- [ ] `getAllUsers()` - SELECT with admin check

#### Account Operations
- [ ] `createAccount()` - INSERT
- [ ] `getAccountsByUserId()` - SELECT with JOIN
- [ ] `getAccountByProviderAccountId()` - SELECT with WHERE
- [ ] `updateAccount()` - UPDATE
- [ ] `deleteAccount()` - DELETE
- [ ] `getAllUserAccounts()` - SELECT with JOIN

#### Tweet Operations
- [ ] `createTweet()` - INSERT with JSON media
- [ ] `getTweetById()` - SELECT with WHERE
- [ ] `getTweetsByUserId()` - SELECT with WHERE
- [ ] `updateTweet()` - UPDATE
- [ ] `deleteTweet()` - DELETE
- [ ] `deleteTweets()` - DELETE with IN clause
- [ ] `findDueTweets()` - SELECT with date comparison
- [ ] `getAllTweets()` - SELECT with JOIN for admin

#### Twitter App Operations
- [ ] `createTwitterApp()` - INSERT
- [ ] `getTwitterAppsByUserId()` - SELECT with WHERE
- [ ] `getActiveTwitterApp()` - SELECT with isActive=1
- [ ] `updateTwitterApp()` - UPDATE
- [ ] `deleteTwitterApp()` - DELETE
- [ ] `getAllTwitterApps()` - SELECT for admin

#### Notification Operations
- [ ] `createNotification()` - INSERT
- [ ] `getNotificationsByUserId()` - SELECT with WHERE
- [ ] `markNotificationAsRead()` - UPDATE
- [ ] `deleteNotification()` - DELETE

### Phase 4: Environment & Configuration
- [ ] Update `.env` files
  - [ ] Remove `MONGODB_URI`
  - [ ] Add `DATABASE_PATH` (e.g., `/data/schedx.db`)
- [ ] Update `.env.docker`
  - [ ] Set `DATABASE_PATH=/data/schedx.db`
- [ ] Update `.env.example`
  - [ ] Document SQLite configuration

### Phase 5: Docker Configuration
- [ ] Update `docker-compose.yml`
  - [ ] Remove MongoDB service
  - [ ] Add SQLite volume mount
  - [ ] Update app/scheduler volumes
- [ ] Update `Dockerfile`
  - [ ] Add SQLite dependencies if needed
  - [ ] Create data directory
- [ ] Remove `mongo-init.js`

### Phase 6: Initialization & Seeding
- [ ] Create database initialization script
  - [ ] Create tables
  - [ ] Create indexes
  - [ ] Seed default admin user
- [ ] Update app startup to initialize DB
- [ ] Add migration script for existing data (if needed)

### Phase 7: Testing & Validation
- [ ] Test user authentication
- [ ] Test account connections
- [ ] Test tweet creation/scheduling
- [ ] Test tweet posting (scheduler)
- [ ] Test admin panel
- [ ] Test notifications
- [ ] Test file uploads
- [ ] Verify encryption works
- [ ] Load testing

### Phase 8: Documentation
- [ ] Update README.md
- [ ] Update deployment docs
- [ ] Add SQLite backup instructions
- [ ] Document migration from MongoDB (for existing users)

### Phase 9: Cleanup
- [ ] Remove MongoDB dependencies
- [ ] Remove unused MongoDB code
- [ ] Update package.json files
- [ ] Clean up Docker volumes

---

## File Changes Required

### Files to Modify
1. `packages/schedx-shared-lib/package.json` - Add better-sqlite3
2. `packages/schedx-shared-lib/src/backend/db.ts` - Complete rewrite
3. `packages/schedx-shared-lib/src/backend/index.ts` - Export updates
4. `packages/schedx-app/src/lib/server/db.ts` - Update initialization
5. `packages/schedx-scheduler/src/index.ts` - Update DB connection
6. `.env` - Update connection string
7. `.env.docker` - Update connection string
8. `.env.example` - Update documentation
9. `docker-compose.yml` - Remove MongoDB, add volume
10. `Dockerfile` - Update for SQLite

### Files to Create
1. `packages/schedx-shared-lib/src/backend/migrations/001_initial_schema.sql`
2. `packages/schedx-shared-lib/src/backend/sqlite-wrapper.ts`
3. `scripts/migrate-from-mongodb.js` (optional, for existing users)
4. `scripts/backup-sqlite.sh`

### Files to Delete
1. `mongo-init.js`
2. MongoDB-specific scripts

---

## Data Type Mappings

| MongoDB | SQLite | Notes |
|---------|--------|-------|
| ObjectId | TEXT (UUID) | Use crypto.randomUUID() |
| String | TEXT | Direct mapping |
| Number | INTEGER/REAL | Use INTEGER for timestamps |
| Boolean | INTEGER | 0 = false, 1 = true |
| Date | INTEGER | Unix timestamp (ms) |
| Array | TEXT | JSON.stringify/parse |
| Object | TEXT | JSON.stringify/parse |

---

## Encryption Strategy

### Option 1: SQLCipher (Recommended)
- Transparent encryption at rest
- Requires `@journeyapps/sqlcipher` instead of `better-sqlite3`
- Password from `DB_ENCRYPTION_KEY` env var

### Option 2: Application-Level
- Keep current encryption for sensitive fields
- Encrypt before INSERT, decrypt after SELECT
- More flexible but more code

**Decision:** Use SQLCipher for full database encryption

---

## Rollback Plan

If migration fails:
1. Keep MongoDB 4.4 config in `docker-compose.yml.backup`
2. Export SQLite data to JSON
3. Restore MongoDB container
4. Import JSON to MongoDB
5. Revert code changes

---

## Performance Considerations

### Optimizations
- [ ] Use prepared statements for all queries
- [ ] Enable WAL mode for better concurrency
- [ ] Set appropriate cache size
- [ ] Use transactions for bulk operations
- [ ] Add indexes for common queries

### Configuration
```javascript
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 10000');
db.pragma('temp_store = MEMORY');
```

---

## Timeline Estimate

- **Phase 1-2:** 2-3 hours (Setup & Core DB Layer)
- **Phase 3:** 3-4 hours (Query Conversions)
- **Phase 4-5:** 1 hour (Config & Docker)
- **Phase 6:** 1 hour (Initialization)
- **Phase 7:** 2-3 hours (Testing)
- **Phase 8-9:** 1 hour (Docs & Cleanup)

**Total:** ~10-13 hours of development time

---

## Success Criteria

✅ All existing features work identically
✅ No MongoDB dependencies remain
✅ Database file is encrypted
✅ Performance is equal or better
✅ Docker deployment works without MongoDB
✅ Backup/restore process documented
✅ Migration path for existing users (if needed)

---

## Notes

- SQLite is single-writer, but this is fine for SchedX's use case
- For high concurrency, consider connection pooling
- Regular backups are simpler (just copy the .db file)
- Can use Litestream for real-time replication if needed
- Consider `better-sqlite3` vs `@journeyapps/sqlcipher` based on encryption needs

---

## Next Steps

1. Review this plan
2. Confirm encryption strategy (SQLCipher vs application-level)
3. Begin Phase 1: Install dependencies
4. Proceed through phases sequentially
5. Test thoroughly at each phase

---

**Ready to begin migration!** 🚀
