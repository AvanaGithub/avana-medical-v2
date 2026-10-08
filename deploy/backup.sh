#!/usr/bin/env bash
# Nightly backup of the database, uploaded event images and candidates' CVs. Keeps the last 14 days.
# Installed by setup.sh as /usr/local/bin/avana-medical-backup (cron 02:30 daily).
set -euo pipefail
DATA_DIR=/var/lib/avana-medical
OUT="$DATA_DIR/backups/$(date +%F)"
mkdir -p "$OUT"
sqlite3 "$DATA_DIR/data/app.db" ".backup '$OUT/app.db'"      # consistent copy while the site is running
tar -czf "$OUT/uploads.tar.gz" -C "$DATA_DIR" uploads
if [ -d "$DATA_DIR/data/cv" ]; then tar -czf "$OUT/cv.tar.gz" -C "$DATA_DIR/data" cv; chmod 600 "$OUT/cv.tar.gz"; fi   # CVs: personal data, owner-only
find "$DATA_DIR/backups" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
chown -R avana:avana "$DATA_DIR/backups"
