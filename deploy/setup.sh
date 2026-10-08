#!/usr/bin/env bash
# One-time setup of the Avana Medical website on a fresh Ubuntu 24.04 DigitalOcean droplet.
# Run as root:   bash setup.sh new.avanamedical.com
# Safe to re-run: it skips steps that are already done.
set -euo pipefail

DOMAIN="${1:?Usage: bash setup.sh <domain, e.g. new.avanamedical.com>}"
REPO="https://github.com/AvanaGithub/avana-medical-v2.git"
APP_DIR=/var/www/avana-medical          # git checkout of the site + server code
DATA_DIR=/var/lib/avana-medical          # database + uploaded images (kept outside the code folder)
APP_USER=avana

echo "==> System packages"
apt-get update -y
apt-get install -y curl git nginx ufw sqlite3 ca-certificates
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> Firewall (SSH + web only)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> App user and folders"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$DATA_DIR/data" "$DATA_DIR/uploads" "$DATA_DIR/backups"
if [ ! -d "$APP_DIR/.git" ]; then git clone "$REPO" "$APP_DIR"; fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR"
git config --global --add safe.directory "$APP_DIR"

echo "==> Server settings"
if [ ! -f "$APP_DIR/server/.env" ]; then
  cat > "$APP_DIR/server/.env" <<EOF
NODE_ENV=production
PORT=3000
SITE_URL=https://$DOMAIN
DATA_DIR=$DATA_DIR/data
UPLOADS_DIR=$DATA_DIR/uploads
EOF
  chown "$APP_USER:$APP_USER" "$APP_DIR/server/.env"; chmod 600 "$APP_DIR/server/.env"
fi

echo "==> Install packages, load the starting events"
cd "$APP_DIR/server"
sudo -u "$APP_USER" npm ci --omit=dev --no-fund --no-audit
sudo -u "$APP_USER" node scripts/seed-events.js

echo "==> Service (starts on boot, restarts if it crashes)"
cp "$APP_DIR/deploy/avana-medical.service" /etc/systemd/system/avana-medical.service
systemctl daemon-reload
systemctl enable --now avana-medical
sleep 2
curl -fsS http://127.0.0.1:3000/healthz && echo " app is running"

echo "==> nginx"
sed "s/__DOMAIN__/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/avana-medical
ln -sf /etc/nginx/sites-available/avana-medical /etc/nginx/sites-enabled/avana-medical
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> Nightly backup (database + uploaded images, 14 days kept)"
cp "$APP_DIR/deploy/backup.sh" /usr/local/bin/avana-medical-backup
chmod 755 /usr/local/bin/avana-medical-backup
echo "30 2 * * * root /usr/local/bin/avana-medical-backup" > /etc/cron.d/avana-medical-backup

echo
echo "Done. Next:"
echo "  1. Point DNS for $DOMAIN to this server's IP, then get HTTPS:"
echo "       apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d $DOMAIN"
echo "  2. Create the first admin:"
echo "       cd $APP_DIR/server && sudo -u $APP_USER npm run create-admin -- you@avanamedical.com \"Your Name\""
