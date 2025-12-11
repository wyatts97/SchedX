# Litestream Database Backup

SchedX uses [Litestream](https://litestream.io/) for real-time SQLite replication and backup.

## Overview

Litestream continuously streams SQLite changes to a backup destination, providing:
- **Point-in-time recovery** - Restore to any moment in time
- **Minimal data loss** - Changes replicated within seconds
- **Zero downtime** - Backups happen while the app runs
- **Simple setup** - No complex database infrastructure

## Quick Start

### Using Docker (Recommended)

```bash
# Use the Litestream-enabled Docker Compose file
docker-compose -f docker-compose.litestream.yml up -d
```

This automatically:
1. Restores the database from backup on startup (if no database exists)
2. Continuously replicates changes to `/backups/schedx`
3. Keeps 7 days of backup history

### Backup Destinations

#### Local Filesystem (Default)

Backups are stored in a Docker volume at `/backups/schedx`. To use an external drive:

```yaml
# In docker-compose.litestream.yml
volumes:
  backup-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /path/to/external/backup/drive
```

#### S3-Compatible Storage

Edit `litestream.yml` to enable S3 backup:

```yaml
dbs:
  - path: /data/schedx.db
    replicas:
      - type: s3
        bucket: your-bucket-name
        path: schedx/backups
        endpoint: s3.us-west-2.amazonaws.com  # Or MinIO, Backblaze B2, etc.
        region: us-west-2
        access-key-id: ${LITESTREAM_ACCESS_KEY_ID}
        secret-access-key: ${LITESTREAM_SECRET_ACCESS_KEY}
        retention: 720h  # 30 days
```

Add credentials to `.env.docker`:

```env
LITESTREAM_ACCESS_KEY_ID=your-access-key
LITESTREAM_SECRET_ACCESS_KEY=your-secret-key
```

**Compatible S3 providers:**
- AWS S3
- MinIO (self-hosted)
- Backblaze B2
- Cloudflare R2
- DigitalOcean Spaces
- Wasabi

## Manual Operations

### Restore from Backup

```bash
# Stop the app first
docker-compose -f docker-compose.litestream.yml down

# Restore to a specific point in time
docker run --rm -v schedx_db-data:/data -v schedx_backup-data:/backups \
  litestream/litestream restore -config /etc/litestream.yml /data/schedx.db

# Or restore to a specific timestamp
docker run --rm -v schedx_db-data:/data -v schedx_backup-data:/backups \
  litestream/litestream restore -config /etc/litestream.yml \
  -timestamp "2024-01-15T10:30:00Z" /data/schedx.db

# Start the app
docker-compose -f docker-compose.litestream.yml up -d
```

### Check Backup Status

```bash
# View replication status
docker exec schedx-app litestream generations /data/schedx.db

# List available snapshots
docker exec schedx-app litestream snapshots /data/schedx.db
```

## Configuration Reference

### litestream.yml

| Setting | Description | Default |
|---------|-------------|---------|
| `path` | Database file path | `/data/schedx.db` |
| `retention` | How long to keep backups | `168h` (7 days) |
| `sync-interval` | How often to sync WAL | `60s` |
| `snapshot-interval` | How often to create snapshots | `24h` |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `LITESTREAM_ACCESS_KEY_ID` | S3 access key |
| `LITESTREAM_SECRET_ACCESS_KEY` | S3 secret key |
| `LITESTREAM_S3_ENDPOINT` | S3 endpoint URL |
| `LITESTREAM_S3_REGION` | S3 region |

## Monitoring

Litestream logs replication activity. View logs with:

```bash
docker logs schedx-app 2>&1 | grep -i litestream
```

Healthy output looks like:

```
litestream: replicating to: file:///backups/schedx
litestream: sync: path=/data/schedx.db replica=file position=00000001/00000000
```

## Disaster Recovery

### Complete Data Loss

1. Provision new server
2. Clone SchedX repository
3. Copy `litestream.yml` with S3 credentials
4. Run `docker-compose -f docker-compose.litestream.yml up -d`
5. Litestream automatically restores from S3

### Corrupted Database

```bash
# Stop app
docker-compose down

# Remove corrupted database
docker volume rm schedx_db-data

# Restart - Litestream will restore from backup
docker-compose -f docker-compose.litestream.yml up -d
```

## Best Practices

1. **Use S3 for production** - Local backups don't protect against disk failure
2. **Test restores regularly** - Verify backups work before you need them
3. **Monitor replication lag** - Ensure backups are current
4. **Set appropriate retention** - Balance storage costs vs recovery needs
5. **Secure credentials** - Use environment variables, not hardcoded keys

## Troubleshooting

### Backup not starting

Check that the database path is correct and Litestream has write access:

```bash
docker exec schedx-app ls -la /data/
docker exec schedx-app ls -la /backups/
```

### Restore fails

Ensure the database file doesn't exist before restoring:

```bash
docker exec schedx-app rm -f /data/schedx.db /data/schedx.db-shm /data/schedx.db-wal
```

### S3 connection errors

Verify credentials and endpoint:

```bash
docker exec schedx-app env | grep LITESTREAM
```
