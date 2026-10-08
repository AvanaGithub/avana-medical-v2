#!/usr/bin/env bash
# Nightly backup of the database and uploaded event images. Keeps the last 14 days.
# Installed by setup.sh as /usr/local/bin/avana-medical-backup (cron 02:30 daily).
set -euo pipefail
DATA_DIR=/var/lib/avana-medical
OUT="$DATA_DIR/backups/$(date +%F)"
mkdir -p "$OUT"
sqlite3 "$DATA_DIR/data/app.db" ".backup '$OUT/app.db'"      # consistent copy while the site is running
tar -czf "$OUT/uploads.tar.gz" -C "$DATA_DIR" uploads
find "$DATA_DIR/backups" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
chown -R avana:avana "$DATA_DIR/backups"
