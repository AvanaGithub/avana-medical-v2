#!/usr/bin/env bash
# Deploy the latest code from GitHub. Run as root on the droplet:   bash /var/www/avana-medical/deploy/update.sh
# The database and uploaded images live in /var/lib/avana-medical and are never touched.
set -euo pipefail
cd /var/www/avana-medical
sudo -u avana git pull --ff-only
cd server
sudo -u avana npm ci --omit=dev --no-fund --no-audit
systemctl restart avana-medical
sleep 2
curl -fsS http://127.0.0.1:3000/healthz && echo " updated and running ($(git -C /var/www/avana-medical log --oneline -1))"
