# Fix Database Migration Issue

The migration 007 failed because SQLite doesn't allow adding a UNIQUE column to a table with existing data.

## Quick Fix - Run these commands:

```bash
# 1. Stop the container
docker-compose down

# 2. Access the database directly
docker run --rm -v schedx_data:/data -it alpine sh

# 3. Install sqlite3
apk add sqlite

# 4. Open the database
sqlite3 /data/schedx.db

# 5. Run these SQL commands:
DELETE FROM schema_migrations WHERE version = '007_add_username_column.sql';
ALTER TABLE users ADD COLUMN username TEXT;
UPDATE users SET username = 'admin' WHERE role = 'admin';
CREATE UNIQUE INDEX idx_users_username_unique ON users(username) WHERE username IS NOT NULL;
.quit

# 6. Exit the container
exit

# 7. Rebuild and start
cd ~/schedx
docker-compose up -d --build
```

## Alternative: Simpler one-liner fix

```bash
cd ~/schedx
docker-compose down
docker run --rm -v schedx_data:/data alpine sh -c "apk add sqlite && sqlite3 /data/schedx.db \"DELETE FROM schema_migrations WHERE version = '007_add_username_column.sql'; ALTER TABLE users ADD COLUMN username TEXT; UPDATE users SET username = 'admin' WHERE role = 'admin'; CREATE UNIQUE INDEX idx_users_username_unique ON users(username) WHERE username IS NOT NULL;\""
docker-compose up -d --build
```
