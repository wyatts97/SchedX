#!/bin/bash
# Litestream entrypoint script for SchedX
# This script handles database restoration and starts the app with replication

set -e

DB_PATH="${DATABASE_PATH:-/data/schedx.db}"
BACKUP_PATH="/backups/schedx"

echo "🔄 SchedX Litestream Entrypoint"
echo "   Database: $DB_PATH"
echo "   Backup: $BACKUP_PATH"

# Create directories if they don't exist
mkdir -p "$(dirname "$DB_PATH")"
mkdir -p "$BACKUP_PATH"

# Check if database exists
if [ -f "$DB_PATH" ]; then
    echo "✅ Database exists, starting with replication..."
else
    echo "📥 No database found, attempting restore from backup..."
    
    # Try to restore from local backup first
    if [ -d "$BACKUP_PATH" ] && [ "$(ls -A $BACKUP_PATH 2>/dev/null)" ]; then
        echo "   Restoring from local backup..."
        litestream restore -config /etc/litestream.yml -if-replica-exists "$DB_PATH"
        
        if [ -f "$DB_PATH" ]; then
            echo "✅ Database restored successfully!"
        else
            echo "⚠️  No backup found, starting fresh..."
        fi
    else
        echo "⚠️  No backups available, starting fresh..."
    fi
fi

# Start the application with Litestream replication
echo "🚀 Starting SchedX with Litestream replication..."
exec litestream replicate -config /etc/litestream.yml -exec "$@"
