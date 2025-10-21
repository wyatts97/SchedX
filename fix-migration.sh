#!/bin/bash

# Fix failed migration 007
# This script removes the failed migration from the tracking table so it can run again

echo "Fixing failed migration 007..."

# Connect to the database and remove the failed migration
docker exec schedx-app-1 node -e "
const Database = require('better-sqlite3');
const db = new Database('/data/schedx.db');

// Remove the failed migration
db.prepare('DELETE FROM schema_migrations WHERE version = ?').run('007_add_username_column.sql');

console.log('Migration 007 removed from tracking table');
db.close();
"

echo "Done! Now rebuild the container:"
echo "docker-compose down && docker-compose up -d --build"
